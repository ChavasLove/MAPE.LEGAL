import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import {
  fetchAllPrices,
  storePrices,
  mapeGoldBuyLpsPerGram,
  buildKaratPrices,
  effectivePriceDate,
  MAPE_GOLD_BUY_FACTOR,
} from '@/services/pricingService';
import { getCombustibles } from '@/services/combustiblesService';
import { type Combustible } from '@/lib/types/combustible';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

// Public, unauthenticated snapshot for the live-prices widget (/precios) and any
// other surface that wants the same numbers María quotes. Reads gold/FX from
// precios_diarios (service-role — anon has no SELECT on that table per migration
// 009), and joins the SEN-set diesel/fuel prices.
//
// PRICE FREEZE — the gold snapshot updates once per day at 08:00 Honduras. The
// row is keyed by effectivePriceDate() (the 8 AM window). When that row already
// exists the price is served as-is and NEVER re-fetched, so it stays frozen for
// the whole 08:00→08:00 window. Only when the window's row is missing (cron
// didn't run, or first visitor of the day) does one timeout-bounded live fetch
// capture the snapshot and write it back. The response carries the real capture
// timestamp (fetched_at) so the number is verifiable.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// fetchAllPrices fans out to GoldAPI/Yahoo/exchangerate-api. Bound it so a single
// stalled upstream can't pin the function — mirrors PRICE_FETCH_TIMEOUT_MS in
// app/api/maria/chat/route.ts.
const PRICE_FETCH_TIMEOUT_MS = 8000;

// Public endpoint that can trigger a live upstream fetch on cold cache — throttle
// per IP the same way the other public surfaces do (equipos is 60/5min). The
// cache write-back means only the first miss of the day pays the upstream cost.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60_000;

interface PriceRow {
  oro: number | null;
  plata: number | null;
  usd_hnl: number | null;
  fecha: string | null;
  fuente: string | null;
  fetched_at: string | null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dieselFrom(combustibles: Combustible[]): Combustible | null {
  return combustibles.find((c) => c.combustible === 'diesel') ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFrom(request);
    const rl = checkRateLimit(`precios-live:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    // The 8 AM Honduras window this request belongs to. storePrices() keys the
    // row by the same value, so a hit here means the snapshot is already frozen.
    const priceDate = effectivePriceDate();

    let row: PriceRow | null = null;

    try {
      const admin = getAdminClient();
      const { data } = await admin
        .from('precios_diarios')
        .select('oro, plata, usd_hnl, fecha, fuente, fetched_at')
        .eq('fecha', priceDate)
        .maybeSingle();
      if (data && num(data.oro) && num(data.oro)! > 0) {
        row = data as unknown as PriceRow;
      }
    } catch (e) {
      console.error('[api/precios/live] cache read failed:', (e as Error)?.message);
    }

    // Window's row missing → the daily snapshot hasn't been captured yet (cron
    // didn't run, or this is the first visitor after 08:00). Capture it ONCE:
    // a timeout-bounded live fetch, then write-back keyed to this window so every
    // later request in the window reads the frozen row instead of re-fetching.
    if (!row) {
      try {
        const live = await Promise.race<Awaited<ReturnType<typeof fetchAllPrices>> | null>([
          fetchAllPrices(),
          new Promise((resolve) => setTimeout(() => resolve(null), PRICE_FETCH_TIMEOUT_MS)),
        ]);
        if (live && live.oro != null && live.oro > 0) {
          row = {
            oro: live.oro,
            plata: live.plata,
            usd_hnl: live.usd_hnl,
            fecha: priceDate,
            fuente: live.fuente,
            fetched_at: live.fetched_at,
          };
          storePrices(live, priceDate).catch((e) =>
            console.warn('[api/precios/live] cache write failed (non-fatal):', (e as Error)?.message),
          );
        } else if (!live) {
          console.error('[api/precios/live] live fetch timed out after', PRICE_FETCH_TIMEOUT_MS, 'ms');
        }
      } catch (e) {
        console.error('[api/precios/live] live fetch failed:', (e as Error)?.message);
      }
    }

    // Fuel prices are non-fatal — an empty list just hides the diesel card.
    let combustibles: Combustible[] = [];
    try {
      combustibles = await getCombustibles();
    } catch (e) {
      console.error('[api/precios/live] combustibles read failed:', (e as Error)?.message);
    }
    const diesel = dieselFrom(combustibles);

    const oro = row ? num(row.oro) : null;
    const plata = row ? num(row.plata) : null;
    const usd_hnl = row ? num(row.usd_hnl) : null;
    const oro_lps_oz = oro != null && usd_hnl != null ? oro * usd_hnl : null;
    const oro_compra_lps_gramo = mapeGoldBuyLpsPerGram(oro, usd_hnl);
    // Per-karat conversion (16/18/20/22 k) derived server-side from the same
    // frozen snapshot — the widget renders these values verbatim so the karat
    // table can never drift from the daily price.
    const kilates = buildKaratPrices(oro, usd_hnl);

    const hnStamp = (iso: string) =>
      new Date(iso).toLocaleString('es-HN', {
        timeZone: 'America/Tegucigalpa',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });

    // When you're viewing (query time).
    const consultado_hn = hnStamp(new Date().toISOString());
    // Verification timestamp — when the snapshot was actually captured from the
    // upstream (precios_diarios.fetched_at), formatted in Honduras time. This is
    // the number a buyer/miner can trust: it's the daily 8 AM capture, not now.
    const actualizado_hn =
      row?.fetched_at && !Number.isNaN(new Date(row.fetched_at).getTime())
        ? hnStamp(row.fetched_at)
        : null;

    return NextResponse.json(
      {
        fecha: row?.fecha ?? priceDate,
        fetched_at: row?.fetched_at ?? null,
        fuente: row?.fuente ?? null,
        consultado_hn,
        actualizado_hn,
        mape_factor: MAPE_GOLD_BUY_FACTOR,
        oro_usd_oz: oro,
        plata_usd_oz: plata,
        usd_hnl,
        oro_lps_oz,
        oro_compra_lps_gramo,
        kilates,
        diesel: diesel
          ? {
              precio_hnl: diesel.precio_hnl,
              unidad: diesel.unidad,
              zona: diesel.zona,
              vigente_desde: diesel.vigente_desde,
              fuente: diesel.fuente,
            }
          : null,
        combustibles: combustibles.map((c) => ({
          combustible: c.combustible,
          precio_hnl: c.precio_hnl,
          unidad: c.unidad,
          zona: c.zona,
          vigente_desde: c.vigente_desde,
          fuente: c.fuente,
        })),
      },
      {
        headers: {
          // Short shared-cache TTL keeps the numbers fresh while shielding the
          // upstreams from a burst; SWR serves the last snapshot while revalidating.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    console.error('[api/precios/live] GET error:', err);
    return NextResponse.json({ error: 'Error al cargar precios' }, { status: 500 });
  }
}
