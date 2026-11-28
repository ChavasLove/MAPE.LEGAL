// Módulo de cálculo del precio informativo del oro de MAPE.LEGAL.
// Constantes y funciones puras, sin dependencias de red ni de base de datos.
// Importable desde server components, route handlers y client components
// (el panel de fijación lo usa para la previsualización).
//
// Modelo público vigente (DEC-2026-11-26-1 y DEC-2026-11-27-2): el precio que
// publica la plataforma es el precio internacional del oro convertido a
// lempiras por gramo de ORO FINO con el tipo de cambio de COMPRA del Banco
// Central de Honduras (BCH), SIN factor de compra:
//
//   L/g fino = (USD/oz) × (tipo de compra del BCH, L por USD) ÷ 31.1034768
//
// Es solo informativo: MAPE.LEGAL no compra, no vende, no intermedia oro ni
// administra fondos. El modelo anterior ("precio referencial" al 75 % de la
// referencia internacional, hotfix 11-nov-2026) y el de la v1.1 (factor de
// compra de un comprador) quedaron SUPERADOS y no se publican.

// Onza troy en gramos. Constante física, canónica para TODA la plataforma
// (misma que TROY_OUNCE_GRAMS en services/pricingService.ts). El 31.1035 que
// usaba este módulo hasta nov-2026 dejó de emplearse en cualquier cálculo.
export const GRAMOS_POR_ONZA_TROY = 31.1034768;

// Versión en preparación de la Política de publicación del precio. Es
// BORRADOR hasta que Willis confirme la fecha de vigencia y el número de
// versión [POR CONFIRMAR]. Sustituye al borrador 1.2 (precio referencial al
// 75 %), que nunca entró en vigencia.
export const VERSION_POLITICA_PRECIOS = "2.0-BORRADOR";

// Fecha de entrada en vigencia de la versión actual de la Política de
// publicación (YYYY-MM-DD). Se publica en /politica-de-precios.
// PENDIENTE: sin fecha confirmada. El valor es un marcador de texto, NO una
// fecha parseable — los consumidores deben consultar
// FECHA_VIGENCIA_POLITICA_PENDIENTE antes de formatearla como fecha.
export const FECHA_VIGENCIA_POLITICA = "[CONFIRMAR]";

/** `true` mientras la fecha de vigencia de la versión actual no esté confirmada. */
export const FECHA_VIGENCIA_POLITICA_PENDIENTE = true;

// ─── Histórico de versiones anteriores ───────────────────────────────────────
// La cláusula de revisión exige que las versiones anteriores sigan visibles al
// publicar una revisión. Estas constantes alimentan el registro de versiones
// de /politica-de-precios. Son hechos históricos: no alterar. Los factores
// numéricos de esos modelos NO se publican (DEC-2026-11-26-1).
export const VERSION_POLITICA_ANTERIOR = "1.1";
export const FECHA_VIGENCIA_POLITICA_ANTERIOR = "2026-07-29";
/** Borrador intermedio (11-nov-2026) que no entró en vigencia. */
export const VERSION_POLITICA_BORRADOR_SUPERADO = "1.2-BORRADOR";

/**
 * Método de liquidación: determina la ley del oro en una transacción del día
 * (entre las partes, ajena a la plataforma). No destructivo,
 * resultado en minutos.
 */
export const METODO_LIQUIDACION =
  "Fluorescencia de rayos X (XRF) sobre superficie preparada";

/**
 * Método de contraste: dirime discrepancias y calibra el método de
 * liquidación.
 */
export const METODO_CONTRASTE =
  "Ensayo al fuego (fusión y copelación) con lectura del régulo por XRF";

/**
 * Laboratorio tercero dirimente. Marcador deliberado: NO inventar un nombre.
 * Se designa y se publica con la nueva versión de la política.
 */
export const LABORATORIO_DIRIMENTE =
  "[PENDIENTE — designar laboratorio tercero dirimente]";

/** Tope de ajuste entre liquidación provisional y final, en puntos porcentuales de ley. */
export const TOPE_AJUSTE_LIQUIDACION_PP = 2.0;

/** Plazo de conservación de la muestra testigo, en días calendario. */
export const DIAS_CONSERVACION_TESTIGO = 90;

/**
 * Factor que la columna histórica `precios_referencia.factor_comercializacion`
 * (migración 030, NOT NULL) recibe en toda fijación nueva: 1 = SIN factor de
 * compra. La columna no se renderiza ni se usa en ningún cálculo público; la
 * migración no se altera (no exige aplicar nada en producción).
 */
export const FACTOR_SIN_RECORTE = 1;

/** `true` si el insumo es un número finito y positivo. */
export function insumoValido(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Precio informativo en lempiras por gramo de ORO FINO, SIN factor de compra.
 * = (USD/oz ÷ 31.1034768) × tipo de cambio de compra del BCH.
 * Devuelve null si un insumo es null, 0, negativo o no finito — nunca una
 * cifra inventada. No aplica sobre peso bruto del material.
 */
export function calcularPrecioLempirasGramoFino(
  referenciaUsdPorOnza: number | null | undefined,
  tipoCambioCompraBch: number | null | undefined,
): number | null {
  if (!insumoValido(referenciaUsdPorOnza) || !insumoValido(tipoCambioCompraBch)) return null;
  return (referenciaUsdPorOnza * tipoCambioCompraBch) / GRAMOS_POR_ONZA_TROY;
}

/**
 * Redondeo de almacenamiento: 4 decimales (numeric(12,4) en la tabla).
 * La presentación pública redondea a 2 decimales.
 */
export function redondearAlmacenamiento(valor: number): number {
  return Math.round(valor * 10_000) / 10_000;
}

/** Redondeo de presentación (UI, María, boletín): 2 decimales por defecto. */
export function redondearPresentacion(valor: number, decimales = 2): number {
  const f = 10 ** decimales;
  // EPSILON evita que 1.005 × 100 = 100.4999… redondee hacia abajo.
  return Math.round((valor + Number.EPSILON) * f) / f;
}
