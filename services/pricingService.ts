import { getAdminClient } from '@/services/adminSupabase';

export interface PreciosDiarios {
  oro: number | null;
  plata: number | null;
  usd_hnl: number | null;
  cobre: number | null;
  fuente: string;
  fetched_at: string;
}

// ─── Fuentes con prioridad ────────────────────────────────────────────────────

async function fetchGoldFromGoldAPI(): Promise<number | null> {
  const apiKey = process.env.GOLDAPI_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store',
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
      cache: 'no-store',
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
        cache: 'no-store',
      }),
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/SI%3DF?interval=1d&range=1d', {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
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
    const res = await fetch(url, { cache: 'no-store' });
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

  // 1. Intentar GoldAPI primero (más confiable)
  let oro = await fetchGoldFromGoldAPI();
  let plata = await fetchSilverFromGoldAPI();
  let fuente = 'goldapi.io';

  // 2. Fallback: Yahoo Finance COMEX futures
  if (oro === null || plata === null) {
    console.log('[pricingService] Falling back to Yahoo Finance...');
    const yahoo = await fetchMetalsFromYahoo();
    if (oro === null) oro = yahoo.gold;
    if (plata === null) plata = yahoo.silver;
    fuente = oro !== null ? 'yahoo-finance' : 'failed-all-sources';
  }

  // 3. FX rate (independiente)
  const usd_hnl = await fetchExchangeRate();
  const cobre = null;

  if (oro === null) {
    console.error('[pricingService] CRITICAL: No gold price from any source.');
  }

  return { oro, plata, usd_hnl, cobre, fuente, fetched_at };
}

export async function fetchAndStorePrices(): Promise<{ id: string; precios: PreciosDiarios }> {
  const admin = getAdminClient();
  const precios = await fetchAllPrices();
  const fecha = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from('precios_diarios')
    .upsert(
      { fecha, ...precios, created_at: new Date().toISOString() },
      { onConflict: 'fecha' }
    )
    .select('id')
    .single();

  if (error || !data) throw new Error(`pricingService: store failed — ${error?.message}`);
  return { id: data.id as string, precios };
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
