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
export async function storePrices(precios: PreciosDiarios): Promise<string> {
  const admin = getAdminClient();
  const fecha = new Date().toISOString().slice(0, 10);

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
