import { NextResponse, type NextRequest } from 'next/server';
import { runDailyBroadcast } from '@/jobs/dailyBroadcast';

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
    const body = await req.json().catch(() => ({})) as { roles?: string[]; triggered_by?: string };
    const result = await runDailyBroadcast({
      triggeredBy: body.triggered_by ?? 'api',
      roles: body.roles as Parameters<typeof runDailyBroadcast>[0]['roles'],
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/broadcast/run]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
