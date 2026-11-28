// lib/publicaciones/types.ts
// ---------------------------------------------------------------------------
// Marketplace abierto de publicaciones (DEC-2026-11-27-2) — contrato en
// TypeScript de la migración 044_publicaciones_marketplace.sql (NO aplicada).
//
// Cada participante publica su producción estimada y sus precios de compra y
// venta. CHT no carga esos precios, no compra, no vende, no intermedia ni
// administra fondos; estas publicaciones NO sustituyen al precio informativo
// del oro (oro × tipo de compra del BCH ÷ 31.1034768). Módulo puro: sin red,
// sin base de datos, importable desde server y client. Las reglas replican
// los CHECK de la 044 y se prueban en tests/publicaciones.test.ts.
// ---------------------------------------------------------------------------

export const PUBLICACION_ESTADOS = ['borrador', 'publicada', 'retirada'] as const;
export type PublicacionEstado = (typeof PUBLICACION_ESTADOS)[number];

export const PUBLICACION_TIPOS = ['produccion', 'compra', 'venta', 'mixta'] as const;
export type PublicacionTipo = (typeof PUBLICACION_TIPOS)[number];

export const PARTICIPANTE_TIPOS = ['productor', 'comprador', 'planta', 'otro'] as const;
export type ParticipanteTipo = (typeof PARTICIPANTE_TIPOS)[number];

export const MONEDAS = ['HNL', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];

export const PRODUCCION_UNIDADES = ['g', 'kg', 'oz_troy', 'dwt'] as const;
export type ProduccionUnidad = (typeof PRODUCCION_UNIDADES)[number];

export const PRECIO_UNIDADES = ['g_fino', 'g_material', 'oz_troy', 'dwt'] as const;
export type PrecioUnidad = (typeof PRECIO_UNIDADES)[number];

export const ETIQUETAS_ESTADO: Record<PublicacionEstado, string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  retirada: 'Retirada',
};

export const ETIQUETAS_TIPO: Record<PublicacionTipo, string> = {
  produccion: 'Producción estimada',
  compra: 'Precio al que compra',
  venta: 'Precio al que vende',
  mixta: 'Producción y precios',
};

export const ETIQUETAS_PARTICIPANTE: Record<ParticipanteTipo, string> = {
  productor: 'Productor',
  comprador: 'Comprador',
  planta: 'Planta de beneficio',
  otro: 'Otro participante',
};

export const ETIQUETAS_PRODUCCION_UNIDAD: Record<ProduccionUnidad, string> = {
  g: 'gramos',
  kg: 'kilogramos',
  oz_troy: 'onzas troy',
  dwt: 'peniques (dwt)',
};

export const ETIQUETAS_PRECIO_UNIDAD: Record<PrecioUnidad, string> = {
  g_fino: 'por gramo de oro fino',
  g_material: 'por gramo de material',
  oz_troy: 'por onza troy',
  dwt: 'por penique (dwt)',
};

/** Longitud admitida del nombre público del participante (CHECK de la 044). */
export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 120;

/**
 * Tope de altas por autor en 24 horas (trigger de la 044). El INSERT siempre
 * queda en borrador; este número cuenta borradores, publicadas y retiradas.
 */
export const LIMITE_PUBLICACIONES_POR_24H = 10;

/** Datos que un participante escribe en su publicación. */
export interface PublicacionInput {
  participante_nombre: string;
  participante_tipo: ParticipanteTipo;
  tipo: PublicacionTipo;
  produccion_estimada?: number | null;
  produccion_unidad?: ProduccionUnidad | null;
  precio_compra?: number | null;
  precio_venta?: number | null;
  moneda?: Moneda;
  precio_unidad?: PrecioUnidad | null;
  ley_kilates?: number | null;
  notas?: string | null;
  /** YYYY-MM-DD */
  vigente_desde: string;
  /** YYYY-MM-DD */
  vigente_hasta: string;
}

