/**
 * Fuel prices service (precios_combustibles, migration 028).
 *
 * Public reads go through the anon proxy client (`services/supabase.ts`) —
 * migration 028 grants anon SELECT on active rows. Admin writes use
 * `getAdminClient()` (service-role), always instantiated inside the function —
 * never at module level (breaks the Next.js build when env vars are missing at
 * page-data-collection time). Same split as `equiposService`.
 */

import { supabase } from '@/services/supabase';
import { getAdminClient } from '@/services/adminSupabase';
import {
  type Combustible,
  type TipoCombustible,
  isTipoCombustible,
} from '@/lib/types/combustible';

const SELECT_COLS =
  'id, combustible, precio_hnl, unidad, zona, vigente_desde, fuente, notas, activo, updated_by, updated_at, created_at';

// Coerce the numeric column (PostgREST returns numeric as string) to a number.
function normalize(row: Record<string, unknown>): Combustible {
  return {
    ...(row as unknown as Combustible),
    precio_hnl: Number(row.precio_hnl),
  };
}

// ==================== PUBLIC READS (anon client) ====================

/** All active fuels, cheapest concept first (diesel is what miners care about). */
export async function getCombustibles(): Promise<Combustible[]> {
  const { data, error } = await supabase
    .from('precios_combustibles')
    .select(SELECT_COLS)
    .eq('activo', true)
    .order('combustible', { ascending: true });

  if (error) {
    console.error('[combustiblesService] getCombustibles error:', error);
    // Non-fatal for the public widget — an empty list degrades to "no diesel
    // card" rather than a 500. The migration may simply not be applied yet.
    return [];
  }
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/** Single active fuel (e.g. diesel), or null. */
export async function getCombustible(
  tipo: TipoCombustible,
): Promise<Combustible | null> {
  const { data, error } = await supabase
    .from('precios_combustibles')
    .select(SELECT_COLS)
    .eq('combustible', tipo)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    console.error('[combustiblesService] getCombustible error:', error);
    return null;
  }
  return data ? normalize(data as Record<string, unknown>) : null;
}

// ==================== ADMIN READS + WRITES (service-role client) ====================

/** Every fuel row (including inactive) for the admin editor. */
export async function listCombustiblesAdmin(): Promise<Combustible[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('precios_combustibles')
    .select(SELECT_COLS)
    .order('combustible', { ascending: true });

  if (error) {
    console.error('[combustiblesService] listAdmin error:', error);
    throw new Error('Error al listar los precios de combustibles');
  }
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export interface UpsertCombustibleInput {
  combustible: TipoCombustible;
  precio_hnl: number;
  unidad?: string;
  zona?: string;
  vigente_desde?: string; // ISO date
  fuente?: string;
  notas?: string | null;
  activo?: boolean;
  updated_by?: string | null;
}

/**
 * Insert-or-update a fuel by its unique `combustible` key. Used by the admin
 * editor so updating diesel each Monday is a single call.
 */
export async function upsertCombustible(
  input: UpsertCombustibleInput,
): Promise<Combustible> {
  if (!isTipoCombustible(input.combustible)) {
    throw new Error('Tipo de combustible inválido');
  }
  if (!Number.isFinite(input.precio_hnl) || input.precio_hnl <= 0) {
    throw new Error('El precio debe ser un número mayor a 0');
  }

  const admin = getAdminClient();
  const payload: Record<string, unknown> = {
    combustible: input.combustible,
    precio_hnl:  input.precio_hnl,
    updated_at:  new Date().toISOString(),
  };
  if (input.unidad !== undefined)        payload.unidad = input.unidad;
  if (input.zona !== undefined)          payload.zona = input.zona;
  if (input.vigente_desde !== undefined) payload.vigente_desde = input.vigente_desde;
  if (input.fuente !== undefined)        payload.fuente = input.fuente;
  if (input.notas !== undefined)         payload.notas = input.notas;
  if (input.activo !== undefined)        payload.activo = input.activo;
  if (input.updated_by !== undefined)    payload.updated_by = input.updated_by;

  const { data, error } = await admin
    .from('precios_combustibles')
    .upsert(payload, { onConflict: 'combustible' })
    .select(SELECT_COLS)
    .single();

  if (error || !data) {
    console.error('[combustiblesService] upsert error:', error);
    throw new Error('Error al guardar el precio del combustible');
  }
  return normalize(data as Record<string, unknown>);
}
