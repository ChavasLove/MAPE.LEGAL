import { getAdminClient } from '@/services/adminSupabase';
import {
  BCH_NOMBRE,
  FUENTE_TIPO_CAMBIO_ID,
  esTipoCambioValido,
  getTipoCambioBch,
  type TipoCambioBch,
} from '@/lib/precio/bch';

// ---------------------------------------------------------------------------
// Precio en vivo, solo informativo (DEC-2026-11-26-1 / DEC-2026-11-27-2).
//
//   L por gramo de oro fino = (USD/oz) × (tipo de COMPRA del BCH, L por USD) ÷ 31.1034768
//
// Sin factor de compra: ningún 75/80/90 % de la referencia internacional sale
// de este módulo hacia una superficie pública, una API pública ni María. El
// oro viene de un feed en vivo etiquetado con su fuente REAL (goldapi.io o
// Yahoo Finance; nunca "LBMA oficial"). El tipo de cambio viene únicamente del
// adaptador del BCH (lib/precio/bch.ts); si no hay dato del BCH, el valor es
// null y lo público muestra "dato no disponible".
// ---------------------------------------------------------------------------

export interface PreciosDiarios {
  oro: number | null;
  plata: number | null;
  /** Tipo de cambio de COMPRA del BCH (L por USD) leído EN VIVO; null si no se obtuvo del BCH. */
  usd_hnl: number | null;
  cobre: number | null;
  /** Procedencia: fuente(s) del oro + marcador `fx:bch` cuando usd_hnl es del BCH. Ver componerFuente(). */
  fuente: string;
  fetched_at: string;
}

// External price feeds (GoldAPI / Yahoo / BCH) intermittently hang; Yahoo's
// COMEX query in particular can stall past 30s. Without a hard timeout the
// bare fetch can pin runDailyBroadcast past Vercel's 60s function ceiling —
// the 8 AM cron then silently misses its window with no broadcast_log entry.
// 8 s matches PRICE_FETCH_TIMEOUT_MS in app/api/maria/chat/route.ts and
// BCH_FETCH_TIMEOUT_MS in lib/precio/bch.ts.
export const FETCH_TIMEOUT_MS = 8000;

// 1 troy ounce = 31.1034768 grams. Constante canónica ÚNICA de la plataforma
// (lib/precio/calculo.ts la re-exporta como GRAMOS_POR_ONZA_TROY). El antiguo
// 31.1035 ya no se usa en ningún cálculo público.
export const TROY_OUNCE_GRAMS = 31.1034768;

// The public price is a single daily snapshot anchored to 08:00 Honduras time.
// The cron, the cold-cache fetch, and María all key precios_diarios by
// effectivePriceDate() so the displayed price is captured once per day at 8 AM
// and stays frozen until the next 8 AM — it must NOT churn mid-day when the raw
// UTC calendar rolls over at 6 PM Honduras (the old toISOString().slice(0,10)
// key). See app/api/precios/live/route.ts for how the freeze is enforced.
export const PRICE_REFRESH_HOUR_HN = 8;

/**
 * The Honduras date (YYYY-MM-DD) of the 08:00 window the given instant belongs
 * to. Before 08:00 Honduras the snapshot still belongs to yesterday's window,
 * so the date is rolled back one day. This is the single price-cache key.
 */
export function effectivePriceDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const hour = Number(get('hour'));
  // Date-only math on a UTC anchor once we have the Honduras Y/M/D — no further
  // TZ conversion needed. Rolling back a day handles month/year boundaries.
  const anchor = new Date(Date.UTC(y, m - 1, d));
  if (hour < PRICE_REFRESH_HOUR_HN) anchor.setUTCDate(anchor.getUTCDate() - 1);
  return anchor.toISOString().slice(0, 10);
}

/* ── Fórmula canónica ──────────────────────────────────────────────────── */

