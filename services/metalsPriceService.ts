export interface LiveMetalPrices {
  gold:     number | null;
  silver:   number | null;
  hnlPerUsd: number | null;
}

/**
 * Fetch live gold/silver prices from metals.live (free, no API key) and
 * the USD→HNL rate from exchangerate-api. Mirrors the logic in
 * app/api/prices/route.ts which is proven to work in production.
 *
 * Uses Promise.allSettled so one failing API never blocks the other.
 */
export async function fetchLiveMetalPrices(): Promise<LiveMetalPrices> {
  const [metalsResult, fxResult] = await Promise.allSettled([
    fetch('https://api.metals.live/v1/spot', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }),
    fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }),
  ]);

  let gold:     number | null = null;
  let silver:   number | null = null;
  let hnlPerUsd: number | null = null;

  if (metalsResult.status === 'fulfilled' && metalsResult.value.ok) {
    try {
      const data = await metalsResult.value.json() as unknown;
      const find = (key: string): number | null => {
        if (Array.isArray(data)) {
          const entry = (data as Array<Record<string, number>>).find(m => key in m);
          return entry?.[key] ?? null;
        }
        return (data as Record<string, number>)?.[key] ?? null;
      };
      gold   = find('gold');
      silver = find('silver');
      console.log('[metalsPriceService] metals.live:', `gold=${gold} silver=${silver}`);
    } catch (e) {
      console.error('[metalsPriceService] metals.live parse error:', e);
    }
  } else {
    const reason = metalsResult.status === 'rejected' ? metalsResult.reason : `HTTP ${metalsResult.value.status}`;
    console.error('[metalsPriceService] metals.live failed:', reason);
  }

  if (fxResult.status === 'fulfilled' && fxResult.value.ok) {
    try {
      const fxData = await fxResult.value.json() as { rates?: Record<string, number>; conversion_rates?: Record<string, number> };
      hnlPerUsd = fxData.conversion_rates?.HNL ?? fxData.rates?.HNL ?? null;
      console.log('[metalsPriceService] fx rate HNL:', hnlPerUsd);
    } catch (e) {
      console.error('[metalsPriceService] exchangerate-api parse error:', e);
    }
  } else {
    const reason = fxResult.status === 'rejected' ? fxResult.reason : `HTTP ${fxResult.value.status}`;
    console.error('[metalsPriceService] exchangerate-api failed:', reason);
  }

  return { gold, silver, hnlPerUsd };
}
