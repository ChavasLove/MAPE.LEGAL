// lib/precio/factores.ts
// ---------------------------------------------------------------------------
// Factores de precio — FUENTE ÚNICA.
//
// Modelo público vigente (DEC-2026-11-26-1 y DEC-2026-11-27-2): el precio que
// publica MAPE.LEGAL es el precio internacional del oro convertido a lempiras
// por gramo de oro fino con el tipo de cambio de COMPRA del BCH, SIN NINGÚN
// factor de compra. Por eso aquí ya NO existe un factor público: el antiguo
// FACTOR_REFERENCIA (0,75, hotfix 11-nov-2026) y su rótulo "Precio referencial
// (75%)" quedaron SUPERADOS y se retiraron de todas las superficies públicas,
// APIs públicas y prompts de María. Cualquier porcentaje de la referencia
// internacional está prohibido en lo público.
//
// Lo único que permanece es el factor de venta a la refinería de destino,
// que es INTERNO: no se publica, María no lo cita y ninguna API pública lo
// expone. Ninguna superficie pública nombra compradores ni usa "compra".
// ---------------------------------------------------------------------------

/**
 * Factor de VENTA a la refinería de destino (fracción de la referencia
 * internacional). INTERNO: no se publica, no lo cita María y no sale por
 * ninguna API pública.
 */
export const FACTOR_VENTA_REFINERIA_LBMA = 0.8;

/** `true` cuando `factor` es un número válido en (0, 1]. */
export function factorDefinido(factor: number | null | undefined): factor is number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0 && factor <= 1;
}
