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
export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({})) as {
    roles?: BroadcastRol[];
  };

  const triggeredBy = `admin:${auth.user.email ?? auth.user.id}`;

  try {
    const result = await runDailyBroadcast({
      triggeredBy,
      roles: body.roles,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
