import { NextResponse } from 'next/server';
import { fetchLiveMetalPrices } from '@/services/metalsPriceService';

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
    const { gold, silver, hnlPerUsd } = await fetchLiveMetalPrices();

    const goldDelta   = gold   !== null && prev.gold   ? computeDelta(gold,   prev.gold)   : { change: 0, changePercent: 0 };
    const silverDelta = silver !== null && prev.silver ? computeDelta(silver, prev.silver) : { change: 0, changePercent: 0 };

    if (gold   !== null) prev.gold   = gold;
    if (silver !== null) prev.silver = silver;

    return NextResponse.json({
      gold:   { price: gold,   ...goldDelta },
      silver: { price: silver, ...silverDelta },
      hnlPerUsd,
    });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
}
