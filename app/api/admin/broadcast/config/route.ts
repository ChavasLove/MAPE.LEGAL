import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import {
  getDailyReportConfig,
  enableMetric,
  disableMetric,
  updateMetricCurrency,
  updateMetricConfig,
  updateAudience,
  updateSchedule,
  getConfig,
  type ReportMetric,
} from '@/services/configService';
import type { BroadcastRol } from '@/services/userService';

export const dynamic = 'force-dynamic';

const VALID_METRICS: ReportMetric[]  = ['gold', 'silver', 'usd_hnl', 'copper'];
const VALID_ROLES: BroadcastRol[]    = ['minero', 'comprador', 'tecnico', 'admin'];
const VALID_CURRENCIES: Array<'USD' | 'HNL'> = ['USD', 'HNL'];

// GET /api/admin/broadcast/config
// Returns the daily report metric config + current audience + schedule.
// Admin-gated. Parallel to /api/broadcast/config (which is unauthenticated for
// the legacy María command interpreter); the admin UI should call this one.
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const [metrics, audienceCsv, time] = await Promise.all([
    getDailyReportConfig(),
    getConfig('broadcast_audience'),
    getConfig('broadcast_time'),
  ]);

  const audience = (audienceCsv ?? '')
    .split(',')
    .map(s => s.trim())
    .filter((r): r is BroadcastRol => (VALID_ROLES as string[]).includes(r));

  return NextResponse.json({
    metrics,
    audience,
    broadcast_time: time,
  });
}

// PATCH /api/admin/broadcast/config
// Body: one of:
//   { action:'enable_metric',  metric }
//   { action:'disable_metric', metric }
//   { action:'set_currency',   metric, currency }
//   { action:'update_metric',  metric, patch:{enabled?, currency?, order_index?} }
//   { action:'set_audience',   roles: BroadcastRol[] }
//   { action:'set_schedule',   time: 'HH:MM' }
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action;
  const updatedBy = `admin:${auth.user.email ?? auth.user.id}`;

  try {
    switch (action) {
      case 'enable_metric':
      case 'disable_metric': {
        const metric = body.metric as ReportMetric;
        if (!VALID_METRICS.includes(metric)) {
          return NextResponse.json({ error: `metric inválido` }, { status: 400 });
        }
        if (action === 'enable_metric') await enableMetric(metric, updatedBy);
        else await disableMetric(metric, updatedBy);
        break;
      }
      case 'set_currency': {
        const metric   = body.metric as ReportMetric;
        const currency = body.currency as 'USD' | 'HNL';
        if (!VALID_METRICS.includes(metric)) {
          return NextResponse.json({ error: `metric inválido` }, { status: 400 });
        }
        if (!VALID_CURRENCIES.includes(currency)) {
          return NextResponse.json({ error: `currency inválido — use USD o HNL` }, { status: 400 });
        }
        await updateMetricCurrency(metric, currency, updatedBy);
        break;
      }
      case 'update_metric': {
        const metric = body.metric as ReportMetric;
        const patch  = body.patch as Partial<{ enabled: boolean; currency: 'USD' | 'HNL'; order_index: number }>;
        if (!VALID_METRICS.includes(metric)) {
          return NextResponse.json({ error: `metric inválido` }, { status: 400 });
        }
        if (!patch || typeof patch !== 'object') {
          return NextResponse.json({ error: 'patch requerido' }, { status: 400 });
        }
        await updateMetricConfig(metric, patch, updatedBy);
        break;
      }
      case 'set_audience': {
        const roles = body.roles as BroadcastRol[];
        if (!Array.isArray(roles) || !roles.every(r => VALID_ROLES.includes(r))) {
          return NextResponse.json(
            { error: `roles inválidos — usa subconjunto de: ${VALID_ROLES.join(', ')}` },
            { status: 400 }
          );
        }
        await updateAudience(roles, updatedBy);
        break;
      }
      case 'set_schedule': {
        const time = body.time as string;
        if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
          return NextResponse.json(
            { error: 'time inválido — use HH:MM (24h)' },
            { status: 400 }
          );
        }
        await updateSchedule(time, updatedBy);
        break;
      }
      default:
        return NextResponse.json(
          { error: `action desconocida — use enable_metric|disable_metric|set_currency|update_metric|set_audience|set_schedule` },
          { status: 400 }
        );
    }

    const [metrics, audienceCsv, time] = await Promise.all([
      getDailyReportConfig(),
      getConfig('broadcast_audience'),
      getConfig('broadcast_time'),
    ]);
    const audience = (audienceCsv ?? '')
      .split(',')
      .map(s => s.trim())
      .filter((r): r is BroadcastRol => (VALID_ROLES as string[]).includes(r));

    return NextResponse.json({ metrics, audience, broadcast_time: time });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
