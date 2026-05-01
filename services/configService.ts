import { getAdminClient } from '@/services/adminSupabase';

export interface ConfigEntry {
  clave:       string;
  valor:       string | null;
  tipo:        string;
  descripcion: string | null;
}

export async function getConfig(clave: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('configuracion_sistema')
    .select('valor')
    .eq('clave', clave)
    .single();
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
