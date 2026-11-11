// lib/precio/factores.ts
// ---------------------------------------------------------------------------
// Factores de precio — FUENTE ÚNICA (hotfix de neutralidad, 11-nov-2026).
//
// Modelo público vigente: Corporación Hondureña Tenka, S.A. (CHT) es titular,
// desarrolladora y operadora de MAPE.LEGAL y NO compra ni vende mineral. La
// plataforma publica un PRECIO REFERENCIAL ESTIMADO al 75 % de la referencia
// internacional del oro, en lempiras por gramo de oro fino, siempre con el
// aviso literal AVISO_PRECIO_REFERENCIAL (lib/content/copy-legal.ts). No es
// una oferta de compra, ni un precio oficial, ni una garantía de pago. Ninguna
// superficie pública nombra compradores ni usa la palabra "compra".
//
// El factor de venta a la refinería de destino (80 %) y cualquier margen son
// INTERNOS: no se publican, María no los cita y ninguna API pública los expone.
// ---------------------------------------------------------------------------

/**
 * Factor del precio referencial público, como fracción de la referencia
 * internacional del oro. Rótulo público: "Precio referencial (75%)".
 */
export const FACTOR_REFERENCIA = 0.75;

/** Porcentaje del factor referencial, para rótulos ("75"). */
export const FACTOR_REFERENCIA_PCT = Math.round(FACTOR_REFERENCIA * 100);

/** Rótulo público canónico del precio. Nunca "Compra" ni "precio de compra". */
export const ROTULO_PRECIO_REFERENCIAL = `Precio referencial (${FACTOR_REFERENCIA_PCT}%)`;

/** `true` cuando el factor es un número válido en (0, 1]. */
export function factorReferenciaDefinido(
  factor: number | null | undefined = FACTOR_REFERENCIA,
): factor is number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0 && factor <= 1;
}

/**
 * Factor de VENTA a la refinería de destino (fracción de la referencia
 * internacional). INTERNO: no se publica, no lo cita María y no sale por
 * ninguna API pública.
 */
export const FACTOR_VENTA_REFINERIA_LBMA = 0.8;
