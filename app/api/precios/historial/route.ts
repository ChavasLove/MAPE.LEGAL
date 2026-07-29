import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { mapeGoldBuyLpsPerGram, effectivePriceDate } from '@/services/pricingService';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

// Public, unauthenticated price history for the /precios chart. Reads the daily
// 8 AM snapshots from precios_diarios (service-role — anon has no SELECT on that
// table per migration 009) and derives the same numbers /api/precios/live serves:
// international gold USD/oz, USD/HNL, gold in Lempiras per troy oz, and the
// MAPE LEGAL purchase price in Lempiras/gram (computed here via the canonical
// mapeGoldBuyLpsPerGram helper so history can never drift from the live quote).
//
// Read-only over the frozen daily rows — this route NEVER triggers an upstream
// fetch; a missing day simply isn't in the series. /api/precios/live owns the
// capture of today's snapshot.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60_000;

// One row per day → even 5 years is ~1,800 rows. Cap defensively anyway.
const MIN_DAYS = 7;
const MAX_DAYS = 1825;
const DEFAULT_DAYS = 90;
const ROW_CAP = 2000;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFrom(request);
    const rl = checkRateLimit(`precios-historial:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const raw = Number.parseInt(request.nextUrl.searchParams.get('days') ?? '', 10);
    const days = Number.isFinite(raw)
      ? Math.min(Math.max(raw, MIN_DAYS), MAX_DAYS)
      : DEFAULT_DAYS;

    // Window-aligned cutoff: effectivePriceDate() is the same key storePrices()
    // writes, so "last N days" means the last N daily 8 AM windows.
    const anchor = new Date(`${effectivePriceDate()}T00:00:00Z`);
    anchor.setUTCDate(anchor.getUTCDate() - (days - 1));
    const cutoff = anchor.toISOString().slice(0, 10);

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('precios_diarios')
      .select('fecha, oro, usd_hnl')
      .gte('fecha', cutoff)
      .neq('fuente', 'smoke-test')
      .order('fecha', { ascending: true })
      .limit(ROW_CAP);

    if (error) {
      console.error('[api/precios/historial] read failed:', error);
      return NextResponse.json(
        { error: 'Error al cargar el historial de precios' },
        { status: 500 },
      );
    }

    const puntos = (data ?? [])
      .map((r) => {
        const oro = num(r.oro);
        const usdHnl = num(r.usd_hnl);
        if (!r.fecha || oro == null || oro <= 0) return null;
        return {
          fecha: r.fecha as string,
          oro_usd_oz: oro,
          usd_hnl: usdHnl,
          oro_lps_oz: usdHnl != null ? oro * usdHnl : null,
          oro_compra_lps_gramo: mapeGoldBuyLpsPerGram(oro, usdHnl),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    return NextResponse.json(
      {
        dias: days,
        desde: puntos[0]?.fecha ?? cutoff,
        hasta: puntos[puntos.length - 1]?.fecha ?? null,
        puntos,
      },
      {
        headers: {
          // History only changes once a day (the 8 AM capture) — a longer shared
          // TTL than /live is safe and shields Supabase from chart-driven bursts.
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
      },
    );
  } catch (err) {
    console.error('[api/precios/historial] GET error:', err);
    return NextResponse.json(
      { error: 'Error al cargar el historial de precios' },
      { status: 500 },
    );
  }
}
