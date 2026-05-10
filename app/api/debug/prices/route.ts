import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/prices
 * Diagnostic endpoint — hit this in a browser to see exactly what the live
 * price fetch returns. NOT protected (read-only, no secrets exposed).
 */
export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      GOLDAPI_KEY:          process.env.GOLDAPI_KEY ? 'set' : 'NOT SET',
      EXCHANGE_RATE_API_KEY: process.env.EXCHANGE_RATE_API_KEY ? 'set' : 'NOT SET',
      ANTHROPIC_API_KEY:    process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'NOT SET',
    },
    metals_live: { status: 'pending' as unknown },
    exchange_rate: { status: 'pending' as unknown },
  };

  // Test metals.live
  try {
    const start = Date.now();
    const res = await fetch('https://api.metals.live/v1/spot', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* raw text fallback */ }

    const gold = (() => {
      if (!Array.isArray(parsed)) return (parsed as Record<string, unknown>)?.gold ?? null;
      const entry = (parsed as Array<Record<string, unknown>>).find(m => 'gold' in m);
      return entry?.gold ?? null;
    })();

    results.metals_live = {
      ok:        res.ok,
      status:    res.status,
      elapsed_ms: elapsed,
      gold_found: gold,
      raw_preview: text.slice(0, 300),
    };
  } catch (e) {
    results.metals_live = { error: String(e) };
  }

  // Test exchange rate API
  try {
    const start = Date.now();
    const url = process.env.EXCHANGE_RATE_API_KEY
      ? `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`
      : 'https://api.exchangerate-api.com/v4/latest/USD';
    const res = await fetch(url, { cache: 'no-store' });
    const elapsed = Date.now() - start;
    const data = await res.json() as { rates?: Record<string, number>; conversion_rates?: Record<string, number> };
    const hnl = data.conversion_rates?.HNL ?? data.rates?.HNL ?? null;
    results.exchange_rate = { ok: res.ok, status: res.status, elapsed_ms: elapsed, HNL: hnl };
  } catch (e) {
    results.exchange_rate = { error: String(e) };
  }

  // Test Yahoo Finance (gold futures GC=F)
  try {
    const start = Date.now();
    const res = await fetch(
      'https://query2.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=1d',
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    );
    const elapsed = Date.now() - start;
    const data = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    results.yahoo_finance_gold = { ok: res.ok, status: res.status, elapsed_ms: elapsed, price };
  } catch (e) {
    results.yahoo_finance_gold = { error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