function insumoPositivo(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Precio internacional del oro en lempiras por gramo de ORO FINO.
 * = USD/oz × tipo de compra del BCH (L por USD) ÷ 31.1034768.
 * Sin factor de compra. Devuelve null si un insumo falta, es 0, negativo o no
 * finito — nunca una cifra inventada.
 */
export function oroLpsPorGramoFino(
  oroUsdOz: number | null | undefined,
  tipoCompraBch: number | null | undefined,
): number | null {
  if (!insumoPositivo(oroUsdOz) || !insumoPositivo(tipoCompraBch)) return null;
  return (oroUsdOz * tipoCompraBch) / TROY_OUNCE_GRAMS;
}

/** Oro en lempiras por onza troy (USD/oz × tipo de compra del BCH); null sin insumos válidos. */
export function oroLpsPorOnza(
  oroUsdOz: number | null | undefined,
  tipoCompraBch: number | null | undefined,
): number | null {
  if (!insumoPositivo(oroUsdOz) || !insumoPositivo(tipoCompraBch)) return null;
  return oroUsdOz * tipoCompraBch;
}

// ─── Conversión por kilates ───────────────────────────────────────────────────
//
// Ley nominal = kilates ÷ 24 (fracción de oro fino contenida en el material).
// Valor por kilate = (L por gramo de oro fino) × ley — SIN ningún factor de
// compra. En una transacción real el contenido de oro fino se determina por
// ensaye, no por el kilataje declarado. Single source of truth: /api/precios/live
// (tabla de /precios), el boletín diario y María (WhatsApp + web) consumen este
// helper para que los cuatro canales muestren exactamente los mismos números.
export const GOLD_KARATS = [16, 18, 20, 22] as const;

// 1 penique (pennyweight, dwt) = 1/20 de onza troy = 1.55517384 g. Unidad de
// uso corriente en el comercio de oro artesanal en Centroamérica; los valores
// por penique se derivan de los valores por gramo con esta constante — nunca
// re-derivar desde la onza en un caller (drift de redondeo).
export const PENNYWEIGHT_GRAMS = TROY_OUNCE_GRAMS / 20;

export interface KaratPrice {
  kilates: number;
  /** Ley nominal — fracción de oro fino (kilates ÷ 24). */
  ley: number;
  /** Valor internacional del oro contenido en 1 g de material, en USD. */
  oro_usd_g: number;
  /** Valor del oro contenido en 1 g de material, en lempiras (L/g fino × ley). */
  oro_lps_g: number;
  /** Valor internacional del oro contenido en 1 penique (dwt) de material, en USD. */
  oro_usd_dwt: number;
  /** Valor del oro contenido en 1 penique (dwt) de material, en lempiras. */
  oro_lps_dwt: number;
}

// Devuelve null solo sin insumos válidos (ver oroLpsPorGramoFino).
export function buildKaratPrices(
  oroUsdOz: number | null | undefined,
  tipoCompraBch: number | null | undefined,
): KaratPrice[] | null {
  const lpsPorGramoFino = oroLpsPorGramoFino(oroUsdOz, tipoCompraBch);
  if (lpsPorGramoFino == null || !insumoPositivo(oroUsdOz)) return null;
  const usdPerFineGram = oroUsdOz / TROY_OUNCE_GRAMS;
  return GOLD_KARATS.map((kilates) => {
    const ley = kilates / 24;
    const oro_usd_g = usdPerFineGram * ley;
    const oro_lps_g = lpsPorGramoFino * ley;
    return {
      kilates,
      ley,
      oro_usd_g,
      oro_lps_g,
      oro_usd_dwt: oro_usd_g * PENNYWEIGHT_GRAMS,
      oro_lps_dwt: oro_lps_g * PENNYWEIGHT_GRAMS,
    };
  });
}

/* ── Fuente del oro internacional — puerto + implementaciones ─────────── */

/** Identificadores de fuente del oro. 'lbma-oficial' es un puerto PENDIENTE sin implementación. */
export type FuenteOroId = 'goldapi.io' | 'yahoo-finance' | 'lbma-oficial';

export interface FuenteOroInternacional {
  id: FuenteOroId;
  /** Etiqueta pública honesta. Nunca "LBMA oficial" ni "fixing" para un feed que no lo es. */
  etiqueta: string;
  /** Devuelve USD por onza troy o null si no hay dato. Nunca inventa. */
  obtener(): Promise<number | null>;
}

const ETIQUETAS_ORO: Record<FuenteOroId, string> = {
  'goldapi.io': 'Precio internacional del oro (goldapi.io)',
  'yahoo-finance': 'Precio internacional del oro (Yahoo Finance, futuros COMEX)',
  'lbma-oficial': 'Precio LBMA oficial — pendiente de conexión',
};

/** Etiqueta pública de una fuente del oro a partir de su identificador o de `precios_diarios.fuente`. */
export function etiquetaFuenteOro(fuente: string | null | undefined): string {
  const { oro } = parseFuente(fuente);
  const ids = oro.split(',').map((s) => s.trim()).filter(Boolean) as FuenteOroId[];
  const conocidas = ids.filter((id) => id in ETIQUETAS_ORO);
  if (conocidas.length === 0) return 'Precio internacional del oro (fuente no registrada)';
  if (conocidas.length === 1) return ETIQUETAS_ORO[conocidas[0]];
  return `Precio internacional del oro (${conocidas.join(', ')})`;
}

async function fetchGoldFromGoldAPI(): Promise<number | null> {
  const apiKey = process.env.GOLDAPI_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
      cache:  'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`goldapi ${res.status}`);
    const data = (await res.json()) as { price?: number };
    console.log('[pricingService] goldapi.io XAU/USD:', data.price);
    return insumoPositivo(data.price) ? data.price : null;
  } catch (e) {
    console.error('[pricingService] goldapi gold failed:', e);
    return null;
  }
}

