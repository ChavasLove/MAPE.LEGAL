import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import {
  fetchAllPrices,
  storePrices,
  oroLpsPorGramoFino,
  oroLpsPorOnza,
  buildKaratPrices,
  effectivePriceDate,
  etiquetaFuenteOro,
  parseFuente,
  resolverTipoCambioBch,
} from '@/services/pricingService';
import { etiquetaTipoCambio } from '@/lib/precio/bch';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import {
  AVISO_PRECIO_INFORMATIVO,
  FORMULA_PRECIO_INFORMATIVO,
  FUENTE_TIPO_CAMBIO,
  ROTULO_PRECIO_INFORMATIVO,
  SOLO_INFORMATIVO,
} from '@/lib/content/copy-legal';

// Public, unauthenticated snapshot for the daily-prices widget (/precios) and any
// other surface that wants the same numbers María quotes.
//
// DEC-2026-11-26-1 / DEC-2026-11-27-2 — precio SOLO INFORMATIVO, sin factor:
//   L/g fino = oro USD/oz × tipo de COMPRA del BCH ÷ 31.1034768
// El oro sale del snapshot diario (precios_diarios, service-role — anon has no
// SELECT per migration 009) etiquetado con su fuente REAL (goldapi.io / Yahoo),
// nunca "LBMA oficial". El tipo de cambio sale ÚNICAMENTE del adaptador del BCH
// (en el snapshot si se leyó del BCH al capturarlo; si no, en vivo o del último
// valor registrado, con su fecha). Si falta un insumo, el campo es null y la UI
// dice "dato no disponible" — nunca una cifra inventada.
//
// PRICE FREEZE — the gold snapshot updates once per day at 08:00 Honduras. The
// row is keyed by effectivePriceDate() (the 8 AM window). When that row already
// exists the gold price is served as-is and NEVER re-fetched. Only when the
// window's row is missing does one timeout-bounded live fetch capture the
// snapshot and write it back. The response carries the real capture timestamp.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// fetchAllPrices fans out to GoldAPI/Yahoo/BCH. Bound it so a single stalled
// upstream can't pin the function — mirrors PRICE_FETCH_TIMEOUT_MS in
// app/api/maria/chat/route.ts.
const PRICE_FETCH_TIMEOUT_MS = 8000;

// Public endpoint that can trigger a live upstream fetch on cold cache — throttle
// per IP the same way the other public surfaces do.
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

const hnStamp = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

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

    // Window's row missing → capture it ONCE (timeout-bounded), then write-back
    // keyed to this window so later requests read the frozen row.
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

    const oro = row ? num(row.oro) : null;
    const plata = row ? num(row.plata) : null;

    // Tipo de cambio: SOLO del BCH. Si el snapshot lo trae marcado fx:bch se usa
    // tal cual; si no, el adaptador resuelve en vivo o con el último valor
    // registrado (con su fecha). Sin dato del BCH → null.
    const tipoCambio = await resolverTipoCambioBch(row);
    const tipo_cambio_compra_bch = tipoCambio?.compra ?? null;

    const oro_lps_oz = oroLpsPorOnza(oro, tipo_cambio_compra_bch);
    const oro_lps_gramo_fino = oroLpsPorGramoFino(oro, tipo_cambio_compra_bch);
    const kilates = buildKaratPrices(oro, tipo_cambio_compra_bch);

    const consultado_hn = hnStamp(new Date().toISOString());
    const actualizado_hn = hnStamp(row?.fetched_at ?? null);
    const { oro: oroFuenteId } = parseFuente(row?.fuente);

    return NextResponse.json(
      {
        fecha: row?.fecha ?? priceDate,
        fetched_at: row?.fetched_at ?? null,
        consultado_hn,
        actualizado_hn,
        rotulo: ROTULO_PRECIO_INFORMATIVO,
        caracter: SOLO_INFORMATIVO,
        formula: FORMULA_PRECIO_INFORMATIVO,
        // La plataforma no interviene en la transacción: campo siempre null.
        comprador: null,
        // ── Oro (fuente real del feed; nunca "LBMA oficial") ──
        oro_usd_oz: oro,
        oro_fuente: oroFuenteId || null,
        oro_fuente_etiqueta: etiquetaFuenteOro(row?.fuente),
        oro_fecha: actualizado_hn,
        // Compatibilidad con clientes cacheados: `fuente` = fuente del oro.
        fuente: oroFuenteId || null,
        plata_usd_oz: plata,
        // ── Tipo de cambio de COMPRA del BCH (único admitido) ──
        tipo_cambio_compra_bch,
        tipo_cambio_venta_bch: tipoCambio?.venta ?? null,
        tipo_cambio_fuente: tipoCambio ? FUENTE_TIPO_CAMBIO : null,
        tipo_cambio_etiqueta: etiquetaTipoCambio(tipoCambio),
        tipo_cambio_fecha: tipoCambio?.fecha ?? null,
        tipo_cambio_obtenido_hn: hnStamp(tipoCambio?.obtenidoEn ?? null),
        tipo_cambio_origen: tipoCambio?.origen ?? null,
        // Alias de compatibilidad: usd_hnl SOLO lleva el tipo de compra del BCH.
        usd_hnl: tipo_cambio_compra_bch,
        // ── Resultado: solo informativo, sin factor ──
        oro_lps_oz,
        oro_lps_gramo_fino,
        kilates,
        aviso: AVISO_PRECIO_INFORMATIVO,
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
