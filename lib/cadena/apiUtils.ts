// lib/cadena/apiUtils.ts — utilidades SERVER-ONLY compartidas por las rutas
// /api/cadena/* (requireRole + contexto de cadena, mapeo de errores de
// PostgREST, lectura de JSON, carga de lote). Mantiene las invariantes de la
// auditoría PR #159 en un solo lugar: nunca se filtra `error.message` de
// Supabase al cliente, `console.error` antes de cada 500, 23505 → 409,
// 42P01/42883/PGRST202/PGRST205 → 503 MIGRATION_PENDING.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole, type AuthContext, type Role } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { esMigracionPendiente, getContextoCadena, MigracionPendienteError, type ContextoCadena } from './acceso';
import type { Lote } from './types';
import { isUuid } from './validacion';

export const MIGRACION_PENDIENTE_MSG =
  'La migración 043 (estándar privado de debida diligencia) no está aplicada en la base de datos.';

export function respuestaMigracionPendiente(detalle?: string): NextResponse {
  return NextResponse.json(
    { error: 'MIGRATION_PENDING', mensaje: MIGRACION_PENDIENTE_MSG, detalle: detalle ?? null },
    { status: 503 },
  );
}

export interface SesionCadena {
  auth: AuthContext;
  ctx: ContextoCadena;
  admin: SupabaseClient;
}

/**
 * requireRole + resolución del contexto de cadena con un cliente service-role
 * lazy (nunca a nivel de módulo). Devuelve NextResponse ante 401/403/503/500.
 */
export async function iniciarSesionCadena(...roles: Role[]): Promise<SesionCadena | NextResponse> {
  const auth = await requireRole(...roles);
  if (auth instanceof NextResponse) return auth;
  let admin: SupabaseClient;
  try {
    admin = getAdminClient();
  } catch (err) {
    console.error('[cadena] admin client unavailable:', err);
    return NextResponse.json({ error: 'Configuración del servidor incompleta.', code: 'SERVER_CONFIG' }, { status: 500 });
  }
  try {
    const ctx = await getContextoCadena(auth, admin);
    return { auth, ctx, admin };
  } catch (err) {
    if (err instanceof MigracionPendienteError) return respuestaMigracionPendiente(err.message);
    console.error('[cadena] contexto failed:', err);
    return NextResponse.json({ error: 'No se pudo resolver el contexto del usuario.' }, { status: 500 });
  }
}

type PgError = { code?: string; message?: string; details?: string; hint?: string };

/**
 * Mapea un error de PostgREST a la respuesta HTTP canónica. `scope` es el
 * prefijo de log (p. ej. '[cadena/lotes POST]').
 */
export function respuestaErrorDb(scope: string, error: PgError, mensajes: { conflicto?: string; generico?: string } = {}): NextResponse {
  if (esMigracionPendiente(error)) {
    console.error(`${scope} migración 043 pendiente:`, error.code, error.message);
    return respuestaMigracionPendiente(error.message ?? error.code);
  }
  if (error.code === '23505') {
    return NextResponse.json({ error: mensajes.conflicto ?? 'Ya existe un registro con esa clave.' }, { status: 409 });
  }
  if (error.code === '23503') {
    return NextResponse.json({ error: 'Referencia inválida (registro relacionado inexistente).' }, { status: 400 });
  }
  if (error.code === '23514') {
    return NextResponse.json({ error: 'Datos fuera de los valores permitidos.' }, { status: 400 });
  }
  console.error(`${scope} failed:`, error);
  return NextResponse.json({ error: mensajes.generico ?? 'Error interno.' }, { status: 500 });
}

export async function leerJson(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
}

/**
 * Carga un lote por id. Devuelve `null` si no existe o el id no es uuid; o un
 * NextResponse si la BD falló (ya mapeado). Los handlers deben responder 404
 * también cuando el lote existe pero el rol no lo alcanza (sin enumeración).
 */
export async function cargarLote(admin: SupabaseClient, id: string, scope: string): Promise<Lote | null | NextResponse> {
  if (!isUuid(id)) return null;
  const { data, error } = await admin.from('lotes').select('*').eq('id', id).maybeSingle();
  if (error) return respuestaErrorDb(scope, error, { generico: 'Error al obtener el lote' });
  return (data as Lote | null) ?? null;
}

export function noEncontrado(recurso = 'Registro'): NextResponse {
  return NextResponse.json({ error: `${recurso} no encontrado.` }, { status: 404 });
}