async function fetchSilverFromGoldAPI(): Promise<number | null> {
  const apiKey = process.env.GOLDAPI_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://www.goldapi.io/api/XAG/USD', {
      headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
      cache:  'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`goldapi silver ${res.status}`);
    const data = (await res.json()) as { price?: number };
    return insumoPositivo(data.price) ? data.price : null;
  } catch (e) {
    console.error('[pricingService] goldapi silver failed:', e);
    return null;
  }
}

async function fetchMetalsFromYahoo(): Promise<{ gold: number | null; silver: number | null }> {
  try {
    const [goldRes, silverRes] = await Promise.allSettled([
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=1d', {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        cache:  'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/SI%3DF?interval=1d&range=1d', {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        cache:  'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
    ]);

    let gold: number | null = null;
    let silver: number | null = null;

    if (goldRes.status === 'fulfilled' && goldRes.value.ok) {
      const d = (await goldRes.value.json()) as {
        chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
      };
      gold = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
    if (silverRes.status === 'fulfilled' && silverRes.value.ok) {
      const d = (await silverRes.value.json()) as {
        chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
      };
      silver = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }

    console.log('[pricingService] Yahoo Finance:', { gold, silver });
    return { gold: insumoPositivo(gold) ? gold : null, silver: insumoPositivo(silver) ? silver : null };
  } catch (e) {
    console.error('[pricingService] Yahoo Finance failed:', e);
    return { gold: null, silver: null };
  }
}

/** Fuente primaria del oro: goldapi.io (spot). */
export const FUENTE_ORO_GOLDAPI: FuenteOroInternacional = {
  id: 'goldapi.io',
  etiqueta: ETIQUETAS_ORO['goldapi.io'],
  obtener: fetchGoldFromGoldAPI,
};

/** Respaldo del oro: Yahoo Finance (futuros COMEX GC=F). */
export const FUENTE_ORO_YAHOO: FuenteOroInternacional = {
  id: 'yahoo-finance',
  etiqueta: ETIQUETAS_ORO['yahoo-finance'],
  obtener: async () => (await fetchMetalsFromYahoo()).gold,
};

/**
 * Puerto para el precio LBMA oficial. PENDIENTE: no está conectado y NO forma
 * parte de la rotación de fuentes. Conectarlo exige un contrato/licencia con el
 * proveedor oficial de datos de la LBMA (decisión de negocio [POR CONFIRMAR]).
 * Mientras tanto devuelve null — nunca un número inventado.
 */
export const FUENTE_ORO_LBMA_OFICIAL: FuenteOroInternacional = {
  id: 'lbma-oficial',
  etiqueta: ETIQUETAS_ORO['lbma-oficial'],
  obtener: async () => null,
};

/** Rotación vigente de fuentes del oro, en orden de prioridad. LBMA oficial NO está aquí. */
export const FUENTES_ORO: readonly FuenteOroInternacional[] = [FUENTE_ORO_GOLDAPI, FUENTE_ORO_YAHOO];

/* ── Procedencia compuesta en precios_diarios.fuente ─────────────────── */

/** Marcador que, presente en `precios_diarios.fuente`, declara que `usd_hnl` es el tipo de compra del BCH leído en vivo. */
export const FX_MARCADOR_BCH = 'fx:bch';

/** Compone el campo `fuente`: fuentes del oro + marcador del BCH si el FX es del BCH. */
export function componerFuente(oroFuente: string, fxBch: boolean): string {
  return fxBch ? `${oroFuente} | ${FX_MARCADOR_BCH}` : oroFuente;
}

/** Descompone `precios_diarios.fuente` en fuente(s) del oro y si el FX proviene del BCH. */
export function parseFuente(fuente: string | null | undefined): { oro: string; fxBch: boolean } {
  if (!fuente) return { oro: '', fxBch: false };
  const partes = fuente.split('|').map((s) => s.trim());
  const fxBch = partes.includes(FX_MARCADOR_BCH);
  const oro = partes.filter((p) => p !== FX_MARCADOR_BCH).join(' | ');
  return { oro, fxBch };
}

/* ── Public API ───────────────────────────────────────────────────────── */

export async function fetchGoldPrice(): Promise<number | null> {
  for (const fuente of FUENTES_ORO) {
    const v = await fuente.obtener();
    if (v !== null) return v;
  }
  return null;
}

export async function fetchSilverPrice(): Promise<number | null> {
  const fromGoldApi = await fetchSilverFromGoldAPI();
  if (fromGoldApi !== null) return fromGoldApi;
  const yahoo = await fetchMetalsFromYahoo();
  return yahoo.silver;
}

/**
 * Tipo de cambio de compra del BCH (adaptador lib/precio/bch.ts, con caché y
 * respaldos). Null = "dato no disponible". Sustituye al antiguo
 * fetchExchangeRate() de exchangerate-api.com, que ya no alimenta lo público.
 */
export async function fetchTipoCambioBch(): Promise<TipoCambioBch | null> {
  return getTipoCambioBch();
}

export async function fetchCopperPrice(): Promise<number | null> {
  // GoldAPI free tier no cubre cobre — null por ahora
  return null;
}

export async function fetchAllPrices(): Promise<PreciosDiarios> {
  const fetched_at = new Date().toISOString();

  // Phase 1 — independent upstreams in parallel. Saves ~1-2 s vs the
  // serial chain on every cold-cache turn and every broadcast cron.
  const [goldApiGold, goldApiSilver, tipoCambio] = await Promise.all([
    fetchGoldFromGoldAPI(),
    fetchSilverFromGoldAPI(),
    getTipoCambioBch(),
  ]);

  let oro = goldApiGold;
  let plata = goldApiSilver;
  // Track exactly which upstreams contributed a non-null metal — an honest
  // label needs per-metal accounting.
  const sources = new Set<string>();
  if (goldApiGold !== null || goldApiSilver !== null) sources.add(FUENTE_ORO_GOLDAPI.id);

  // Phase 2 — Yahoo backfill, only for metals GoldAPI didn't supply.
  if (oro === null || plata === null) {
    console.log('[pricingService] Falling back to Yahoo Finance for missing metals...');
    const yahoo = await fetchMetalsFromYahoo();
    if (oro === null && yahoo.gold !== null) {
      oro = yahoo.gold;
      sources.add(FUENTE_ORO_YAHOO.id);
    }
    if (plata === null && yahoo.silver !== null) {
      plata = yahoo.silver;
      sources.add(FUENTE_ORO_YAHOO.id);
    }
  }

  const cobre = null;
  const oroFuente = sources.size === 0 ? 'failed-all-sources' : [...sources].join(', ');

  // Solo un dato del BCH leído EN VIVO se persiste como tipo de cambio del día.
  // Un respaldo (último valor guardado) no se congela en el snapshot: se
  // vuelve a resolver en lectura con su propia fecha visible.
  const fxVivo = tipoCambio?.origen === 'vivo' && esTipoCambioValido(tipoCambio.compra);
  const usd_hnl = fxVivo ? tipoCambio!.compra : null;
  const fuente = componerFuente(oroFuente, fxVivo);

  if (oro === null) {
    console.error('[pricingService] CRITICAL: No gold price from any source.');
  }
  if (!fxVivo) {
    console.warn('[pricingService] tipo de cambio del BCH no disponible en vivo; usd_hnl=null en el snapshot');
  }

  return { oro, plata, usd_hnl, cobre, fuente, fetched_at };
}

/**
 * Lee el tipo de cambio del BCH registrado en el snapshot de la ventana diaria
 * actual (precios_diarios con marcador fx:bch). Respaldo de nivel 1 del
 * adaptador: es un dato del BCH capturado hoy por otra instancia/cron.
 */
export async function leerTipoCambioBchSnapshotHoy(): Promise<TipoCambioBch | null> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('precios_diarios')
      .select('usd_hnl, fuente, fetched_at, fecha')
      .eq('fecha', effectivePriceDate())
      .maybeSingle();
    if (error || !data) return null;
    const { fxBch } = parseFuente(data.fuente as string | null);
    const compra = Number(data.usd_hnl);
    if (!fxBch || !esTipoCambioValido(compra)) return null;
    return {
      compra,
      venta: null,
      fuente: FUENTE_TIPO_CAMBIO_ID,
      fuenteNombre: BCH_NOMBRE,
      fecha: String(data.fecha),
      obtenidoEn: String(data.fetched_at ?? new Date().toISOString()),
      origen: 'vivo',
      detalle: 'precios_diarios (snapshot de la ventana 08:00, leído del BCH)',
    };
  } catch (e) {
    console.error('[pricingService] leerTipoCambioBchSnapshotHoy failed:', (e as Error)?.message);
    return null;
  }
}

