/**
 * Fuente única de copy con consecuencia jurídica — Fase 2C.
 *
 * Regla arquitectónica: ningún componente escribe texto legal en línea.
 * Todo texto con consecuencia jurídica del sitio público se importa desde
 * este módulo, para que la revisión legal externa se haga sobre un solo
 * archivo.
 *
 * Las formulaciones marcadas como OBLIGATORIAS son encuadres aprobados y
 * deben usarse textualmente. No parafrasear sin revisión legal.
 */

/* ── Identidad ──────────────────────────────────────────────────────── */

export const RAZON_SOCIAL = 'Corporación Hondureña Tenka, S.A.'

export const AVISO_PLATAFORMA =
  `MAPE.LEGAL es una plataforma operada por ${RAZON_SOCIAL}.`

export const DOMICILIO_LINES = [
  'Local Nexcrea — Condominios Metrópolis',
  'Torre 1, Nivel 18',
  'Boulevard Suyapa, Tegucigalpa',
  'Francisco Morazán, Honduras',
] as const

export const CONTACTO = {
  whatsapp: '+504 9737 3139',
  whatsappHref: 'https://wa.me/50497373139',
  email: 'gerencia@mape.legal',
  emailHref: 'mailto:gerencia@mape.legal',
} as const

/* ── Formulaciones obligatorias (§1.2 del encargo) ──────────────────── */

/** OBLIGATORIA — nota permanente del Certificado de Origen. */
export const CERTIFICADO_ORIGEN_NOTA =
  'El Certificado de Origen lo emite el titular del derecho minero y es ' +
  'autenticado y avalado por la Autoridad Minera o Municipal (Art. 35, ' +
  'Reglamento Especial MAPE). MAPE.LEGAL es el motor de evidencia y ' +
  'trazabilidad que respalda su emisión; no es autoridad emisora.'

/** Versión abreviada para el pie de página; enlaza a /aviso-legal. */
export const CERTIFICADO_ORIGEN_NOTA_BREVE =
  'El Certificado de Origen lo emite el titular del derecho minero y lo ' +
  'autentica y avala la Autoridad Minera o Municipal (Art. 35, Regl. ' +
  'Especial MAPE). MAPE.LEGAL no es autoridad emisora.'

/**
 * RETIRADA de todas las superficies públicas (2026-07-29, recomendación del
 * abogado): la formulación afirma en presente la inscripción ante INHGEOMIN y
 * la declaración trimestral, hechos aún no verificados. No renderizar hasta
 * contar con verificación factual y aprobación legal expresa.
 */
export const REGISTRO_COMERCIALIZADOR =
  `${RAZON_SOCIAL} opera con Registro de Comercializador ante INHGEOMIN ` +
  'y presenta declaración trimestral de volúmenes (Art. 37, Ley General ' +
  'de Minería).'

/** OBLIGATORIA — condición de compra de oro. */
export const CONDICION_COMPRA =
  'CHT compra únicamente a titulares de derecho minero vigente, con ' +
  'Certificado de Origen válido por transacción.'

/** OBLIGATORIA — política de precio publicada. */
export const POLITICA_PRECIO =
  'Un solo precio publicado: 80% de la referencia LBMA, convertido al ' +
  'tipo de cambio oficial del BCH, actualizado diariamente. Sin ' +
  'comisiones adicionales sobre la misma onza.'

/**
 * OBLIGATORIA — encuadre de acceso a mercados. La exigencia proviene del
 * mercado comprador; no es una restricción impuesta al minero.
 */
export const MERCADOS_ACCESO =
  'Acceso a mercados que exigen certificación de origen.'

/** OBLIGATORIA — libertad de comercialización del operador. */
export const LIBERTAD_VENTA =
  'La comercialización de productos minerales es libre (Art. 37, Ley ' +
  'General de Minería). Vender a CHT no crea obligación de venta futura: ' +
  'el titular del derecho minero conserva plena libertad de vender su ' +
  'producción a cualquier comprador.'

/* ── Citas legales usadas en el sitio ───────────────────────────────── */

export interface CitaLegal {
  norma: string
  articulo: string
  sintesis: string
}

