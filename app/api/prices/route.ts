import { NextResponse } from 'next/server';
import { fetchAllPrices } from '@/services/pricingService';

export const dynamic = 'force-dynamic';

// Module-level state: persists within a server instance, resets on cold start.
const prev = { gold: 0, silver: 0 };

function computeDelta(current: number, previous: number) {
  if (!previous) return { change: 0, changePercent: 0 };
  const change = Math.round((current - previous) * 100) / 100;
  const changePercent = Math.round(((current - previous) / previous) * 1_000_000) / 10_000;
  return { change, changePercent };
}

export async function GET() {
  try {
    const precios = await fetchAllPrices();
    const gold = precios.oro;
    const silver = precios.plata;

    const goldDelta   = gold   !== null && prev.gold   ? computeDelta(gold,   prev.gold)   : { change: 0, changePercent: 0 };
    const silverDelta = silver !== null && prev.silver ? computeDelta(silver, prev.silver) : { change: 0, changePercent: 0 };

    if (gold   !== null) prev.gold   = gold;
    if (silver !== null) prev.silver = silver;

    return NextResponse.json({
      gold:   { price: gold,   ...goldDelta, source: precios.fuente },
      silver: { price: silver, ...silverDelta, source: precios.fuente },
      hnlPerUsd: precios.usd_hnl,
      fetchedAt: precios.fetched_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/prices]', msg);
    return NextResponse.json({ error: 'fetch_failed', message: msg }, { status: 502 });
  }
}
