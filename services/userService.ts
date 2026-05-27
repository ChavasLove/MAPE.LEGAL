import { getAdminClient } from '@/services/adminSupabase';

export type BroadcastRol = 'minero' | 'comprador' | 'tecnico' | 'admin';

export interface UsuarioBroadcast {
  id: string;
  telefono: string;
  nombre: string | null;
  rol: BroadcastRol;
  activo: boolean;
  suscrito: boolean;
  created_at: string;
}

// Normalize phone: strip whatsapp: prefix, keep digits and leading +
function normalizePhone(raw: string): string {
  return raw.replace(/^whatsapp:/i, '').trim();
}

export async function getOrCreateUserByPhone(
  rawPhone: string,
  nombre?: string
): Promise<UsuarioBroadcast> {
  const admin = getAdminClient();
  const telefono = normalizePhone(rawPhone);

  // maybeSingle so a missing row returns { data:null, error:null } cleanly.
  // The previous .single() emitted PGRST116 for that case and the destructure
  // dropped the error — meaning a real transient DB error looked identical
  // to "no such user", flowed into the INSERT branch, and tripped a unique
  // constraint violation on retry instead of surfacing the real cause.
  const { data: existing, error: lookupErr } = await admin
    .from('usuarios_broadcast')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`userService: lookup failed — ${lookupErr.message}`);
  }
  if (existing) return existing as UsuarioBroadcast;

  const { data: created, error } = await admin
    .from('usuarios_broadcast')
    .insert({ telefono, nombre: nombre ?? null, rol: 'minero', activo: true, suscrito: true })
    .select()
    .single();

  if (error || !created) throw new Error(`userService: failed to create user — ${error?.message}`);
  return created as UsuarioBroadcast;
}

export async function assignRole(
  rawPhone: string,
  rol: BroadcastRol
): Promise<void> {
  const admin = getAdminClient();
  const telefono = normalizePhone(rawPhone);

  const { error } = await admin
    .from('usuarios_broadcast')
    .update({ rol, updated_at: new Date().toISOString() })
    .eq('telefono', telefono);

  if (error) throw new Error(`userService: assignRole failed — ${error.message}`);
}

export async function getActiveSubscribers(
  roles?: BroadcastRol[]
): Promise<UsuarioBroadcast[]> {
  const admin = getAdminClient();
  let q = admin
    .from('usuarios_broadcast')
    .select('*')
    .eq('activo', true)
    .eq('suscrito', true);

  if (roles && roles.length > 0) {
    q = q.in('rol', roles);
  }

  const { data, error } = await q;
  if (error) throw new Error(`userService: getActiveSubscribers failed — ${error.message}`);
  return (data ?? []) as UsuarioBroadcast[];
}

export async function listUsers(): Promise<UsuarioBroadcast[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('usuarios_broadcast')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`userService: listUsers failed — ${error.message}`);
  return (data ?? []) as UsuarioBroadcast[];
}

export async function getUserByPhone(rawPhone: string): Promise<UsuarioBroadcast | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('usuarios_broadcast')
    .select('*')
    .eq('telefono', normalizePhone(rawPhone))
    .single();
  return (data as UsuarioBroadcast) ?? null;
}
