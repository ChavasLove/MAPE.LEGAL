// Módulo de cálculo del Precio de Referencia MAPE.LEGAL.
// Constantes y funciones puras, sin dependencias de red ni de base de datos.
// Importable desde server components, route handlers y client components
// (el panel de fijación lo usa para la previsualización).

// Onza troy en gramos. Constante física, no configurable.
export const GRAMOS_POR_ONZA_TROY = 31.1035;

// TODO(CHT): definir método de ensaye antes de publicación.
export const METODO_ENSAYE = "PENDIENTE DE DEFINICIÓN";

export const VERSION_POLITICA_PRECIOS = "1.0";

// Factor de comercialización vigente conforme a la Política de Precios
// v1.0 (0.80 = 80%). Precarga del panel de fijación diaria y dato publicado
// en /politica-de-precios. Su revisión se rige por la cláusula 4 de la
// política: toda revisión es una nueva versión publicada con al menos 15
// días calendario de anticipación.
export const FACTOR_COMERCIALIZACION_VIGENTE = 0.8;

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
