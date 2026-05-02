import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Module-level state: persists within a server instance, resets on cold start.
// Adequate for pilot scale; replace with DB persistence if needed.
const prev = { gold: 0, silver: 0 };

function computeDelta(current: number, previous: number) {
  if (!previous) return { change: 0, changePercent: 0 };
  const change = Math.round((current - previous) * 100) / 100;
  const changePercent = Math.round(((current - previous) / previous) * 1_000_000) / 10_000;
  return { change, changePercent };
}

export async function GET() {
  try {
    const [metalsRes, fxRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      } as RequestInit),
      fetch('https://api.exchangerate-api.com/v4/latest/USD', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
      } as RequestInit),
    ]);

    const metalsData = await metalsRes.json();
    const fxData = await fxRes.json();

    const find = (key: string): number | null => {
      if (Array.isArray(metalsData)) {
        const entry = metalsData.find((m: Record<string, number>) => key in m);
        return entry?.[key] ?? null;
      }
      return metalsData?.[key] ?? null;
    };

    const gold = find('gold');
    const silver = find('silver');

    const goldDelta   = gold   !== null && prev.gold   ? computeDelta(gold,   prev.gold)   : { change: 0, changePercent: 0 };
    const silverDelta = silver !== null && prev.silver ? computeDelta(silver, prev.silver) : { change: 0, changePercent: 0 };

    if (gold   !== null) prev.gold   = gold;
    if (silver !== null) prev.silver = silver;

    return NextResponse.json({
      gold:   { price: gold,   ...goldDelta },
      silver: { price: silver, ...silverDelta },
      hnlPerUsd: fxData.rates?.HNL ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
}
