import { getAdminClient } from '@/services/adminSupabase';

export interface PreciosDiarios {
  oro: number | null;
  plata: number | null;
  usd_hnl: number | null;
  cobre: number | null;
  fuente: string;
  fetched_at: string;
}

// External price feeds (GoldAPI / Yahoo / exchangerate-api) intermittently hang;
// Yahoo's COMEX query in particular can stall past 30s. Without a hard timeout
// the bare fetch can pin runDailyBroadcast past Vercel's 60s function ceiling
// — the 8 AM cron then silently misses its window with no broadcast_log entry.
// 8 s matches PRICE_FETCH_TIMEOUT_MS in app/api/maria/chat/route.ts.
const FETCH_TIMEOUT_MS = 8000;

// 1 troy ounce = 31.1034768 grams (LBMA standard). Single source of truth so
// the boletín diario, María's WhatsApp reply, and the web widget all quote
// the same price-per-gram — a 31.1035 round-off elsewhere produces a 0.0008%
// drift that a client comparing two replies would notice.
export const TROY_OUNCE_GRAMS = 31.1034768;

// MAPE LEGAL buy factor over the international reference price — the current
// value is governed by the published, versioned Política de Precios
// (/politica-de-precios); do not state the figure in prose. Single source of
// truth so the boletín diario, María (WhatsApp + web) and the /precios widget
// all quote the same purchase price — a divergent factor or troy-ounce
// constant here is exactly the drift the codebase already guards against.
export const MAPE_GOLD_BUY_FACTOR = 0.8;

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

/**
 * MAPE LEGAL gold purchase price in Lempiras per gram.
 * = international USD/oz × factor de la Política de Precios × USD/HNL
 *   ÷ troy-ounce-grams.
 * Returns null when either input is missing or non-positive.
 */
export function mapeGoldBuyLpsPerGram(
  oroUsdOz: number | null | undefined,
  usdHnl: number | null | undefined,
): number | null {
  if (!oroUsdOz || oroUsdOz <= 0 || !usdHnl || usdHnl <= 0) return null;
  return (oroUsdOz * MAPE_GOLD_BUY_FACTOR * usdHnl) / TROY_OUNCE_GRAMS;
}

// ─── Conversión por kilates ───────────────────────────────────────────────────
//
// Ley nominal = kilates ÷ 24 (fracción de oro fino contenida en el material).
// Los valores por kilate son aritmética sobre el snapshot diario de las 8 AM —
// en una compra real el contenido de oro fino se determina por ensaye, no por
// el kilataje declarado. Single source of truth: /api/precios/live (widget de
// /precios), el boletín diario y María (WhatsApp + web) consumen este helper
// para que los cuatro canales muestren exactamente los mismos números.
export const GOLD_KARATS = [16, 18, 20, 22] as const;

export interface KaratPrice {
  kilates: number;
  /** Ley nominal — fracción de oro fino (kilates ÷ 24). */
  ley: number;
  /** Valor internacional del oro contenido en 1 g de material, en USD. */
  oro_usd_g: number;
  /** Valor internacional del oro contenido en 1 g de material, en Lempiras. */
  oro_lps_g: number;
  /** Referencia MAPE.LEGAL aplicada al contenido nominal de oro fino, L por 1 g de material. */
  referencia_lps_g: number;
}

export function buildKaratPrices(
  oroUsdOz: number | null | undefined,
  usdHnl: number | null | undefined,
): KaratPrice[] | null {
  if (!oroUsdOz || oroUsdOz <= 0 || !usdHnl || usdHnl <= 0) return null;
  const refLpsPerFineGram = mapeGoldBuyLpsPerGram(oroUsdOz, usdHnl);
  if (refLpsPerFineGram == null) return null;
  const usdPerFineGram = oroUsdOz / TROY_OUNCE_GRAMS;
  return GOLD_KARATS.map((kilates) => {
    const ley = kilates / 24;
    return {
      kilates,
      ley,
      oro_usd_g: usdPerFineGram * ley,
      oro_lps_g: usdPerFineGram * usdHnl * ley,
      referencia_lps_g: refLpsPerFineGram * ley,
    };
  });
}

