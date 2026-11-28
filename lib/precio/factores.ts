// lib/precio/factores.ts
// ---------------------------------------------------------------------------
// Predicado de un factor numérico.
//
// Modelo público vigente (DEC-2026-11-26-1 y DEC-2026-11-27-2): el precio que
// publica MAPE.LEGAL es el precio internacional del oro convertido a lempiras
// por gramo de oro fino con el tipo de cambio de COMPRA del BCH, sin factor
// de compra. No hay en este módulo una cifra de venta a la refinería de
// destino: nada fuera de lib/precio la importaba y se retiró.
// ---------------------------------------------------------------------------

/** `true` cuando `factor` es un número válido en (0, 1]. */
export function factorDefinido(factor: number | null | undefined): factor is number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0 && factor <= 1;
}
