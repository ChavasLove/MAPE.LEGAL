// lib/precio/factores.ts
// ---------------------------------------------------------------------------
// Factores de precio del modelo B (10-nov-2026) — FUENTE ÚNICA.
//
// Modelo B: Inversiones Zekaii, S. de R.L. es la dueña de la plataforma
// MAPE.LEGAL y la compradora del oro a los productores. El precio que publica
// la plataforma es el precio de compra de Zekaii a los productores.
//
// Regla dura del brief: el factor de compra al productor NO ha sido definido
// por Willis. Hasta que lo defina por escrito, es un MARCADOR PENDIENTE —
// ninguna superficie (web, María, boletín, API) puede calcular ni mostrar un
// precio en lempiras usando 0.75, 0.80 u otra cifra "como si ya fuera" el
// factor de compra. Cuando Willis lo defina, basta con sustituir `null` por
// el número y versionar la Política de Precios (cláusula 4).
//
// El 80 % de la referencia internacional es ÚNICAMENTE el precio de venta de
// Zekaii a la refinería de destino (uso interno). No es el precio al minero,
// María no lo cotiza y ninguna superficie pública lo publica como precio de
// compra. El margen restante no se declara.
// ---------------------------------------------------------------------------

/**
 * Factor de compra de Zekaii al productor, como fracción de la referencia
 * internacional del oro. `null` = PENDIENTE DE DEFINICIÓN POR WILLIS.
 *
 * No reemplazar por una cifra sin instrucción escrita de Willis.
 */
export const FACTOR_COMPRA_ZEKAII: number | null = null;

/** Texto que las superficies muestran mientras el factor está pendiente. */
export const FACTOR_COMPRA_ZEKAII_PENDIENTE = '[POR DEFINIR POR WILLIS]';

/** `true` cuando Willis ya definió el factor y es un número válido en (0, 1]. */
export function factorCompraDefinido(
  factor: number | null = FACTOR_COMPRA_ZEKAII,
): factor is number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0 && factor <= 1;
}

/**
 * Factor de VENTA de Zekaii a la refinería de destino (fracción de la
 * referencia internacional). INTERNO: no es precio de compra al minero, no lo
 * cotiza María y no se publica en superficies públicas.
 */
export const FACTOR_VENTA_REFINERIA_LBMA = 0.8;
