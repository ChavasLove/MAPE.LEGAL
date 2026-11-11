import { getAdminClient } from '@/services/adminSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Fase } from '@/modules/types';

// Server-only. Este módulo usa el cliente service-role (getAdminClient) y no
// debe importarse desde client components salvo con `import type`. Sus callers
// son rutas server-side ya protegidas por requireRole(). La instanciación es
// lazy — nunca a nivel de módulo (regla §Framework de CLAUDE.md). Desde la
// migración 041 estas tablas tienen RLS y la anon key no las ve.
let _db: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_db) _db = getAdminClient();
  return _db;
}

export async function getFases(): Promise<Fase[]> {
  const { data, error } = await db()
    .from('fases')
    .select('*')
    .order('orden', { ascending: true });

  if (error) throw error;

  return data;
}

export async function getFaseById(id: string): Promise<Fase> {
  const { data, error } = await db()
    .from('fases')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}
