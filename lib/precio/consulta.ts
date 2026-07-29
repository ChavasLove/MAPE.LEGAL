// Lecturas del Precio de Referencia — helper compartido por GET /api/precio,
// GET /api/precio/historico y la página pública /precio, para que la página
// y la API nunca puedan divergir en la regla "vigente de hoy o último
// vigente anterior".
//
// Usa el cliente anónimo (proxy lazy de services/supabase.ts): la policy
// precios_referencia_lectura_publica expone únicamente registros 'vigente',
// que es exactamente lo que estas superficies públicas deben ver. El
// historial completo (incluye 'reemplazado') se lee con service-role solo
// desde el panel /dashboard/precio.

import { supabase } from '@/services/supabase';

export interface PrecioReferenciaRow {
  id: string;
  fecha: string;
  hora_fijacion: string;
  referencia_lbma_usd_oz: number;
  tipo_cambio_bch: number;
  factor_comercializacion: number;
  version_politica: string;
  precio_lempiras_gramo_fino: number;
  estado: 'vigente' | 'reemplazado';
  reemplaza_a: string | null;
  motivo_reemplazo: string | null;
  created_at: string;
}

export const PRECIO_REFERENCIA_COLS =
  'id, fecha, hora_fijacion, referencia_lbma_usd_oz, tipo_cambio_bch, ' +
  'factor_comercializacion, version_politica, precio_lempiras_gramo_fino, ' +
  'estado, reemplaza_a, motivo_reemplazo, created_at';

// PostgREST serializa numeric como string — coaccionar a Number (misma
// convención que combustiblesService.normalize()).
export function normalizePrecioRow(row: Record<string, unknown>): PrecioReferenciaRow {
  const num = (v: unknown) => Number(v);
  return {
    id: String(row.id),
    fecha: String(row.fecha),
    hora_fijacion: String(row.hora_fijacion),
    referencia_lbma_usd_oz: num(row.referencia_lbma_usd_oz),
    tipo_cambio_bch: num(row.tipo_cambio_bch),
    factor_comercializacion: num(row.factor_comercializacion),
    version_politica: String(row.version_politica),
    precio_lempiras_gramo_fino: num(row.precio_lempiras_gramo_fino),
    estado: row.estado === 'reemplazado' ? 'reemplazado' : 'vigente',
    reemplaza_a: row.reemplaza_a ? String(row.reemplaza_a) : null,
    motivo_reemplazo: row.motivo_reemplazo ? String(row.motivo_reemplazo) : null,
    created_at: String(row.created_at),
  };
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Honduras (UTC-6, sin DST). */
export function fechaHondurasHoy(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export interface PrecioReferenciaHoy {
  hoy: string;
  vigente: PrecioReferenciaRow | null;
  /** Último vigente anterior a hoy — solo se consulta cuando hoy no tiene fijación. */
  anterior: PrecioReferenciaRow | null;
}

/**
 * Registro vigente de la fecha actual (hora de Honduras). Si no hay precio
 * fijado hoy, devuelve además el último vigente anterior. Nunca extrapola
 * ni recalcula. Degrada a nulls (con log) si la migración 030 no está
 * aplicada — las superficies públicas no deben 500-ear por eso.
 */
export async function getPrecioReferenciaHoy(): Promise<PrecioReferenciaHoy> {
  const hoy = fechaHondurasHoy();
  try {
    const { data: vigente, error } = await supabase
      .from('precios_referencia')
      .select(PRECIO_REFERENCIA_COLS)
      .eq('estado', 'vigente')
      .eq('fecha', hoy)
      .maybeSingle();
    if (error) throw error;
    if (vigente) {
      return { hoy, vigente: normalizePrecioRow(vigente), anterior: null };
    }

    const { data: anterior, error: errAnterior } = await supabase
      .from('precios_referencia')
      .select(PRECIO_REFERENCIA_COLS)
      .eq('estado', 'vigente')
      .lt('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errAnterior) throw errAnterior;

    return { hoy, vigente: null, anterior: anterior ? normalizePrecioRow(anterior) : null };
  } catch (e) {
    console.error(
      '[precio] lectura no-fatal (¿migración 030 aplicada en Supabase Studio?):',
      (e as { message?: string })?.message,
    );
    return { hoy, vigente: null, anterior: null };
  }
}

const HISTORICO_MAX = 365;

/**
 * Registros vigentes ordenados por fecha descendente, máximo 365.
 * Evidencia de auditoría — solo estado 'vigente' (la policy pública no
 * expone más).
 */
export async function getHistorialVigente(
  desde?: string,
  hasta?: string,
  limit: number = HISTORICO_MAX,
): Promise<PrecioReferenciaRow[]> {
  try {
    let query = supabase
      .from('precios_referencia')
      .select(PRECIO_REFERENCIA_COLS)
      .eq('estado', 'vigente')
      .order('fecha', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), HISTORICO_MAX));
    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(normalizePrecioRow);
  } catch (e) {
    console.error(
      '[precio] historial no-fatal (¿migración 030 aplicada en Supabase Studio?):',
      (e as { message?: string })?.message,
    );
    return [];
  }
}
