// lib/recepcion/servidor.ts — utilidades SERVER-ONLY de /api/recepcion/*.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorDb, type SesionPersonal } from '@/lib/acceso/sesionPersonal';
import { alcanzaPunto } from '@/lib/acceso/personal';
import { REGLA_MENSAJE, type PuntoRecepcion } from './types';
import { generarCodigo } from './validacion';

/** Respuesta para una regla de integridad incumplida. */
export function respuestaRegla(motivo: string, status = 409, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error: REGLA_MENSAJE[motivo] ?? 'La operación no cumple una regla de integridad.', motivo, ...extra }, { status });
}

/** Traduce un 23514 de los triggers de la 047 (`codigo: texto`) a la respuesta de regla. */
export function errorRecepcion(scope: string, error: { code?: string; message?: string }, generico: string): NextResponse {
  if (error.code === '23514') {
    const clave = /^([a-z_]+):/.exec(error.message ?? '')?.[1];
    if (clave && REGLA_MENSAJE[clave]) return respuestaRegla(clave);
  }
  return errorDb(scope, error, generico);
}

/**
 * Punto de recepción si existe Y el usuario lo alcanza; null en caso contrario
 * (la ruta responde 404 en ambos casos: no se revela la existencia de puntos ajenos).
 */
export async function puntoAlcanzable(s: SesionPersonal, puntoId: string): Promise<PuntoRecepcion | null | NextResponse> {
  const { data, error } = await s.admin.from('puntos_recepcion').select('id, organizacion_id, tipo, nombre, activo').eq('id', puntoId).maybeSingle();
  if (error) return errorDb('[recepcion] punto', error, 'Error al obtener el punto de recepción');
  const p = data as PuntoRecepcion | null;
  if (!p || !alcanzaPunto(s.ctx, p)) return null;
  return p;
}

/** Ids de los puntos que el usuario alcanza; null = todos. */
export async function puntosDelUsuario(s: SesionPersonal): Promise<string[] | null | NextResponse> {
  if (s.ctx.rol !== 'recepcion') return null;
  if (!s.ctx.organizacionId) return [];
  const { data, error } = await s.admin.from('puntos_recepcion').select('id').eq('organizacion_id', s.ctx.organizacionId);
  if (error) return errorDb('[recepcion] puntos', error, 'Error al obtener los puntos de recepción');
  return ((data ?? []) as Array<{ id: string }>).map((p) => p.id);
}

export async function siguienteCodigo(admin: SupabaseClient, tabla: 'recepciones' | 'cajas', prefijo: string): Promise<string | NextResponse> {
  const year = new Date().getFullYear();
  const { data, error } = await admin.from(tabla).select('codigo').like('codigo', `${prefijo}-${year}-%`);
  if (error) return errorDb(`[recepcion] código ${tabla}`, error, 'Error al generar el código');
  return generarCodigo(prefijo, ((data ?? []) as Array<{ codigo: string }>).map((r) => r.codigo), year);
}
