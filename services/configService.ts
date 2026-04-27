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
