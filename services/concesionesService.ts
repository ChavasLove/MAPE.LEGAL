/**
 * Concesiones Mineras (INHGEOMIN registry) service helpers.
 *
 * Data source: 3 PDFs transcritos al JSON `data/concesiones-mineras-registro.json`
 * → Supabase table `concesiones_mineras_registro` (migración 023).
 *
 * Tres categorías canónicas (deben mantenerse en sync con el CHECK constraint):
 *   - explotacion_otorgada
 *   - exploracion_otorgada
 *   - solicitud_pendiente
 *
 * El RPC `search_concesion_minera` (SECURITY DEFINER) bypasea RLS para que
 * María pueda llamar desde la anon-key sin depender de service_role BYPASSRLS.
 */

import { getSupabase } from '@/services/supabase';
import { getAdminClient } from '@/services/adminSupabase';

export type CategoriaConcesion =
  | 'explotacion_otorgada'
  | 'exploracion_otorgada'
  | 'solicitud_pendiente';

export type ClasificacionConcesion =
  | 'Metálica'
  | 'No Metálica'
  | 'Pequeña Minería Metálica'
  | 'Suspenso';

export interface ConcesionMinera {
  id:                  string;
  numero_registro:     number;
  codigo:              string | null;
  nombre_zona:         string;
  fecha_solicitud:     string | null;
  tipo_expediente:     string;
  solicitante:         string;
  estado_expediente:   string;
  clasificacion:       ClasificacionConcesion;
  categoria:           CategoriaConcesion;
  fuente:              string;
  fuente_documento:    string | null;
  fuente_pagina:       number | null;
  notas:               string | null;
  created_at:          string;
  updated_at:          string;
}

export interface ConcesionSearchResult {
  id:                  string;
  numero_registro:     number;
  codigo:              string | null;
  nombre_zona:         string;
  fecha_solicitud:     string | null;
  tipo_expediente:     string;
  solicitante:         string;
  estado_expediente:   string;
  clasificacion:       ClasificacionConcesion;
  categoria:           CategoriaConcesion;
  match_rank:          number;
}

export interface ConcesionStats {
  total:                  number;
  explotacion_otorgada:   number;
  exploracion_otorgada:   number;
  solicitud_pendiente:    number;
  metalicas:              number;
  no_metalicas:           number;
  pequena_mineria:        number;
  ultima_solicitud:       string | null;
}

export const CATEGORIA_LABELS: Record<CategoriaConcesion, string> = {
  explotacion_otorgada:  'Otorgada para Explotación',
  exploracion_otorgada:  'Otorgada para Exploración',
  solicitud_pendiente:   'Solicitud Pendiente',
};

export const CATEGORIA_SHORT: Record<CategoriaConcesion, string> = {
  explotacion_otorgada:  'Explotación',
  exploracion_otorgada:  'Exploración',
  solicitud_pendiente:   'En Solicitud',
};

/**
 * Llama el RPC `search_concesion_minera` (SECURITY DEFINER). Usa la anon-key,
 * adecuado tanto para flujos públicos como para María.
 *
 * - `query`: texto libre — busca en nombre_zona, solicitante, codigo, numero
 * - `categoria` / `clasificacion`: filtros opcionales
 * - `limit`: 1–50 (clamp en el RPC)
 */
export async function searchConcesion(opts: {
  query: string;
  categoria?: CategoriaConcesion | null;
  clasificacion?: ClasificacionConcesion | null;
  limit?: number;
}): Promise<ConcesionSearchResult[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('search_concesion_minera', {
    p_query:          opts.query,
    p_categoria:      opts.categoria ?? null,
    p_clasificacion:  opts.clasificacion ?? null,
    p_limit:          opts.limit ?? 10,
  });

  if (error) {
    console.warn('[concesionesService.searchConcesion] RPC error:', error.message);
    return [];
  }
  return (data ?? []) as ConcesionSearchResult[];
}

/**
 * Estadísticas globales del registro — KPIs para el dashboard admin y el MCP
 * de María. RPC con SECURITY DEFINER.
 */
export async function getConcesionStats(): Promise<ConcesionStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('concesiones_minera_stats');
  if (error) {
    console.warn('[concesionesService.getConcesionStats] RPC error:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    total:                Number(row.total ?? 0),
    explotacion_otorgada: Number(row.explotacion_otorgada ?? 0),
    exploracion_otorgada: Number(row.exploracion_otorgada ?? 0),
    solicitud_pendiente:  Number(row.solicitud_pendiente ?? 0),
    metalicas:            Number(row.metalicas ?? 0),
    no_metalicas:         Number(row.no_metalicas ?? 0),
    pequena_mineria:      Number(row.pequena_mineria ?? 0),
    ultima_solicitud:     row.ultima_solicitud ?? null,
  };
}

/**
 * Lista admin con filtros y paginación cursor-less. Usa service-role para
 * leer toda la tabla aunque RLS denegara al anon (no debería, pero es safer).
 */
export async function listConcesionesAdmin(opts: {
  categoria?: CategoriaConcesion | null;
  clasificacion?: ClasificacionConcesion | null;
  q?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ConcesionMinera[]; total: number }> {
  const admin = getAdminClient();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  let query = admin
    .from('concesiones_mineras_registro')
    .select('*', { count: 'exact' });

  if (opts.categoria)     query = query.eq('categoria', opts.categoria);
  if (opts.clasificacion) query = query.eq('clasificacion', opts.clasificacion);
  if (opts.q && opts.q.trim()) {
    const term = `%${opts.q.trim()}%`;
    query = query.or(`nombre_zona.ilike.${term},solicitante.ilike.${term},codigo.ilike.${term}`);
  }

  const { data, error, count } = await query
    .order('categoria', { ascending: true })
    .order('numero_registro', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[concesionesService.listConcesionesAdmin]', error.message);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as ConcesionMinera[], total: count ?? 0 };
}

/**
 * Renderiza un fragmento corto que María inyecta al system prompt cuando
 * detecta que el usuario preguntó por un nombre/empresa/zona del registro.
 * Mantiene 1 línea por concesión y se trunca a `max` resultados.
 */
export function renderConcesionContextForMaria(
  rows: ConcesionSearchResult[],
  max: number = 5,
): string {
  if (!rows.length) return '';
  const top = rows.slice(0, max);
  const lines = top.map(r => {
    const cat = CATEGORIA_SHORT[r.categoria];
    const codigo = r.codigo ? ` (cód. ${r.codigo})` : '';
    const fecha = r.fecha_solicitud ?? 's/f';
    return `• ${r.nombre_zona}${codigo} — ${r.solicitante} — ${cat} (${r.clasificacion}) — solicitud ${fecha}`;
  });
  return [
    'REGISTRO INHGEOMIN — concesiones encontradas (público):',
    ...lines,
    'Si el cliente quiere más detalle, sugiérele consultar www.mape.legal o el portal INHGEOMIN.',
  ].join('\n');
}
