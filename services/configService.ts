import { getAdminClient } from '@/services/adminSupabase';
import { type BroadcastRol } from '@/services/userService';

export interface ConfigEntry {
  clave:       string;
  valor:       string | null;
  tipo:        string;
  descripcion: string | null;
}

export async function getConfig(clave: string): Promise<string | null> {
  const admin = getAdminClient();
  // maybeSingle so a missing key returns { data:null, error:null }; .single()
  // would emit PGRST116 for that case and the previous code discarded the
  // error object — making a transient DB failure indistinguishable from a
  // legitimate "no such key" miss.
  const { data, error } = await admin
    .from('configuracion_sistema')
    .select('valor')
    .eq('clave', clave)
    .maybeSingle();
  if (error) {
    console.error(`[configService] getConfig(${clave}) failed:`, error.message);
    return null;
  }
  return data?.valor ?? null;
}

export async function getAllConfig(): Promise<ConfigEntry[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('configuracion_sistema')
    .select('clave, valor, tipo, descripcion')
    .order('clave');
  if (error) throw error;
  return (data ?? []) as ConfigEntry[];
}

export async function setConfig(clave: string, valor: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('configuracion_sistema')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('clave', clave);
  if (error) throw error;
}

// Internal upsert — DOES create new rows. Reserved for migrations and trusted
// callers that need to seed new config keys at runtime (broadcast helpers).
// Public-facing handlers must use `updateExistingConfigs` instead so an admin
// session can never write arbitrary keys into configuracion_sistema.
export async function setConfigs(entries: Record<string, string>): Promise<void> {
  const admin = getAdminClient();
  const updates = Object.entries(entries).map(([clave, valor]) => ({
    clave,
    valor,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await admin
    .from('configuracion_sistema')
    .upsert(updates, { onConflict: 'clave' });
  if (error) throw error;
}

// Updates only keys that already exist in configuracion_sistema. Unknown keys
// are silently ignored and returned in `ignored` so the caller can surface a
// 400 if it cares. This is the canonical path for /api/admin/config PATCH —
// new keys require a migration, not a UI write.
export async function updateExistingConfigs(
  entries: Record<string, string>
): Promise<{ updated: string[]; ignored: string[] }> {
  const admin = getAdminClient();

  const { data: existing, error: listErr } = await admin
    .from('configuracion_sistema')
    .select('clave');
  if (listErr) throw listErr;

  const known = new Set((existing ?? []).map((r: { clave: string }) => r.clave));
  const updated: string[] = [];
  const ignored: string[] = [];

  for (const [clave, valor] of Object.entries(entries)) {
    if (!known.has(clave)) {
      ignored.push(clave);
      continue;
    }
    const { error } = await admin
      .from('configuracion_sistema')
      .update({ valor, updated_at: new Date().toISOString() })
      .eq('clave', clave);
    if (error) throw error;
    updated.push(clave);
  }

  return { updated, ignored };
}

// ─── Daily report config ──────────────────────────────────────────────────────

export type ReportMetric = 'gold' | 'silver' | 'usd_hnl' | 'copper';

export interface DailyReportConfig {
  id: string;
  metric: ReportMetric;
  enabled: boolean;
  currency: 'USD' | 'HNL';
  order_index: number;
  updated_by: string | null;
  updated_at: string;
}

export async function getDailyReportConfig(): Promise<DailyReportConfig[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('daily_report_config')
    .select('*')
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as DailyReportConfig[];
}

export async function enableMetric(
  metric: ReportMetric,
  updatedBy: string
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('daily_report_config')
    .update({ enabled: true, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('metric', metric);
  if (error) throw error;
}

export async function disableMetric(
  metric: ReportMetric,
  updatedBy: string
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('daily_report_config')
    .update({ enabled: false, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('metric', metric);
  if (error) throw error;
}

export async function updateMetricCurrency(
  metric: ReportMetric,
  currency: 'USD' | 'HNL',
  updatedBy: string
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('daily_report_config')
    .update({ currency, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('metric', metric);
  if (error) throw error;
}

export async function updateMetricConfig(
  metric: ReportMetric,
  patch: Partial<Pick<DailyReportConfig, 'enabled' | 'currency' | 'order_index'>>,
  updatedBy: string
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('daily_report_config')
    .update({ ...patch, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('metric', metric);
  if (error) throw error;
}

// ─── Broadcast audience + schedule ───────────────────────────────────────────

// Stores comma-separated list of roles in configuracion_sistema.
// Audit trail is in admin_actions table — updatedBy is for logging only.
export async function updateAudience(
  roles: BroadcastRol[],
  _updatedBy: string
): Promise<void> {
  await setConfigs({ broadcast_audience: roles.join(',') });
}

// Stores broadcast time in HH:MM (24h) in configuracion_sistema.
export async function updateSchedule(
  time: string,
  _updatedBy: string
): Promise<void> {
  // Validate HH:MM format before storing
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`updateSchedule: invalid time format "${time}" — expected HH:MM`);
  }
  await setConfigs({ broadcast_time: time });
}

// Reads the configured daily broadcast time (Honduras local, HH:MM 24h).
// Returns null when unset or malformed so the caller can apply its own default.
// The cron schedule in vercel.json is only a frequent tick; this value is the
// actual send time, gated at runtime in /api/broadcast/run.
export async function getBroadcastTime(): Promise<string | null> {
  const v = await getConfig('broadcast_time');
  return v && /^\d{2}:\d{2}$/.test(v) ? v : null;
}
