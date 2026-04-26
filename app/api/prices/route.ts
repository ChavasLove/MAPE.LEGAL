import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [metalsRes, fxRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      }),
      fetch('https://api.exchangerate-api.com/v4/latest/USD', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
      }),
    ]);

    const metalsData = await metalsRes.json();
    const fxData = await fxRes.json();

    // metals.live returns an array: [{gold: 2345}, {silver: 29}, ...]
    const find = (key: string): number | null => {
      if (Array.isArray(metalsData)) {
        const entry = metalsData.find((m: Record<string, number>) => key in m);
        return entry?.[key] ?? null;
      }
      return metalsData?.[key] ?? null;
    };

    return NextResponse.json({
      gold: find('gold'),
      silver: find('silver'),
      hnlPerUsd: fxData.rates?.HNL ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
}