/**
 * Resuelve el tipo de cambio del BCH para un snapshot ya leído de
 * precios_diarios: si la fila trae el marcador fx:bch, su usd_hnl es del BCH
 * (origen vivo, con la fecha de captura); si no (filas anteriores a esta
 * decisión, o día sin dato), consulta el adaptador con sus respaldos. Nunca
 * devuelve un usd_hnl que no sea del BCH.
 */
export async function resolverTipoCambioBch(row: {
  usd_hnl: number | string | null;
  fuente?: string | null;
  fetched_at?: string | null;
  fecha?: string | null;
} | null): Promise<TipoCambioBch | null> {
  if (row) {
    const { fxBch } = parseFuente(row.fuente);
    const compra = Number(row.usd_hnl);
    if (fxBch && esTipoCambioValido(compra)) {
      return {
        compra,
        venta: null,
        fuente: FUENTE_TIPO_CAMBIO_ID,
        fuenteNombre: BCH_NOMBRE,
        fecha: row.fecha ?? effectivePriceDate(),
        obtenidoEn: row.fetched_at ?? new Date().toISOString(),
        origen: 'vivo',
        detalle: 'precios_diarios (snapshot de la ventana 08:00, leído del BCH)',
      };
    }
  }
  return getTipoCambioBch();
}

