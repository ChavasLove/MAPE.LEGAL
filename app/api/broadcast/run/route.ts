import { NextResponse, type NextRequest } from 'next/server';
import { runDailyBroadcast, type DailyBroadcastOptions } from '@/jobs/dailyBroadcast';
import { validatePriceFreshness } from '@/services/pricingService';

export const dynamic = 'force-dynamic';

// /api/broadcast/run
// Trigger the daily broadcast. Protected by CRON_SECRET header.
//
// Vercel Cron Jobs send GET requests with `Authorization: Bearer <CRON_SECRET>`
// when CRON_SECRET is configured as a project env var. POST is kept for manual
// invocation (curl, admin actions) where a JSON body can supply roles overrides.
async function handle(
  req: NextRequest,
  options: DailyBroadcastOptions,
  defaultTrigger: string
) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runDailyBroadcast({
      triggeredBy: options.triggeredBy ?? defaultTrigger,
      roles:       options.roles,
    });

    const freshness = await validatePriceFreshness(2).catch(() => null);
    if (freshness && !freshness.isFresh) {
      console.warn(`[/api/broadcast/run] ${freshness.warning}`);
    }

    return NextResponse.json({ ...result, price_freshness: freshness });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[/api/broadcast/run]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req, {}, 'cron');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    roles?: DailyBroadcastOptions['roles'];
    triggered_by?: string;
  };
  return handle(
    req,
    { roles: body.roles, triggeredBy: body.triggered_by },
    'api'
  );
}