export const CITAS_LEGALES = {
  leyArt37: {
    norma: 'Ley General de Minería',
    articulo: 'Art. 37',
    sintesis:
      'La comercialización de productos minerales es libre. Quien se ' +
      'dedique a la compraventa debe inscribirse en el Registro de ' +
      'Comercializadores ante la Autoridad Minera y declarar sus ' +
      'volúmenes trimestralmente.',
  },
  leyArt38: {
    norma: 'Ley General de Minería',
    articulo: 'Art. 38',
    sintesis:
      'El comprador de productos minerales responde solidariamente y ' +
      'está obligado a verificar el origen lícito de lo que adquiere.',
  },
  leyArt45: {
    norma: 'Ley General de Minería',
    articulo: 'Art. 45',
    sintesis:
      'Los permisos de pequeña minería se otorgan sobre áreas de hasta ' +
      '10 hectáreas.',
  },
  leyArt75: {
    norma: 'Ley General de Minería',
    articulo: 'Art. 75',
    sintesis:
      'Enumera las inhabilidades para ser titular de derechos mineros; ' +
      'la solicitud exige declaración jurada de no estar comprendido en ' +
      'ellas.',
  },
  leyArt86_87: {
    norma: 'Ley General de Minería',
    articulo: 'Arts. 86–87',
    sintesis:
      'Definen la pequeña minería por el uso de medios mecánicos ' +
      'sencillos de extracción y beneficio, y su régimen de permiso ante ' +
      'la Autoridad Minera.',
  },
  leyArt89: {
    norma: 'Ley General de Minería',
    articulo: 'Art. 89',
    sintesis:
      'Define la minería artesanal como la que emplea técnicas ' +
      'exclusivamente manuales, sujeta a permiso municipal dentro de ' +
      'áreas delimitadas.',
  },
  regArt4: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 4',
    sintesis:
      'Caracteriza la pequeña minería: extracción y beneficio con medios ' +
      'mecánicos sencillos, distinta de la minería artesanal manual.',
  },
  regArt5: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 5',
    sintesis:
      'Permite hasta 10 permisos de pequeña minería por persona natural, ' +
      'jurídica o grupo organizado, con un máximo de 10 hectáreas cada ' +
      'uno.',
  },
  regArt6: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 6',
    sintesis:
      'Enumera los requisitos del expediente de solicitud del permiso de ' +
      'pequeña minería.',
  },
  regArt31: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 31',
    sintesis:
      'Regula la modificación de un derecho minero existente, aplicable ' +
      'cuando hay una concesión inactiva sobre el área solicitada.',
  },
  regArt32: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 32',
    sintesis:
      'Permite la coexistencia de la pequeña minería con una concesión ' +
      'vigente, mediante acuerdo con el concesionario notificado a la ' +
      'Autoridad Minera y Municipal.',
  },
  regArt33: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 33',
    sintesis:
      'En coexistencia, el concesionario asume las actividades dentro de ' +
      'sus obligaciones y amplía su licencia ambiental para cubrirlas.',
  },
  regArt34: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 34',
    sintesis:
      'La comercialización de producción MAPE exige derecho minero ' +
      'vigente; los actos de comercio sin derecho minero están ' +
      'penalizados.',
  },
  regArt35: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 35',
    sintesis:
      'El Certificado de Origen lo emite el titular del derecho minero y ' +
      'lo autentica y avala la Autoridad Minera o Municipal.',
  },
  regArt37: {
    norma: 'Reglamento Especial MAPE',
    articulo: 'Art. 37',
    sintesis:
      'Establece el Programa Integral de Asistencia Técnica y ' +
      'capacitación para la minería artesanal y de pequeña escala.',
  },
} as const satisfies Record<string, CitaLegal>

export type CitaLegalKey = keyof typeof CITAS_LEGALES

/* ── Aviso legal del sitio (/aviso-legal) ───────────────────────────── */

export const AVISO_NATURALEZA_INFORMATIVA =
  'El contenido de este sitio tiene carácter informativo general sobre ' +
  'el marco normativo minero de Honduras. No constituye asesoría legal ' +
  'para un caso concreto, y la sola visita o consulta de este sitio no ' +
  'crea una relación profesional de servicios legales con ' + RAZON_SOCIAL +
  ' ni una relación abogado–cliente con los profesionales que colaboran ' +
  'con ella.'

export const AVISO_RESOLUCIONES =
  'La resolución de toda solicitud de derecho minero es potestad de la ' +
  'Autoridad Minera. CHT gestiona expedientes y acompaña el trámite; no ' +
  'otorga permisos ni puede asegurar el resultado de una resolución.'