// Persist an already-fetched PreciosDiarios snapshot. Extracted so callers
// that have just done their own fetchAllPrices() (María webhook + web widget)
// can write-back the cache without paying for a second round-trip to the
// upstreams.
export async function storePrices(
  precios: PreciosDiarios,
  fecha: string = effectivePriceDate(),
): Promise<string> {
  const admin = getAdminClient();

  // Prefer the SECURITY DEFINER RPC (migration 025) — bypasses RLS regardless
  // of whether service_role has BYPASSRLS in this Supabase project.
  const { data: rpcId, error: rpcError } = await admin.rpc('upsert_precios_diarios', {
    p_fecha:      fecha,
    p_oro:        precios.oro,
    p_plata:      precios.plata,
    p_usd_hnl:    precios.usd_hnl,
    p_cobre:      precios.cobre,
    p_fuente:     precios.fuente,
    p_fetched_at: precios.fetched_at,
  });
  if (!rpcError && rpcId) return rpcId as string;

  // Fallback to direct upsert — only reached when migration 025 has not been
  // applied yet. Logged so the operator notices the missing RPC.
  if (rpcError) {
    console.warn('[pricingService] upsert_precios_diarios RPC failed, falling back to direct upsert:', rpcError.message);
  }
  const { data, error } = await admin
    .from('precios_diarios')
    .upsert(
      { fecha, ...precios, created_at: new Date().toISOString() },
      { onConflict: 'fecha' }
    )
    .select('id')
    .single();

  if (error || !data) throw new Error(`pricingService: store failed — ${error?.message}`);
  return data.id as string;
}

