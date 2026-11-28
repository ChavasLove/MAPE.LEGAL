// lib/acceso/sesionPersonal.ts — utilidades SERVER-ONLY de las rutas del
// personal (perfiles, recepción, organizaciones, respaldo de documentos):
// requireRole por ACCIÓN (matriz de lib/acceso/personal.ts), contexto con la
// organización del usuario, bitácora append-only de acciones y mapeo de
// errores de base. Invariantes heredadas de la auditoría del panel admin:
// nunca se filtra `error.message` al cliente; console.error antes de cada 500.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole, type AuthContext, type Role } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { rolesCon, type AccionPersonal, type ContextoPersonal } from './personal';

export interface SesionPersonal {
  auth: AuthContext;
  ctx: ContextoPersonal;
  admin: SupabaseClient;
}

type PgError = { code?: string; message?: string };

const CODIGOS_MIGRACION = new Set(['42P01', '42883', '42703', 'PGRST202', 'PGRST205']);

export function esMigracionPendiente(error: PgError | null | undefined): boolean {
  return !!error && CODIGOS_MIGRACION.has(error.code ?? '');
}

export function respuestaEnPreparacion(): NextResponse {
  return NextResponse.json(
    { error: 'MIGRATION_PENDING', mensaje: 'Módulo en preparación: las migraciones de esta sección aún no están aplicadas.' },
    { status: 503 },
  );
}

/** Mapea un error de PostgREST a la respuesta HTTP canónica. */
export function errorDb(scope: string, error: PgError, generico = 'Error interno.'): NextResponse {
  if (esMigracionPendiente(error)) {
    console.error(`${scope} migración pendiente:`, error.code);
    return respuestaEnPreparacion();
  }
  if (error.code === '23505') return NextResponse.json({ error: 'Ya existe un registro con esa clave.' }, { status: 409 });
  if (error.code === '23503') return NextResponse.json({ error: 'Referencia inválida (registro relacionado inexistente).' }, { status: 400 });
  if (error.code === '23514') {
    // Los triggers de integridad lanzan 23514 con un código legible al inicio.
    const clave = /^([a-z_]+):/.exec(error.message ?? '')?.[1] ?? null;
    return NextResponse.json({ error: 'La operación no cumple una regla de integridad.', regla: clave }, { status: 409 });
  }
  console.error(`${scope} failed:`, error);
  return NextResponse.json({ error: generico }, { status: 500 });
}

async function organizacionDe(admin: SupabaseClient, userId: string): Promise<string | null | PgError> {
  const { data, error } = await admin.from('user_roles').select('organizacion_id').eq('user_id', userId).maybeSingle();
  if (error) {
    // Sin la 043 la columna no existe: el personal sin organización sigue operando.
    if (esMigracionPendiente(error)) return null;
    return error;
  }
  return (data as { organizacion_id?: string | null } | null)?.organizacion_id ?? null;
}

async function iniciar(roles: Role[]): Promise<SesionPersonal | NextResponse> {
  const auth = await requireRole(...roles);
  if (auth instanceof NextResponse) return auth;
  let admin: SupabaseClient;
  try {
    admin = getAdminClient();
  } catch (err) {
    console.error('[personal] cliente de servicio no disponible:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Configuración del servidor incompleta.', code: 'SERVER_CONFIG' }, { status: 500 });
  }
  const org = await organizacionDe(admin, auth.user.id);
  if (org !== null && typeof org === 'object') return errorDb('[personal] organización', org);
  return { auth, admin, ctx: { rol: auth.role, userId: auth.user.id, organizacionId: org } };
}

/** Sesión para una ACCIÓN de la matriz: solo entran los roles que la tienen. */
export function iniciarSesionPersonal(accion: AccionPersonal): Promise<SesionPersonal | NextResponse> {
  return iniciar(rolesCon(accion));
}

/** Sesión para una lectura abierta a varios roles (lista explícita). */
export function iniciarSesionRoles(...roles: Role[]): Promise<SesionPersonal | NextResponse> {
  return iniciar(roles);
}

export interface AccionBitacora {
  accion: string;
  recurso_tipo: string;
  recurso_id?: string | null;
  /** Texto corto SIN datos personales (ni identidad, ni teléfono, ni nombres de titulares). */
  resumen: string;
  detalle?: Record<string, unknown>;
}

/**
 * Asienta una acción del personal en `bitacora_acciones` (045, append-only).
 * Se espera (await) para que la acción y su asiento viajen juntos; un fallo de
 * la bitácora se registra en el log del servidor y NO deshace la acción.
 */
export async function registrarAccion(s: SesionPersonal, a: AccionBitacora): Promise<void> {
  try {
    const { error } = await s.admin.from('bitacora_acciones').insert({
      actor_user_id: s.ctx.userId,
      actor_rol: s.ctx.rol,
      organizacion_id: s.ctx.organizacionId,
      accion: a.accion,
      recurso_tipo: a.recurso_tipo,
      recurso_id: a.recurso_id ?? null,
      resumen: a.resumen.slice(0, 500),
      detalle: a.detalle ?? {},
    });
    if (error) console.warn('[bitacora_acciones] asiento no registrado:', error.code);
  } catch (err) {
    console.warn('[bitacora_acciones] asiento no registrado:', err instanceof Error ? err.message : err);
  }
}

export async function leerCuerpo(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
}

export function noEncontrado(recurso = 'Registro'): NextResponse {
  return NextResponse.json({ error: `${recurso} no encontrado.` }, { status: 404 });
}
