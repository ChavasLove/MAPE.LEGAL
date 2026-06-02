import { NextResponse, type NextRequest } from 'next/server';
import { runDailyBroadcast, type DailyBroadcastOptions } from '@/jobs/dailyBroadcast';
import { validatePriceFreshness } from '@/services/pricingService';
import { getBroadcastTime } from '@/services/configService';
import { hondurasNow } from '@/services/broadcastService';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

// /api/broadcast/run
//
// Vercel Cron sends GET every 15 minutes (vercel.json). The actual send time is
// the DB-configured `broadcast_time` (Honduras local) — gated below so admins
// can change the schedule without a redeploy. POST is a manual trigger that
// always sends, bypassing the time/idempotency gate.
//
// Both verbs are protected by CRON_SECRET.

// Fallback when no broadcast_time has been saved yet (preserves the historical
// 8 AM Honduras behavior before the first admin save).
const DEFAULT_BROADCAST_TIME = '08:00';

// Returns a NextResponse to short-circuit when the caller is not authorized,
// or null when the request may proceed. Runs before the schedule gate so an
// unauthenticated caller can't probe broadcast state via the skip reason.
function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // A missing CRON_SECRET in production would expose this endpoint to anyone,
    // letting them trigger broadcasts and burn Meta API quota. Fail loudly.
    console.error('[/api/broadcast/run] CRON_SECRET not configured in production');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  return null;
}

// Decide whether the scheduled (cron) broadcast should fire on this tick.
// Level-triggered: fires on the first tick at/after the configured time when it
// hasn't already gone out today — so a missed tick is recovered by the next one.
async function shouldFireNow(): Promise<{ fire: boolean; reason: string }> {
  const time = (await getBroadcastTime()) ?? DEFAULT_BROADCAST_TIME;
  const { date, hhmm } = hondurasNow();

  // HH:MM strings are zero-padded 24h, so lexicographic == chronological order.
  if (hhmm < time) return { fire: false, reason: 'before_scheduled_time' };

  // Idempotency: a cron-triggered, non-aborted row for today's Honduras date
  // means today's bulletin already went out → skip. Aborted-by-token rows are
  // excluded so a fixed WHATSAPP_TOKEN retries the same day on the next tick.
  // Manual rows (triggered_by 'api'/'admin:…') are ignored so a "send now" test
  // doesn't suppress the real scheduled bulletin.
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('broadcast_log')
    .select('id')
    .eq('fecha', date)
    .eq('triggered_by', 'cron')
    .is('aborted_reason', null)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[/api/broadcast/run] idempotency check failed:', error.message);
    return { fire: false, reason: 'idempotency_check_error' };
  }
  if (data) return { fire: false, reason: 'already_sent_today' };
  return { fire: true, reason: 'due' };
}

async function runAndRespond(options: DailyBroadcastOptions, defaultTrigger: string) {
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
  const denied = assertCron(req);
  if (denied) return denied;

  const gate = await shouldFireNow();
  console.log(`[broadcast/run] cron tick — fire=${gate.fire} reason=${gate.reason}`);
  if (!gate.fire) {
    return NextResponse.json({ skipped: true, reason: gate.reason });
  }
  return runAndRespond({}, 'cron');
}

export async function POST(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as {
    roles?: DailyBroadcastOptions['roles'];
    triggered_by?: string;
  };
  // Manual trigger — always sends, bypassing the schedule/idempotency gate.
  return runAndRespond({ roles: body.roles, triggeredBy: body.triggered_by }, 'api');
}
