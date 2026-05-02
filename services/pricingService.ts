import { getAdminClient } from '@/services/adminSupabase';

export interface PreciosDiarios {
  oro: number | null;
  plata: number | null;
  usd_hnl: number | null;
  cobre: number | null;
  fuente: string;
}

// ─── External API fetchers ────────────────────────────────────────────────────

async function fetchMetalPrice(symbol: 'XAU' | 'XAG' | 'HG'): Promise<number | null> {
  const apiKey = process.env.GOLDAPI_KEY;
  if (!apiKey) {
    console.warn('pricingService: GOLDAPI_KEY not set — skipping metal price fetch');
    return null;
  }

  try {
    const res = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
      headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    } as RequestInit);
    if (!res.ok) throw new Error(`goldapi ${res.status}`);
    const data = await res.json() as { price?: number; price_gram_24k?: number };
    return data.price ?? null;
  } catch (e) {
    console.error(`pricingService: fetchMetalPrice(${symbol}) failed —`, e);
    return null;
  }
}

async function fetchExchangeRate(): Promise<number | null> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  // Try paid API first, fall back to free tier
  const url = apiKey
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    : 'https://api.exchangerate-api.com/v4/latest/USD';

  try {
    const res = await fetch(url, { next: { revalidate: 0 } } as RequestInit);
    if (!res.ok) throw new Error(`exchangerate-api ${res.status}`);
    const data = await res.json() as { rates?: Record<string, number>; conversion_rates?: Record<string, number> };
    const rates = data.conversion_rates ?? data.rates ?? {};
    return rates['HNL'] ?? null;
  } catch (e) {
    console.error('pricingService: fetchExchangeRate failed —', e);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchGoldPrice(): Promise<number | null> {
  return fetchMetalPrice('XAU');
}

export async function fetchSilverPrice(): Promise<number | null> {
  return fetchMetalPrice('XAG');
}

export async function fetchUSDHNL(): Promise<number | null> {
  return fetchExchangeRate();
}

export async function fetchCopperPrice(): Promise<number | null> {
  // HG = High Grade copper in USD/lb via goldapi (if available)
  return fetchMetalPrice('HG');
}

// Fetch all prices in parallel and return a consolidated snapshot
export async function fetchAllPrices(): Promise<PreciosDiarios> {
  const [oro, plata, usd_hnl, cobre] = await Promise.all([
    fetchGoldPrice(),
    fetchSilverPrice(),
    fetchUSDHNL(),
    fetchCopperPrice(),
  ]);
  return { oro, plata, usd_hnl, cobre, fuente: 'goldapi.io + exchangerate-api.com' };
}

// Fetch, store in DB, return the record id
export async function fetchAndStorePrices(): Promise<{ id: string; precios: PreciosDiarios }> {
  const admin = getAdminClient();
  const precios = await fetchAllPrices();
  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
