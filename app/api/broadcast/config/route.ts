import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import {
  getDailyReportConfig,
  enableMetric,
  disableMetric,
  updateMetricCurrency,
  updateMetricConfig,
  type ReportMetric,
} from '@/services/configService';

// GET /api/broadcast/config — full metric configuration.
// Handler-level auth (invariante PR #159/#167): antes era cookie-only vía
// proxy — un `curl` con cookies inventadas podía leer y MUTAR la config del
// broadcast. La versión admin canónica vive en /api/admin/broadcast/config.
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const config = await getDailyReportConfig();
    return NextResponse.json(config);
  } catch (e) {
    console.error('[broadcast/config] GET failed:', e);
    return NextResponse.json({ error: 'Error al leer la configuración' }, { status: 500 });
  }
}

// PATCH /api/broadcast/config
// Body: { metric, action: 'enable'|'disable'|'set_currency'|'update', currency?, patch?, updated_by? }
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as {
      metric: ReportMetric;
      action: 'enable' | 'disable' | 'set_currency' | 'update';
      currency?: 'USD' | 'HNL';
      patch?: Partial<{ enabled: boolean; currency: 'USD' | 'HNL'; order_index: number }>;
      updated_by?: string;
    };

    const { metric, action, currency, patch, updated_by = 'api' } = body;

    const validMetrics: ReportMetric[] = ['gold', 'silver', 'usd_hnl', 'copper'];
    if (!validMetrics.includes(metric)) {
      return NextResponse.json({ error: `Invalid metric: ${metric}` }, { status: 400 });
    }

    switch (action) {
      case 'enable':
        await enableMetric(metric, updated_by);
        break;
      case 'disable':
        await disableMetric(metric, updated_by);
        break;
      case 'set_currency':
        if (!currency || !['USD', 'HNL'].includes(currency)) {
          return NextResponse.json({ error: 'Invalid currency — use USD or HNL' }, { status: 400 });
        }
        await updateMetricCurrency(metric, currency, updated_by);
        break;
      case 'update':
        if (!patch) return NextResponse.json({ error: 'patch body required for update action' }, { status: 400 });
        await updateMetricConfig(metric, patch, updated_by);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const updated = await getDailyReportConfig();
    return NextResponse.json(updated);
  } catch (e) {
    console.error('[broadcast/config] PATCH failed:', e);
    return NextResponse.json({ error: 'Error al actualizar la configuración' }, { status: 500 });
  }
}
