import { NextResponse, type NextRequest } from 'next/server';
import { getPriceHistory, getLatestPrices } from '@/services/pricingService';

// GET /api/broadcast/prices?days=7
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const days = Math.min(parseInt(searchParams.get('days') ?? '7', 10), 90);

    if (searchParams.get('latest') === 'true') {
      const latest = await getLatestPrices();
      return NextResponse.json(latest);
    }

    const history = await getPriceHistory(days);
    return NextResponse.json(history);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
