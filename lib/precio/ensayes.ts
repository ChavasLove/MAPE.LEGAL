// Verificaciones externas trimestrales (Adenda 01, Tarea 7).
//
// Server-only: agrega las filas de `ensayes` con tipo='verificacion_externa'
// por (fecha, laboratorio) y calcula la desviación observada respecto del
// método de liquidación emparejando por lote. El emparejamiento necesita
// leer también los ensayes de liquidación — que la RLS pública no expone,
// deliberadamente — así que la lectura usa el cliente service-role dentro de
// la función (la key nunca llega al navegador; la superficie pública es de
// solo lectura y renderizada por el servidor).

import { getAdminClient } from '@/services/adminSupabase';

export interface VerificacionExterna {
  /** Fecha del registro (YYYY-MM-DD). */
  fecha: string;
  laboratorio: string;
  /** Número de muestras ciegas del envío. */
  muestras: number;
  /**
   * Desviación promedio (ley del laboratorio − ley de liquidación del mismo
   * lote) en puntos porcentuales de ley. null cuando ningún lote del envío
   * tiene ensaye de liquidación emparejable.
   */
  desviacion_pp: number | null;
}

interface EnsayeRow {
  lote: string;
  tipo: string;
  laboratorio: string | null;
  ley_oro_ppm: number | string;
  created_at: string;
}

const PPM_POR_PUNTO_PORCENTUAL = 10_000;

export async function getVerificacionesExternas(): Promise<VerificacionExterna[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('ensayes')
      .select('lote, tipo, laboratorio, ley_oro_ppm, created_at')
      .in('tipo', ['verificacion_externa', 'liquidacion'])
      .eq('estado', 'vigente')
      .order('created_at', { ascending: false })
      .limit(800);
    if (error) throw error;

    const rows = (data ?? []) as EnsayeRow[];
    const verificaciones = rows.filter((r) => r.tipo === 'verificacion_externa');
    if (verificaciones.length === 0) return [];

    // Ley de liquidación más reciente por lote (las filas vienen desc).
    const liquidacionPorLote = new Map<string, number>();
    for (const r of rows) {
      if (r.tipo === 'liquidacion' && !liquidacionPorLote.has(r.lote)) {
        liquidacionPorLote.set(r.lote, Number(r.ley_oro_ppm));
      }
    }

    const grupos = new Map<string, { fecha: string; laboratorio: string; desvios: number[]; muestras: number }>();
    for (const v of verificaciones) {
      const fecha = v.created_at.slice(0, 10);
      const laboratorio = v.laboratorio?.trim() || '—';
      const key = `${fecha}|${laboratorio}`;
      let g = grupos.get(key);
      if (!g) {
        g = { fecha, laboratorio, desvios: [], muestras: 0 };
        grupos.set(key, g);
      }
      g.muestras += 1;
      const liq = liquidacionPorLote.get(v.lote);
      if (liq !== undefined && Number.isFinite(liq)) {
        g.desvios.push((Number(v.ley_oro_ppm) - liq) / PPM_POR_PUNTO_PORCENTUAL);
      }
    }

    return [...grupos.values()]
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .map((g) => ({
        fecha: g.fecha,
        laboratorio: g.laboratorio,
        muestras: g.muestras,
        desviacion_pp:
          g.desvios.length > 0
            ? g.desvios.reduce((s, d) => s + d, 0) / g.desvios.length
            : null,
      }));
  } catch (e) {
    console.error(
      '[precio] verificaciones externas no-fatal (¿migración 031 aplicada en Supabase Studio?):',
      (e as { message?: string })?.message,
    );
    return [];
  }
}
