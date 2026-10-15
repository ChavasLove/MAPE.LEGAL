import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { emailDieselDesactualizado, type DieselStaleMotivo } from '@/services/emailService';
import { ensureDailyPriceSnapshot } from '@/services/pricingService';
import { lunesSemanaSenHN, esVigenciaDesactualizada } from '@/lib/types/combustible';
import { getServerAuth } from '@/lib/serverAuth';

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

type Caller = 'cron' | 'admin';

// Two ways in:
//  1. Vercel Cron — Authorization: Bearer <CRON_SECRET> (same contract as
//     /api/broadcast/run).
//  2. A logged-in admin opening this URL in the browser — lets the operator
//     verify the guard end-to-end (check + reminder email) without knowing the
//     secret. Added after the 2026-10 audit: the guard had been dead for 11 weeks
//     (CRON_SECRET missing in production → 500 on every tick) and nobody could
//     tell from the outside. A failing cron must be diagnosable from /admin.
//
// Without CRON_SECRET in production the cron path answers 500 (never open), but
// the admin-session path still works so the misconfiguration is visible.
async function authorize(req: NextRequest): Promise<Caller | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return 'cron';

  const session = await getServerAuth();
  if (session?.role === 'admin') return 'admin';

  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('[/api/cron/diesel-freshness] CRON_SECRET not configured in production');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!secret) return 'cron'; // dev without secret stays open, as before
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

interface DieselRow {
  vigente_desde: string | null;
  activo: boolean | null;
}

export async function GET(req: NextRequest) {
  const caller = await authorize(req);
  if (caller instanceof NextResponse) return caller;
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);

  // Safety net for the gold/FX snapshot of the day: if the 8 AM bulletin tick
  // failed or was skipped, capture it now (08:30) instead of leaving it to the
  // first visitor. Non-fatal and independent from the diesel check.
  const price_snapshot = await ensureDailyPriceSnapshot();

  try {
    const lunesSemana = lunesSemanaSenHN();

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
    else if (esVigenciaDesactualizada(row.vigente_desde, lunesSemana)) motivo = 'desactualizado';

    if (motivo == null) {
      return NextResponse.json({
        ok: true,
        fresh: true,
        vigente_desde: row?.vigente_desde ?? null,
        lunes_semana: lunesSemana,
        caller,
        cron_secret_configured: cronSecretConfigured,
        price_snapshot,
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
      caller,
      cron_secret_configured: cronSecretConfigured,
      price_snapshot,
    });
  } catch (err) {
    console.error('[diesel-freshness] GET error:', err);
    return NextResponse.json({ error: 'Error al verificar el precio del diésel' }, { status: 500 });
  }
}
