import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { emailDieselDesactualizado, type DieselStaleMotivo } from '@/services/emailService';

// Daily freshness guard for the SEN diesel price (vercel.json cron, 14:30 UTC =
// 8:30 AM Honduras, right after the 8 AM gold capture).
//
// The diesel price is NOT a market feed — the Secretaría de Energía fixes it by
// decree every Monday 6 AM, and an admin enters it in /admin/precios. This cron
// is what makes that manual step reliable on a daily cadence: every morning it
// checks that the published row belongs to the current SEN week (vigente_desde
// >= this week's Monday, Honduras time) and, when it doesn't — or the row is
// missing/hidden — emails gerencia@mape.legal a reminder with the direct link.
// It repeats daily until the value is current, then goes quiet. It never writes
// prices itself: SEN has no reliable API, so scraping was evaluated and
// discarded (see CLAUDE.md §Widget de Precios) — the admin stays the source of
// truth and this guard makes staleness loud instead of silent.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same auth contract as /api/broadcast/run: Vercel Cron injects
// Authorization: Bearer <CRON_SECRET> on the GET.
function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[/api/cron/diesel-freshness] CRON_SECRET not configured in production');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  return null;
}

/**
 * Monday (YYYY-MM-DD) of the current week in Honduras time — the day this
 * week's SEN structure took effect. Date-only math on a UTC anchor, same
 * pattern as pricingService.effectivePriceDate().
 */
function mondayOfCurrentWeekHN(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const anchor = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  // getUTCDay: 0=Sun … 6=Sat → days elapsed since Monday.
  const sinceMonday = (anchor.getUTCDay() + 6) % 7;
  anchor.setUTCDate(anchor.getUTCDate() - sinceMonday);
  return anchor.toISOString().slice(0, 10);
}

interface DieselRow {
  vigente_desde: string | null;
  activo: boolean | null;
}

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;

  try {
    const lunesSemana = mondayOfCurrentWeekHN();

    // Service-role read (not the anon client): the check must also see a row
    // that an admin accidentally hid (activo=false) — anon RLS filters those.
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('precios_combustibles')
      .select('vigente_desde, activo')
      .eq('combustible', 'diesel')
      .maybeSingle();

    if (error) {
      console.error('[diesel-freshness] read failed:', error);
      // 42P01 undefined_table = migration 028 not applied — that IS a staleness
      // condition worth alerting on (fall through with row=null → sin_registro).
      // Any other read error is likely a transient DB blip: emailing "sin
      // registro" would be a false alarm, so report the failure and let
      // tomorrow's tick retry instead.
      if ((error as { code?: string }).code !== '42P01') {
        return NextResponse.json(
          { ok: false, error: 'Error al leer precios_combustibles' },
          { status: 500 },
        );
      }
    }

    const row = (data ?? null) as DieselRow | null;
    let motivo: DieselStaleMotivo | null = null;
    if (!row) motivo = 'sin_registro';
    else if (row.activo === false) motivo = 'oculto';
    else if (!row.vigente_desde || row.vigente_desde < lunesSemana) motivo = 'desactualizado';

    if (motivo == null) {
      return NextResponse.json({
        ok: true,
        fresh: true,
        vigente_desde: row?.vigente_desde ?? null,
        lunes_semana: lunesSemana,
      });
    }

    // Stale → remind. The cron runs once a day, so this nags at most daily
    // until the operator updates /admin/precios. Email failure is reported but
    // doesn't 500 the cron (SendGrid blips shouldn't mark the run as failed).
    let emailed = false;
    try {
      await emailDieselDesactualizado(motivo, row?.vigente_desde ?? null, lunesSemana);
      emailed = true;
    } catch (e) {
      console.error('[diesel-freshness] reminder email failed:', (e as Error)?.message);
    }
    console.warn(
      `[diesel-freshness] stale diesel price — motivo=${motivo} vigente_desde=${row?.vigente_desde ?? 'null'} lunes=${lunesSemana} emailed=${emailed}`,
    );

    return NextResponse.json({
      ok: true,
      fresh: false,
      motivo,
      vigente_desde: row?.vigente_desde ?? null,
      lunes_semana: lunesSemana,
      emailed,
    });
  } catch (err) {
    console.error('[diesel-freshness] GET error:', err);
    return NextResponse.json({ error: 'Error al verificar el precio del diésel' }, { status: 500 });
  }
}
