import { NextResponse } from 'next/server';
import { getLastBroadcastLog } from '@/services/broadcastService';
import { getActiveSubscribers } from '@/services/userService';
import { getLatestPrices } from '@/services/pricingService';

// GET /api/broadcast — status: last run, subscriber count, latest prices
export async function GET() {
  try {
    const [lastLog, subscribers, latestPrices] = await Promise.all([
      getLastBroadcastLog(),
      getActiveSubscribers(),
      getLatestPrices(),
    ]);

    return NextResponse.json({
      last_broadcast: lastLog,
      subscribers_active: subscribers.length,
      latest_prices: latestPrices,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
