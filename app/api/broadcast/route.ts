import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getLastBroadcastLog } from '@/services/broadcastService';
import { getActiveSubscribers } from '@/services/userService';
import { getLatestPrices } from '@/services/pricingService';

export const dynamic = 'force-dynamic';

// GET /api/broadcast — status: last run, subscriber count, latest prices.
// Handler-level auth (invariante PR #159/#167): el proxy solo chequea
// presencia de cookies, no la firma del JWT.
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;
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
    console.error('[broadcast/status] failed:', e);
    return NextResponse.json({ error: 'Error al consultar el estado del broadcast' }, { status: 500 });
  }
}
