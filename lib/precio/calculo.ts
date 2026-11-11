// Módulo de cálculo del Precio Referencial MAPE.LEGAL.
// Constantes y funciones puras, sin dependencias de red ni de base de datos.
// Importable desde server components, route handlers y client components
// (el panel de fijación lo usa para la previsualización).
//
// Modelo público (hotfix de neutralidad, 11-nov-2026): Corporación Hondureña
// Tenka, S.A. (CHT) es titular, desarrolladora y operadora de MAPE.LEGAL y no
// interviene en la transacción del mineral. El precio publicado es un PRECIO
// REFERENCIAL ESTIMADO (75 % de la referencia internacional del oro, en lempiras
// por gramo de oro fino) — informativo, no es una oferta ni una garantía de pago. El
// factor vive en lib/precio/factores.ts (fuente única).

import { FACTOR_REFERENCIA } from "./factores";

// Onza troy en gramos. Constante física, no configurable.
export const GRAMOS_POR_ONZA_TROY = 31.1035;

// Versión en preparación de la Política de Precios. Es BORRADOR hasta que se
// confirme la fecha de vigencia; la reescritura de /politica-de-precios la
// publica con el modelo de precio referencial.
export const VERSION_POLITICA_PRECIOS = "1.2-BORRADOR";

// Fecha de entrada en vigencia de la versión actual de la Política de
// Precios (YYYY-MM-DD). Se publica en /politica-de-precios §9.
// PENDIENTE: la v1.2 no tiene fecha confirmada. El valor es un marcador de
// texto, NO una fecha parseable — los consumidores deben consultar
// FECHA_VIGENCIA_POLITICA_PENDIENTE antes de formatearla como fecha.
export const FECHA_VIGENCIA_POLITICA = "[CONFIRMAR]";

/** `true` mientras la fecha de vigencia de la versión actual no esté confirmada. */
export const FECHA_VIGENCIA_POLITICA_PENDIENTE = true;

// ─── Histórico de la versión anterior (v1.1) ────────────────────────────────
// La cláusula 4 de la política exige que la versión anterior siga visible al
// publicar una revisión. Estas constantes alimentan el registro de versiones
// de /politica-de-precios §9. No alterar: son hechos históricos.
export const VERSION_POLITICA_ANTERIOR = "1.1";
export const FECHA_VIGENCIA_POLITICA_ANTERIOR = "2026-07-29";
export const FACTOR_POLITICA_ANTERIOR = 0.8;

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

// Factor vigente del PRECIO REFERENCIAL público (75 % de la referencia
// internacional del oro). DERIVA de FACTOR_REFERENCIA (lib/precio/factores.ts,
// fuente única). No es un factor de transacción: la plataforma no interviene
// en la transacción del mineral. Su revisión se rige por la cláusula 4 de la política (nueva versión
// publicada con al menos 15 días calendario de anticipación). El valor
// histórico de la v1.1 vive en FACTOR_POLITICA_ANTERIOR.
export const FACTOR_COMERCIALIZACION_VIGENTE: number = FACTOR_REFERENCIA;

/**
 * Precio referencial en lempiras por gramo de ORO FINO.
 * = (referencia internacional USD/oz ÷ 31.1035) × factor × tipo de cambio.
 * No aplica sobre peso bruto del material.
 */
export function calcularPrecioLempirasGramoFino(
  referenciaUsdPorOnza: number,
  tipoCambio: number,
  factorReferencial: number
): number {
  const usdPorGramoFino = referenciaUsdPorOnza / GRAMOS_POR_ONZA_TROY;
  return usdPorGramoFino * factorReferencial * tipoCambio;
}

/**
 * Redondeo de almacenamiento: 4 decimales (numeric(12,4) en la tabla).
 * La presentación pública redondea a 2 decimales.
 */
export function redondearAlmacenamiento(valor: number): number {
  return Math.round(valor * 10_000) / 10_000;
}
