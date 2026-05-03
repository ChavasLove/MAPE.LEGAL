import { NextResponse, type NextRequest } from 'next/server';
import { runDailyBroadcast, type DailyBroadcastOptions } from '@/jobs/dailyBroadcast';
import { validatePriceFreshness } from '@/services/pricingService';

// POST /api/broadcast/run
// Trigger the daily broadcast. Protected by CRON_SECRET header.
// Cron job example (Vercel): POST this URL with Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await req.json().catch(() => ({})) as { roles?: DailyBroadcastOptions['roles']; triggered_by?: string };
    const result = await runDailyBroadcast({
      triggeredBy: body.triggered_by ?? 'api',
      roles:       body.roles,
    });

    // Post-broadcast: check whether the gold price has been static for too many days.
    // Non-fatal — log a warning but return success so the cron doesn't retry forever.
    const freshness = await validatePriceFreshness(2).catch(() => null);
    if (freshness && !freshness.isFresh) {
      console.warn(`[POST /api/broadcast/run] ${freshness.warning}`);
    }

    return NextResponse.json({
      ...result,
      price_freshness: freshness,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/broadcast/run]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
