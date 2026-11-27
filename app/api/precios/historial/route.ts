import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import {
  oroLpsPorGramoFino,
  oroLpsPorOnza,
  effectivePriceDate,
  parseFuente,
} from '@/services/pricingService';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import {
  AVISO_PRECIO_INFORMATIVO,
  EN_IMPLEMENTACION,
  ETIQUETA_TIPO_CAMBIO,
  FUENTE_TIPO_CAMBIO,
} from '@/lib/content/copy-legal';

// Public, unauthenticated price history for the /precios chart. Reads the daily
// 8 AM snapshots from precios_diarios (service-role — anon has no SELECT on that
// table per migration 009).
//
// DEC-2026-11-26-1 / DEC-2026-11-27-2: la serie en lempiras (L/oz y L por gramo
// de oro fino) se publica SIN factor y SOLO para los días cuyo tipo de cambio
// quedó registrado como leído del BCH (marcador fx:bch en `fuente`). Las filas
// anteriores a esta decisión guardaban un tipo de cambio de otra fuente: para
// esas fechas los campos en lempiras son null (la serie histórica en lempiras
// queda "en implementación" hasta acumular datos del BCH). La serie del oro en
// USD/oz es real para todas las fechas.
//
// Read-only over the frozen daily rows — this route NEVER triggers an upstream
// fetch; a missing day simply isn't in the series.
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
      .select('fecha, oro, usd_hnl, fuente')
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

    let conBch = 0;
    const puntos = (data ?? [])
      .map((r) => {
        const oro = num(r.oro);
        if (!r.fecha || oro == null || oro <= 0) return null;
        const { fxBch } = parseFuente(r.fuente as string | null);
        const tc = fxBch ? num(r.usd_hnl) : null;
        if (tc != null) conBch++;
        return {
          fecha: r.fecha as string,
          oro_usd_oz: oro,
          // Solo el tipo de compra del BCH; null para filas sin dato del BCH.
          tipo_cambio_compra_bch: tc,
          oro_lps_oz: oroLpsPorOnza(oro, tc),
          oro_lps_gramo_fino: oroLpsPorGramoFino(oro, tc),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    return NextResponse.json(
      {
        dias: days,
        tipo_cambio_fuente: FUENTE_TIPO_CAMBIO,
        tipo_cambio_etiqueta: ETIQUETA_TIPO_CAMBIO,
        // La serie en lempiras requiere ≥ 2 días con tipo de cambio del BCH.
        serie_lempiras_estado: conBch >= 2 ? 'disponible' : EN_IMPLEMENTACION,
        puntos_con_bch: conBch,
        aviso: AVISO_PRECIO_INFORMATIVO,
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
