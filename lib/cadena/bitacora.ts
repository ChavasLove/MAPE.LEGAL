// lib/cadena/bitacora.ts — bitácora de accesos del estándar privado.
//
// Cada lectura exitosa de un recurso de la cadena (y cada exportación) deja
// una fila en `bitacora_accesos` (migración 043): quién, con qué rol y
// organización, qué acción, sobre qué recurso. Es append-only y alimenta la
// trazabilidad que exige el estándar (y, para el expediente del minero, la
// evidencia de que el acceso ocurrió bajo consentimiento vigente).
//
// Fire-and-forget: nunca bloquea ni rompe la respuesta. Si la migración no
// está aplicada o la escritura falla, se loggea con prefijo [bitacora] y la
// respuesta al usuario sigue igual.

import { getAdminClient } from '@/services/adminSupabase';
import type { AccionBitacora } from './types';
import type { ContextoCadena } from './acceso';

export interface RegistroAccesoInput {
  ctx: ContextoCadena;
  accion: AccionBitacora;
  /** p. ej. 'lote', 'lotes', 'fuente', 'expediente_minero', 'consentimiento', 'bitacora', 'exportacion'. */
  recurso_tipo: string;
  recurso_id?: string | null;
  detalle?: Record<string, unknown>;
}

export function registrarAcceso(input: RegistroAccesoInput): void {
  try {
    const admin = getAdminClient();
    const fila = {
      user_id: input.ctx.userId,
      rol: input.ctx.rol,
      organizacion_id: input.ctx.organizacionId,
      accion: input.accion,
      recurso_tipo: input.recurso_tipo,
      recurso_id: input.recurso_id ?? null,
      detalle: input.detalle ?? {},
    };
    // El builder de supabase-js es thenable: envolverlo en Promise.resolve lo
    // ejecuta y da acceso a .catch.
    void Promise.resolve(admin.from('bitacora_accesos').insert(fila))
      .then(({ error }) => {
        if (error) console.warn('[bitacora] insert failed (non-fatal):', error.code, error.message);
      })
      .catch((err: unknown) => {
        console.warn('[bitacora] insert threw (non-fatal):', err);
      });
  } catch (err) {
    // getAdminClient sin env vars, etc. — jamás propaga.
    console.warn('[bitacora] skipped (non-fatal):', err);
  }
}
