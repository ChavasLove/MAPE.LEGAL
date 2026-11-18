// lib/cadena/disponibilidad.ts — ¿están aplicadas las tablas de la migración
// 043 (estándar privado de debida diligencia)?
//
// Las páginas server de /dashboard/cadena/* y /portal/lotes llaman a
// moduloCadenaDisponible() ANTES de montar su isla cliente: si la base de
// datos todavía no tiene las tablas, renderizan <ModuloEnPreparacion /> en vez
// de dejar que la UI falle contra /api/cadena/*. La sonda es una sola lectura
// HEAD sobre `lotes` con el cliente service-role (lazy, nunca a nivel de
// módulo — regla §Framework de CLAUDE.md).
//
// Semántica deliberada:
//   · tabla inexistente (42P01 / PGRST205 / 42703 / …) → 'migracion_pendiente'
//     → la página muestra "Módulo en preparación".
//   · cualquier OTRO fallo (sin service key, red, permisos) → 'error' → la
//     página se renderiza normalmente y la isla cliente informa el fallo real.
//     Un corte de Supabase no debe disfrazarse de "módulo en preparación".
//
// clasificarErrorSonda() y sondearTablasCadena() son puras respecto a Supabase
// (reciben el cliente) y se prueban en tests/cadena-disponibilidad.test.ts.

import { getAdminClient } from '@/services/adminSupabase';
import { esMigracionPendiente } from './acceso';

/** Tabla que se sondea: existe solo si la 043 está aplicada. */
export const TABLA_SONDA_043 = 'lotes';

export type EstadoModuloCadena =
  | { disponible: true }
  | { disponible: false; motivo: 'migracion_pendiente'; detalle: string }
  | { disponible: false; motivo: 'error'; detalle: string };

export interface ErrorSonda {
  code?: string;
  message?: string;
}

/** Forma mínima del cliente que necesita la sonda (subset de SupabaseClient). */
export interface ClienteSonda {
  from(table: string): {
    select(
      columns: string,
      opts?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' },
    ): PromiseLike<{ error: ErrorSonda | null }>;
  };
}

/** Pura: traduce el resultado de la sonda al estado del módulo. */
export function clasificarErrorSonda(error: ErrorSonda | null | undefined): EstadoModuloCadena {
  if (!error) return { disponible: true };
  const detalle = `${error.code ?? 'sin código'}: ${error.message ?? 'sin mensaje'}`;
  if (esMigracionPendiente(error)) return { disponible: false, motivo: 'migracion_pendiente', detalle };
  return { disponible: false, motivo: 'error', detalle };
}

/**
 * Sonda HEAD sobre `lotes`. Nunca lanza: una excepción del cliente se reporta
 * como { motivo: 'error' } para que la página siga renderizando.
 */
export async function sondearTablasCadena(client: ClienteSonda): Promise<EstadoModuloCadena> {
  try {
    const { error } = await client.from(TABLA_SONDA_043).select('id', { head: true, count: 'exact' });
    return clasificarErrorSonda(error);
  } catch (err) {
    return { disponible: false, motivo: 'error', detalle: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Server-only. Resuelve el cliente service-role de forma lazy; si la
 * configuración del servidor está incompleta, devuelve 'error' (no
 * 'migracion_pendiente') y deja el log para Vercel.
 */
export async function moduloCadenaDisponible(): Promise<EstadoModuloCadena> {
  let client: ClienteSonda;
  try {
    client = getAdminClient() as unknown as ClienteSonda;
  } catch (err) {
    console.error('[cadena/disponibilidad] admin client unavailable:', err);
    return { disponible: false, motivo: 'error', detalle: 'SERVER_CONFIG' };
  }
  const estado = await sondearTablasCadena(client);
  if (!estado.disponible) {
    const log = estado.motivo === 'migracion_pendiente' ? console.warn : console.error;
    log(`[cadena/disponibilidad] ${estado.motivo}:`, estado.detalle);
  }
  return estado;
}
