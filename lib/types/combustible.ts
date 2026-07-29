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
