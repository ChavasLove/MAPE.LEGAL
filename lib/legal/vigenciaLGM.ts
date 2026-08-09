/**
 * Capa de vigencia de la Ley General de Minería (Decreto 238-2012) tras la
 * sentencia de la Sala de lo Constitucional de la CSJ, expediente
 * SCO-0090-2014 (18 de marzo de 2026), publicada en La Gaceta No. 37,158
 * del 3 de junio de 2026.
 *
 * Fuente única de las constantes de vigencia: toda superficie que cite
 * artículos de la Ley debe contrastar contra LGM_ARTICULOS_ANULADOS antes
 * de fundamentar algo en ellos. Resumen neutral de la sentencia en
 * docs/legal/sentencia-sco-0090-2014.md.
 *
 * Este archivo está excluido de las reglas de vigencia de
 * scripts/check-copy-compliance.mjs porque necesita nombrar los artículos
 * anulados sin anotación inline.
 */

export const SENTENCIA_LGM = {
  expediente: 'SCO-0090-2014',
  fechaSentencia: '2026-03-18',
  gaceta: 'No. 37,158 (2026-06-03)',
  efectos: 'ex nunc, erga omnes, no retroactivos (Art. 316 CN)',
} as const

/** Artículos de la Ley declarados inconstitucionales (anulados). */
export const LGM_ARTICULOS_ANULADOS = [22, 39, 43, 47, 48, 67, 68] as const

/**
 * Artículos declarados constitucionales, varios con condiciones
 * interpretativas. El 53 solo en sus incisos b, f, h, i, j, k. El 86
 * (definición de pequeña minería) fue validado expresamente.
 */
export const LGM_ARTICULOS_VALIDADOS = [
  36, 49, 53, 55, 56, 60, 61, 66, 70, 76, 77, 86, 111,
] as const

/**
 * Texto canónico sobre consulta previa (regla R3 del prompt de María).
 * No parafrasear: se usa textual en toda superficie que toque el tema.
 */
export const NOTA_CONSULTA_PREVIA =
  'El mecanismo de consulta de los Arts. 67 y 68 de la Ley fue anulado. ' +
  'Subsiste el derecho a la consulta previa, libre e informada de pueblos ' +
  'indígenas y tribales por bloque de constitucionalidad (Convenio 169 OIT; ' +
  'sentencia RI-089-16 de 2018). El Congreso Nacional fue exhortado a ' +
  'legislar un nuevo mecanismo.'
