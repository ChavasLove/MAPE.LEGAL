import { supabase } from '@/services/supabase';
import { getAdminClient } from '@/services/adminSupabase';

export interface CmsField {
  seccion: string;
  campo:   string;
  valor:   string | null;
  tipo:    string;
}

export async function getCmsContent(seccion?: string): Promise<CmsField[]> {
  let query = supabase
    .from('contenido_cms')
    .select('seccion, campo, valor, tipo')
    .order('seccion')
    .order('campo');

  if (seccion) {
    query = query.eq('seccion', seccion);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CmsField[];
}

export async function getCmsField(seccion: string, campo: string): Promise<string | null> {
  const { data } = await supabase
    .from('contenido_cms')
    .select('valor')
    .eq('seccion', seccion)
    .eq('campo', campo)
    .single();
  return data?.valor ?? null;
}

export async function getCmsSection(seccion: string): Promise<Record<string, string>> {
  const fields = await getCmsContent(seccion);
  return Object.fromEntries(fields.map(f => [f.campo, f.valor ?? '']));
}

export async function upsertCmsField(
  seccion: string,
  campo: string,
  valor: string,
  tipo = 'texto',
  userId?: string
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('contenido_cms')
    .upsert(
      { seccion, campo, valor, tipo, updated_by: userId ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'seccion,campo' }
    );
  if (error) throw error;
}

export async function deleteCmsField(seccion: string, campo: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('contenido_cms')
    .delete()
    .eq('seccion', seccion)
    .eq('campo', campo);
  if (error) throw error;
}

export async function getCmsSections(): Promise<string[]> {
  const { data, error } = await supabase
    .from('contenido_cms')
    .select('seccion')
    .order('seccion');
  if (error) throw error;
  return Array.from(new Set<string>((data ?? []).map((r: { seccion: string }) => r.seccion)));
}