/** Fila pública (vista publicaciones_marketplace_publicas). */
export interface PublicacionPublica {
  id: string;
  participante_nombre: string;
  participante_tipo: ParticipanteTipo;
  tipo: PublicacionTipo;
  produccion_estimada: number | null;
  produccion_unidad: ProduccionUnidad | null;
  precio_compra: number | null;
  precio_venta: number | null;
  moneda: Moneda;
  precio_unidad: PrecioUnidad | null;
  ley_kilates: number | null;
  vigente_desde: string;
  vigente_hasta: string;
  publicada_en: string | null;
  updated_at: string;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function esFecha(v: unknown): v is string {
  return typeof v === 'string' && FECHA_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/**
 * Valida una publicación con las mismas reglas que los CHECK de la 044.
 * Devuelve la lista de errores (vacía si es válida). Nunca "corrige" valores.
 */
export function validarPublicacion(p: PublicacionInput): string[] {
  const errores: string[] = [];
  const nombre = (p.participante_nombre ?? '').trim();
  if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) {
    errores.push(`participante_nombre debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres`);
  }
  if (!PARTICIPANTE_TIPOS.includes(p.participante_tipo)) errores.push('participante_tipo inválido');
  if (!PUBLICACION_TIPOS.includes(p.tipo)) errores.push('tipo inválido');
  if (p.moneda != null && !MONEDAS.includes(p.moneda)) errores.push('moneda inválida');

  const prod = p.produccion_estimada ?? null;
  const compra = p.precio_compra ?? null;
  const venta = p.precio_venta ?? null;

  if (prod != null && (!esNumero(prod) || prod < 0)) errores.push('produccion_estimada debe ser un número ≥ 0');
  if (compra != null && (!esNumero(compra) || compra <= 0)) errores.push('precio_compra debe ser un número > 0');
  if (venta != null && (!esNumero(venta) || venta <= 0)) errores.push('precio_venta debe ser un número > 0');
  if (prod == null && compra == null && venta == null) {
    errores.push('la publicación debe traer al menos un dato: producción estimada, precio de compra o precio de venta');
  }
  if (prod != null && !p.produccion_unidad) errores.push('produccion_unidad es obligatoria con producción estimada');
  if (p.produccion_unidad != null && !PRODUCCION_UNIDADES.includes(p.produccion_unidad)) errores.push('produccion_unidad inválida');
  if ((compra != null || venta != null) && !p.precio_unidad) errores.push('precio_unidad es obligatoria con un precio');
  if (p.precio_unidad != null && !PRECIO_UNIDADES.includes(p.precio_unidad)) errores.push('precio_unidad inválida');
  if (p.ley_kilates != null && (!esNumero(p.ley_kilates) || p.ley_kilates <= 0 || p.ley_kilates > 24)) {
    errores.push('ley_kilates debe estar entre 0 y 24');
  }
  if (!esFecha(p.vigente_desde)) errores.push('vigente_desde debe tener formato YYYY-MM-DD');
  if (!esFecha(p.vigente_hasta)) errores.push('vigente_hasta debe tener formato YYYY-MM-DD');
  if (esFecha(p.vigente_desde) && esFecha(p.vigente_hasta) && p.vigente_hasta < p.vigente_desde) {
    errores.push('vigente_hasta no puede ser anterior a vigente_desde');
  }
  // Coherencia tipo ↔ datos (regla de aplicación; la 044 la deja al cliente).
  if (p.tipo === 'produccion' && prod == null) errores.push('una publicación de producción exige produccion_estimada');
  if (p.tipo === 'compra' && compra == null) errores.push('una publicación de compra exige precio_compra');
  if (p.tipo === 'venta' && venta == null) errores.push('una publicación de venta exige precio_venta');
  return errores;
}

/** `true` si la publicación está publicada y vigente en la fecha `hoy` (YYYY-MM-DD). */
export function esVigente(
  p: { estado: PublicacionEstado; vigente_desde: string; vigente_hasta: string },
  hoy: string,
): boolean {
  return p.estado === 'publicada' && p.vigente_desde <= hoy && hoy <= p.vigente_hasta;
}

/**
 * Transiciones de estado (trigger de la 044).
 * El autor puede retirar. Pasar de borrador a publicada no es una transición
 * suya: solo `publicar_publicacion_marketplace()`, con `{ porModerador: true }`.
 */
export function transicionPermitida(
  de: PublicacionEstado,
  a: PublicacionEstado,
  opts?: { porModerador?: boolean },
): boolean {
  if (de === a) return true;
  if (de === 'borrador' && a === 'publicada') return opts?.porModerador === true;
  if (de === 'borrador') return a === 'retirada';
  if (de === 'publicada') return a === 'retirada';
  return false;
}

/**
 * Quién puede escribir una publicación: su autor, y nunca el personal de CHT
 * (replica las policies publicaciones_autor_*). Lectura pública: solo vigentes.
 */
export function puedeEscribir(args: { autorUserId: string; userId: string | null; esStaffCht: boolean }): boolean {
  if (!args.userId || args.esStaffCht) return false;
  return args.autorUserId === args.userId;
}
