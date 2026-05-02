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

  const { data: existing } = await admin
    .from('usuarios_broadcast')
    .select('*')
    .eq('telefono', telefono)
    .single();

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

export async function setUserActive(rawPhone: string, activo: boolean): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('usuarios_broadcast')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('telefono', normalizePhone(rawPhone));
  if (error) throw new Error(`userService: setUserActive failed — ${error.message}`);
}

export async function setUserSuscrito(rawPhone: string, suscrito: boolean): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('usuarios_broadcast')
    .update({ suscrito, updated_at: new Date().toISOString() })
    .eq('telefono', normalizePhone(rawPhone));
  if (error) throw new Error(`userService: setUserSuscrito failed — ${error.message}`);
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
