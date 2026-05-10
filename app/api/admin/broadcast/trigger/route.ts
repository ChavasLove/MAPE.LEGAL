import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { runDailyBroadcast } from '@/jobs/dailyBroadcast';
import type { BroadcastRol } from '@/services/userService';

export const dynamic = 'force-dynamic';

// POST /api/admin/broadcast/trigger   { roles?: BroadcastRol[] }
//
// Admin-gated wrapper around runDailyBroadcast — fires the daily broadcast
// from the dashboard without exposing CRON_SECRET. The cron route at
// /api/broadcast/run remains the production trigger; this is for manual
// "send now" actions in the admin UI.
//
// Fire-and-forget: runDailyBroadcast iterates Meta Cloud API per subscriber
// sequentially and can take longer than Vercel's function timeout. We kick
// off the run and return immediately — completion shows up in
// /api/admin/broadcast/log on the next poll (the UI refreshes the history
// table every load).
export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({})) as {
    roles?: BroadcastRol[];
  };

  const triggeredBy = `admin:${auth.user.email ?? auth.user.id}`;

  // Intentionally not awaited. The promise's failure is logged for ops; the
  // UI sees the failed run in broadcast_log with `error_msg` populated by
  // sendDailyBroadcast.
  void runDailyBroadcast({ triggeredBy, roles: body.roles })
    .catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[admin/broadcast/trigger] runDailyBroadcast failed:', msg);
    });

  return NextResponse.json({ ok: true, queued: true, triggered_by: triggeredBy });
}
