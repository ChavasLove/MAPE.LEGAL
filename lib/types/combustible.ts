// Types for `precios_combustibles` (migration 028) — Honduras fuel prices set
// weekly by the Secretaría de Energía (SEN).

export type TipoCombustible =
  | 'diesel'
  | 'gasolina_regular'
  | 'gasolina_superior'
  | 'kerosene'
  | 'glp';

// Keep in sync with the CHECK constraint in migration 028. Labels are the
// Spanish display names (María is ES-only; the widget chrome is bilingual but
// fuel names stay ES — they are Honduran regulatory categories).
export const COMBUSTIBLE_LABELS: Record<TipoCombustible, string> = {
  diesel:            'Diésel',
  gasolina_regular:  'Gasolina regular',
  gasolina_superior: 'Gasolina súper',
  kerosene:          'Queroseno',
  glp:               'GLP',
};

export const TIPOS_COMBUSTIBLE: readonly TipoCombustible[] = [
  'diesel',
  'gasolina_regular',
  'gasolina_superior',
  'kerosene',
  'glp',
] as const;

export function isTipoCombustible(v: unknown): v is TipoCombustible {
  return typeof v === 'string' && (TIPOS_COMBUSTIBLE as readonly string[]).includes(v);
}

export interface Combustible {
  id: string;
  combustible: TipoCombustible;
  precio_hnl: number;
  unidad: string;
  zona: string;
  vigente_desde: string; // ISO date (YYYY-MM-DD)
  fuente: string;
  notas: string | null;
  activo: boolean;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

// ─── Semana SEN (vigencia) ──────────────────────────────────────────────────
// La SEN publica la estructura de precios cada lunes (6:00 a.m.). Un valor con
// `vigente_desde` anterior al lunes de la semana en curso (hora Honduras) está
// vencido. Estos helpers son puros y los comparten el cron de frescura, el API
// público (/api/precios/live) y el panel admin — una sola definición de "vencido".

/**
 * Lunes (YYYY-MM-DD) de la semana en curso en hora de Honduras. Aritmética de
 * fechas sobre un ancla UTC, mismo patrón que pricingService.effectivePriceDate().
 */
export function lunesSemanaSenHN(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const anchor = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  // getUTCDay: 0=Dom … 6=Sáb → días transcurridos desde el lunes.
  const sinceMonday = (anchor.getUTCDay() + 6) % 7;
  anchor.setUTCDate(anchor.getUTCDate() - sinceMonday);
  return anchor.toISOString().slice(0, 10);
}

/** true cuando la vigencia falta o es anterior al lunes de la semana SEN en curso. */
export function esVigenciaDesactualizada(
  vigenteDesde: string | null | undefined,
  lunesSemana: string = lunesSemanaSenHN(),
): boolean {
  // Ambos son YYYY-MM-DD → la comparación lexicográfica es cronológica.
  return !vigenteDesde || vigenteDesde < lunesSemana;
}