export async function fetchAndStorePrices(): Promise<{ id: string; precios: PreciosDiarios }> {
  const precios = await fetchAllPrices();
  const id = await storePrices(precios);
  return { id, precios };
}

export type DailySnapshotStatus = 'exists' | 'captured' | 'timeout' | 'failed';

/**
 * Garantiza que exista la fila de `precios_diarios` de la ventana 08:00 en curso
 * (`effectivePriceDate()`). Si ya existe con oro > 0 no toca ningún upstream.
 * Si falta, hace UNA captura acotada por `timeoutMs` y la persiste.
 *
 * Por qué existe (auditoría de precios 2026-10): la captura de las 8 AM vivía
 * SOLO dentro de `runDailyBroadcast()`. Cualquier tick del cron que no enviara
 * el boletín (gate `before_scheduled_time`, idempotencia, 500 por config) dejaba
 * el día SIN snapshot, y el primer visitante de /precios lo capturaba a la hora
 * que fuera (filas con `fetched_at` 09:11 y huecos en /api/precios/historial).
 * Los cron la llaman como red de seguridad independiente del boletín.
 */
export async function ensureDailyPriceSnapshot(
  timeoutMs = 8000,
): Promise<{ status: DailySnapshotStatus; fecha: string }> {
  const fecha = effectivePriceDate();
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('precios_diarios')
      .select('oro')
      .eq('fecha', fecha)
      .maybeSingle();
    if (error) {
      console.error('[pricingService] ensureDailyPriceSnapshot read failed:', error.message);
    } else if (data && Number(data.oro) > 0) {
      return { status: 'exists', fecha };
    }

    const live = await Promise.race<PreciosDiarios | null>([
      fetchAllPrices(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!live) {
      console.error(`[pricingService] ensureDailyPriceSnapshot timed out after ${timeoutMs} ms`);
      return { status: 'timeout', fecha };
    }
    if (live.oro == null || live.oro <= 0) {
      console.error('[pricingService] ensureDailyPriceSnapshot: upstream returned no gold price');
      return { status: 'failed', fecha };
    }
    await storePrices(live, fecha);
    console.log(`[pricingService] ensureDailyPriceSnapshot captured fecha=${fecha} fuente=${live.fuente}`);
    return { status: 'captured', fecha };
  } catch (e) {
    console.error('[pricingService] ensureDailyPriceSnapshot failed:', (e as Error)?.message);
    return { status: 'failed', fecha };
  }
}

export async function getLatestPrices(): Promise<(PreciosDiarios & { fecha: string; id: string }) | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('precios_diarios')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(1)
    .single();
  return data as (PreciosDiarios & { fecha: string; id: string }) | null;
}

export async function getPriceHistory(days = 7): Promise<Array<PreciosDiarios & { fecha: string }>> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('precios_diarios')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(days);
  if (error) throw new Error(`pricingService: history failed — ${error.message}`);
  return (data ?? []) as Array<PreciosDiarios & { fecha: string }>;
}

/**
 * Compara el precio del oro registrado en los últimos N días.
 * Si no cambió en >= daysStaleThreshold días consecutivos, alerta posible staleness.
 */
export async function validatePriceFreshness(
  daysStaleThreshold = 2
): Promise<{ isFresh: boolean; daysUnchanged: number; warning: string | null }> {
  const history = await getPriceHistory(5);
  if (history.length < 2) return { isFresh: true, daysUnchanged: 0, warning: null };

  let daysUnchanged = 0;
  const latestPrice = history[0].oro;

  for (let i = 1; i < history.length; i++) {
    if (history[i].oro === latestPrice) daysUnchanged++;
    else break;
  }

  const isFresh = daysUnchanged < daysStaleThreshold;
  const warning = !isFresh
    ? `ALERTA: Precio de oro sin cambiar por ${daysUnchanged} días consecutivos. Posible problema de API.`
    : null;

  return { isFresh, daysUnchanged, warning };
}
