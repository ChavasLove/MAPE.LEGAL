/**
 * Types for the Equipment Marketplace (Mercado de Equipos).
 * Spanish domain names, English engineering.
 *
 * CATEGORIA_LABELS must stay in sync with the CHECK constraint and the
 * `equipos_categoria_stats()` RPC labels in migration 027.
 */

export type EquipoCategoria =
  | 'planta_lavado_oro'
  | 'trommel'
  | 'sluice_box'
  | 'mesa_concentracion'
  | 'chancadora'
  | 'bomba_agua'
  | 'generador'
  | 'criba_vibratoria'
  | 'caja_esclusa'
  | 'equipo_portatil';

export const CATEGORIA_LABELS: Record<EquipoCategoria, string> = {
  planta_lavado_oro:  'Planta de Lavado de Oro',
  trommel:            'Trommel / Criba Rotativa',
  sluice_box:         'Sluice Box / Canaletas',
  mesa_concentracion: 'Mesa de Concentración',
  chancadora:         'Chancadora / Molino',
  bomba_agua:         'Bomba de Agua',
  generador:          'Generador Eléctrico',
  criba_vibratoria:   'Criba Vibratoria',
  caja_esclusa:       'Caja de Esclusa',
  equipo_portatil:    'Equipo Portátil',
};

export interface EquipoMercado {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  categoria: EquipoCategoria;
  proveedor: string;
  precio_min_usd: number;
  precio_max_usd: number | null;
  moq: number;
  unidad_moq: string;
  capacidad: string | null;
  potencia: string | null;
  peso: string | null;
  dimensiones: string | null;
  imagen_url: string;
  galeria_urls: string[];
  especificaciones: Record<string, string>;
  destacado: boolean;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface EquipoSearchResult {
  id: string;
  slug: string;
  nombre: string;
  descripcion_corta: string | null;
  categoria: EquipoCategoria;
  proveedor: string;
  precio_min_usd: number;
  precio_max_usd: number | null;
  moq: number;
  unidad_moq: string;
  capacidad: string | null;
  imagen_url: string;
  destacado: boolean;
  total_count: number;
}

export interface EquipoFilters {
  query?: string;
  categoria?: EquipoCategoria;
  precioMin?: number;
  precioMax?: number;
}

export interface CategoriaStat {
  categoria: EquipoCategoria;
  count: number;
  label: string;
}

export interface EquipoSearchResponse {
  equipos: EquipoSearchResult[];
  total: number;
}
