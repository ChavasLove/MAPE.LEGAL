export interface LiveMetalPrices {
  gold:      number | null;
  silver:    number | null;
  hnlPerUsd: number | null;
}

// ─── Gold price sources (tried in order) ─────────────────────────────────────

async function fetchGoldFromGoldAPI(apiKey: string): Promise<number | null> {
  try {
    const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`goldapi.io ${res.status}`);
    const data = await res.json() as { price?: number };
    return data.price ?? null;
  } catch (e) {
    console.error('[metalsPriceService] goldapi.io failed:', e);
    return null;
  }
}

async function fetchGoldFromYahoo(): Promise<{ gold: number | null; silver: number | null }> {
  // Yahoo Finance COMEX futures: GC=F (gold), SI=F (silver)
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

    const parseYahoo = (result: PromiseSettledResult<Response>): number | null => {
      if (result.status !== 'fulfilled' || !result.value.ok) return null;
      // We'll parse the JSON body below — return the response for chaining
      return null; // placeholder; actual parsing happens after
    };
    void parseYahoo; // suppress unused warning

    let gold:   number | null = null;
    let silver: number | null = null;

    if (goldRes.status === 'fulfilled' && goldRes.value.ok) {
      const d = await goldRes.value.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
      gold = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
    if (silverRes.status === 'fulfilled' && silverRes.value.ok) {
      const d = await silverRes.value.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
      silver = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }

    console.log('[metalsPriceService] Yahoo Finance:', `gold=${gold} silver=${silver}`);
    return { gold, silver };
  } catch (e) {
    console.error('[metalsPriceService] Yahoo Finance failed:', e);
    return { gold: null, silver: null };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch live gold/silver prices and the USD→HNL exchange rate.
 *
 * Price source priority:
 *   1. goldapi.io   — if GOLDAPI_KEY env var is set (free tier: 1 req/hr)
 *   2. Yahoo Finance — COMEX futures GC=F / SI=F (no key, publicly accessible)
 *
 * Exchange rate: exchangerate-api.com v4 (free, confirmed working from Vercel).
 *
 * Uses Promise.allSettled so one failing API never blocks the other.
 */
export async function fetchLiveMetalPrices(): Promise<LiveMetalPrices> {
  const goldApiKey = process.env.GOLDAPI_KEY;

  // Run metals fetch and FX fetch in parallel
  const [metalsResult, fxResult] = await Promise.allSettled([
    // Metals: GoldAPI if key set, otherwise Yahoo Finance
    goldApiKey
      ? fetchGoldFromGoldAPI(goldApiKey).then(price => ({ gold: price, silver: null }))
      : fetchGoldFromYahoo(),
    // FX: free exchangerate-api (confirmed working)
    fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }),
  ]);

  let gold:      number | null = null;
  let silver:    number | null = null;
  let hnlPerUsd: number | null = null;

  if (metalsResult.status === 'fulfilled') {
    gold   = metalsResult.value.gold;
    silver = metalsResult.value.silver;
  } else {
    console.error('[metalsPriceService] metals fetch failed:', metalsResult.reason);
  }

  if (fxResult.status === 'fulfilled' && fxResult.value.ok) {
    try {
      const fxData = await fxResult.value.json() as { rates?: Record<string, number>; conversion_rates?: Record<string, number> };
      hnlPerUsd = fxData.conversion_rates?.HNL ?? fxData.rates?.HNL ?? null;
      console.log('[metalsPriceService] HNL rate:', hnlPerUsd);
    } catch (e) {
      console.error('[metalsPriceService] FX parse error:', e);
    }
  } else {
    const reason = fxResult.status === 'rejected' ? fxResult.reason : `HTTP ${fxResult.value.status}`;
    console.error('[metalsPriceService] FX fetch failed:', reason);
  }

  console.log('[metalsPriceService] result:', { gold, silver, hnlPerUsd });
  return { gold, silver, hnlPerUsd };
}
