import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import {
  fetchAllPrices,
  storePrices,
  mapeGoldBuyLpsPerGram,
  MAPE_GOLD_BUY_FACTOR,
} from '@/services/pricingService';
import { getCombustibles } from '@/services/combustiblesService';
import { type Combustible } from '@/lib/types/combustible';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

// Public, unauthenticated snapshot for the live-prices widget (/precios) and any
// other surface that wants the same numbers María quotes. Reads live gold/silver/FX
// from precios_diarios (service-role — anon has no SELECT on that table per
// migration 009), does a timeout-bounded live fetch + cache write-back when the
// day's row is missing, and joins the SEN-set diesel/fuel prices.
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

    // UTC date — matches storePrices()'s cache key so the read never misses the
    // row it wrote near a Honduras-midnight boundary.
    const today = new Date().toISOString().slice(0, 10);

    let row: PriceRow | null = null;

    try {
      const admin = getAdminClient();
      const { data } = await admin
        .from('precios_diarios')
        .select('oro, plata, usd_hnl, fecha, fuente, fetched_at')
        .eq('fecha', today)
        .maybeSingle();
      if (data && num(data.oro) && num(data.oro)! > 0) {
        row = data as unknown as PriceRow;
      }
    } catch (e) {
      console.error('[api/precios/live] cache read failed:', (e as Error)?.message);
    }

    // Cold cache → live fetch bounded by a hard timeout, then write-back so the
    // next caller hits the DB row instead of re-fanning out to the upstreams.
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
            fecha: today,
            fuente: live.fuente,
            fetched_at: live.fetched_at,
          };
          storePrices(live).catch((e) =>
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

    const consultado_hn = new Date().toLocaleString('es-HN', {
      timeZone: 'America/Tegucigalpa',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    return NextResponse.json(
      {
        fecha: row?.fecha ?? today,
        fetched_at: row?.fetched_at ?? null,
        fuente: row?.fuente ?? null,
        consultado_hn,
        mape_factor: MAPE_GOLD_BUY_FACTOR,
        oro_usd_oz: oro,
        plata_usd_oz: plata,
        usd_hnl,
        oro_lps_oz,
        oro_compra_lps_gramo,
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
