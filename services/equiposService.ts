/**
 * Equipment Marketplace Service (Mercado de Equipos).
 *
 * Public reads go through the anon proxy client (`services/supabase.ts`) via
 * the SECURITY DEFINER RPCs of migration 027 — same pattern as
 * `concesionesService`. Admin writes use `getAdminClient()` (service-role),
 * always instantiated inside the function — never at module level (breaks the
 * Next.js build when env vars are missing at page-data-collection time).
 */

import { supabase } from '@/services/supabase';
import { getAdminClient } from '@/services/adminSupabase';
import { sanitizeIlikeTerm } from '@/services/concesionesService';
import type {
  EquipoMercado,
  EquipoSearchResult,
  EquipoFilters,
  CategoriaStat,
  EquipoCategoria,
} from '@/lib/types/equipo';

// ==================== PUBLIC READS (anon client) ====================

export async function searchEquipos(
  filters: EquipoFilters = {},
  limit = 50,
  offset = 0
): Promise<{ equipos: EquipoSearchResult[]; total: number }> {
  // Cap + escape ilike metachars (% _ \) before the RPC's ILIKE fallback —
  // same sanitizeIlikeTerm invariant as concesiones/María (PR #159/#167 §29).
  // Without this, q='%' matches every row and defeats the filter.
  const rawQuery = (filters.query ?? '').slice(0, 100);
  const safeQuery = rawQuery ? sanitizeIlikeTerm(rawQuery) : '';

  const rpcParams = {
    p_query:      safeQuery || null,
    p_categoria:  filters.categoria || null,
    p_precio_min: filters.precioMin ?? null,
    p_precio_max: filters.precioMax ?? null,
  };

  const { data, error } = await supabase.rpc('search_equipos_mercado', {
    ...rpcParams,
    p_limit:  limit,
    p_offset: offset,
  });

  if (error) {
    console.error('[equiposService] search error:', error);
    throw new Error('Error al buscar equipos');
  }

  const equipos = (data || []) as EquipoSearchResult[];
  let total = equipos.length > 0 ? Number(equipos[0].total_count) : 0;

  // The RPC carries total_count on returned rows only — a page past the end
  // returns 0 rows, which used to collapse total to 0 for paginating
  // consumers. Probe page 0 (1 row) to recover the real total in that case.
  if (equipos.length === 0 && offset > 0) {
    const probe = await supabase.rpc('search_equipos_mercado', {
      ...rpcParams,
      p_limit:  1,
      p_offset: 0,
    });
    if (!probe.error && probe.data?.length) {
      total = Number((probe.data[0] as EquipoSearchResult).total_count);
    }
  }

  return { equipos, total };
}

export async function getEquipoBySlug(slug: string): Promise<EquipoMercado | null> {
  const { data, error } = await supabase.rpc('get_equipo_by_slug', {
    p_slug: slug,
  });

  if (error) {
    console.error('[equiposService] getBySlug error:', error);
    throw new Error('Error al cargar el equipo');
  }

  return (data?.[0] as EquipoMercado) || null;
}

export async function getCategoriaStats(): Promise<CategoriaStat[]> {
  const { data, error } = await supabase.rpc('equipos_categoria_stats');

  if (error) {
    console.error('[equiposService] categoriaStats error:', error);
    return [];
  }

  return (data || []) as CategoriaStat[];
}

// ==================== ADMIN WRITES (service-role client) ====================

export interface CreateEquipoInput {
  slug: string;
  nombre: string;
  descripcion?: string;
  descripcion_corta?: string;
  categoria: EquipoCategoria;
  proveedor: string;
  precio_min_usd: number;
  // null clears the stored max (single fixed price); undefined leaves it as-is
  precio_max_usd?: number | null;
  moq?: number;
  unidad_moq?: string;
  capacidad?: string;
  potencia?: string;
  peso?: string;
  dimensiones?: string;
  imagen_url: string;
  galeria_urls?: string[];
  especificaciones?: Record<string, string>;
  destacado?: boolean;
  orden?: number;
}

export async function createEquipo(input: CreateEquipoInput): Promise<EquipoMercado> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('equipos_mercado')
    .insert({
      ...input,
      moq: input.moq ?? 1,
      unidad_moq: input.unidad_moq ?? 'Pieza',
      activo: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[equiposService] create error:', error);
    if (error.code === '23505') {
      throw new Error('Ya existe un equipo con ese slug');
    }
    throw new Error('Error al crear el equipo');
  }

  return data as EquipoMercado;
}

export async function updateEquipo(
  id: string,
  input: Partial<CreateEquipoInput> & { activo?: boolean }
): Promise<EquipoMercado> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('equipos_mercado')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[equiposService] update error:', error);
    if (error.code === '23505') {
      throw new Error('Ya existe un equipo con ese slug');
    }
    throw new Error('Error al actualizar el equipo');
  }

  return data as EquipoMercado;
}

export async function deleteEquipo(id: string): Promise<void> {
  // Soft delete — set activo = false. Public surfaces only ever see
  // activo = true rows (RLS policy + RPC filters).
  const admin = getAdminClient();
  const { error } = await admin
    .from('equipos_mercado')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[equiposService] delete error:', error);
    throw new Error('Error al eliminar el equipo');
  }
}

export async function listEquiposAdmin(
  page = 1,
  pageSize = 50
): Promise<{ equipos: EquipoMercado[]; total: number }> {
  const admin = getAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await admin
    .from('equipos_mercado')
    .select('*', { count: 'exact' })
    .order('orden', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[equiposService] listAdmin error:', error);
    throw new Error('Error al listar equipos');
  }

  return { equipos: (data || []) as EquipoMercado[], total: count || 0 };
}