// ─── Fuentes con prioridad ────────────────────────────────────────────────────

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
    return data.price ?? null;
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
    return data.price ?? null;
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
    return { gold, silver };
  } catch (e) {
    console.error('[pricingService] Yahoo Finance failed:', e);
    return { gold: null, silver: null };
  }
}

async function fetchExchangeRate(): Promise<number | null> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const url = apiKey
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    : 'https://api.exchangerate-api.com/v4/latest/USD';

  try {
    const res = await fetch(url, {
      cache:  'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`exchangerate-api ${res.status}`);
    const data = (await res.json()) as {
      rates?: Record<string, number>;
      conversion_rates?: Record<string, number>;
    };
    const rate = data.conversion_rates?.HNL ?? data.rates?.HNL ?? null;
    console.log('[pricingService] USD/HNL:', rate);
    return rate ?? null;
  } catch (e) {
    console.error('[pricingService] FX failed:', e);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchGoldPrice(): Promise<number | null> {
  const fromGoldApi = await fetchGoldFromGoldAPI();
  if (fromGoldApi !== null) return fromGoldApi;
  const yahoo = await fetchMetalsFromYahoo();
  return yahoo.gold;
}

export async function fetchSilverPrice(): Promise<number | null> {
  const fromGoldApi = await fetchSilverFromGoldAPI();
  if (fromGoldApi !== null) return fromGoldApi;
  const yahoo = await fetchMetalsFromYahoo();
  return yahoo.silver;
}

export async function fetchUSDHNL(): Promise<number | null> {
  return fetchExchangeRate();
}

export async function fetchCopperPrice(): Promise<number | null> {
  // GoldAPI free tier no cubre cobre — null por ahora
  return null;
}

export async function fetchAllPrices(): Promise<PreciosDiarios> {
  const fetched_at = new Date().toISOString();

  // Phase 1 — independent upstreams in parallel. Saves ~1-2 s vs the
  // serial chain on every cold-cache turn and every broadcast cron.
  const [goldApiGold, goldApiSilver, usd_hnl] = await Promise.all([
    fetchGoldFromGoldAPI(),
    fetchSilverFromGoldAPI(),
    fetchExchangeRate(),
  ]);

  let oro = goldApiGold;
  let plata = goldApiSilver;
  // Track exactly which upstreams contributed a non-null metal. The
  // previous code stamped 'yahoo-finance' whenever Yahoo ran (even if
  // Yahoo only filled silver and gold actually came from GoldAPI) —
  // an honest label needs per-metal accounting.
  const sources = new Set<string>();
  if (goldApiGold !== null || goldApiSilver !== null) sources.add('goldapi.io');

  // Phase 2 — Yahoo backfill, only for metals GoldAPI didn't supply.
  if (oro === null || plata === null) {
    console.log('[pricingService] Falling back to Yahoo Finance for missing metals...');
    const yahoo = await fetchMetalsFromYahoo();
    if (oro === null && yahoo.gold !== null) {
      oro = yahoo.gold;
      sources.add('yahoo-finance');
    }
    if (plata === null && yahoo.silver !== null) {
      plata = yahoo.silver;
      sources.add('yahoo-finance');
    }
  }

  const cobre = null;
  const fuente = sources.size === 0 ? 'failed-all-sources' : [...sources].join(', ');

  if (oro === null) {
    console.error('[pricingService] CRITICAL: No gold price from any source.');
  }

  return { oro, plata, usd_hnl, cobre, fuente, fetched_at };
}

// Persist an already-fetched PreciosDiarios snapshot. Extracted so callers
// that have just done their own fetchAllPrices() (María webhook + web widget)
// can write-back the cache without paying for a second round-trip to
// GoldAPI/Yahoo/exchangerate-api — the prior pattern fan-out was 2× the
// upstream calls per cold-cache turn.
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
