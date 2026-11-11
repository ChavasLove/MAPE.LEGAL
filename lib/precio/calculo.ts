// Módulo de cálculo del Precio de Referencia MAPE.LEGAL.
// Constantes y funciones puras, sin dependencias de red ni de base de datos.
// Importable desde server components, route handlers y client components
// (el panel de fijación lo usa para la previsualización).

import { FACTOR_COMPRA_ZEKAII } from "./factores";

// Onza troy en gramos. Constante física, no configurable.
export const GRAMOS_POR_ONZA_TROY = 31.1035;

// Versión en preparación de la Política de Precios (modelo B, 10-nov-2026:
// Inversiones Zekaii, S. de R.L. como compradora). Es BORRADOR hasta que
// Willis defina el factor de compra y confirme la fecha de vigencia.
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
 * Método de liquidación: determina el precio pagado en la transacción del día.
 * No destructivo, resultado en minutos, compatible con depósito el mismo día.
 */
export const METODO_LIQUIDACION =
  "Fluorescencia de rayos X (XRF) sobre superficie preparada";

/**
 * Método de contraste: dirime discrepancias, calibra el método de liquidación
 * y reconcilia con la refinería de destino.
 */
export const METODO_CONTRASTE =
  "Ensayo al fuego (fusión y copelación) con lectura del régulo por XRF";

/**
 * Laboratorio tercero dirimente. Debe nombrarse antes de publicar en
 * producción. Marcador deliberado: NO inventar un nombre — lo designa
 * Inversiones Zekaii, S. de R.L. (modelo B) y se publica con la nueva versión.
 */
export const LABORATORIO_DIRIMENTE =
  "[PENDIENTE — designar el laboratorio a nombre de Inversiones Zekaii, S. de R.L.]";

/** Tope de ajuste entre liquidación provisional y final, en puntos porcentuales de ley. */
export const TOPE_AJUSTE_LIQUIDACION_PP = 2.0;

/** Plazo de conservación de la muestra testigo, en días calendario. */
export const DIAS_CONSERVACION_TESTIGO = 90;

// Factor de comercialización vigente = factor de compra de Inversiones Zekaii,
// S. de R.L. al productor. DERIVA de FACTOR_COMPRA_ZEKAII (lib/precio/factores.ts,
// fuente única del modelo B): `null` = PENDIENTE DE DEFINICIÓN POR WILLIS. Con
// null, el panel de fijación (/dashboard/precio) no permite calcular ni fijar y
// POST /api/precio responde 409 `factor_compra_pendiente`. No asignar aquí una
// cifra: se define en factores.ts y su revisión se rige por la cláusula 4 de la
// política (nueva versión publicada con al menos 15 días calendario de
// anticipación). El valor histórico de la v1.1 vive en FACTOR_POLITICA_ANTERIOR.
export const FACTOR_COMERCIALIZACION_VIGENTE: number | null = FACTOR_COMPRA_ZEKAII;

/**
 * Precio de referencia en lempiras por gramo de ORO FINO.
 * No aplica sobre peso bruto del material.
 */
export function calcularPrecioLempirasGramoFino(
  lbmaUsdPorOnza: number,
  tipoCambioBch: number,
  factorComercializacion: number
): number {
  const usdPorGramoFino = lbmaUsdPorOnza / GRAMOS_POR_ONZA_TROY;
  return usdPorGramoFino * factorComercializacion * tipoCambioBch;
}

/**
 * Redondeo de almacenamiento: 4 decimales (numeric(12,4) en la tabla).
 * La presentación pública redondea a 2 decimales.
 */
export function redondearAlmacenamiento(valor: number): number {
  return Math.round(valor * 10_000) / 10_000;
}
