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

/* ── Identidad (hotfix de neutralidad, 11-nov-2026) ─────────────────── */
/*
 * Una sola persona jurídica en las superficies públicas:
 *
 *  - Corporación Hondureña Tenka, S.A. (CHT) — TITULAR, DESARROLLADORA y
 *    OPERADORA de la plataforma MAPE.LEGAL. Presta servicios legales y mineros
 *    a los productores artesanales (expedientes, titulación, representación).
 *    NO compra ni vende mineral.
 *
 * MAPE.LEGAL es el nombre de la plataforma y del sello voluntario y
 * complementario de trazabilidad; no es una persona jurídica. MAPE.LEGAL no
 * compra, no vende ni intermedia oro. Ninguna superficie pública nombra a un
 * comprador. El precio publicado es REFERENCIAL e informativo (75 % de la
 * referencia internacional del oro), nunca un "precio de compra".
 *
 * Nota no bloqueante sobre la marca: el registro de la marca MAPE.LEGAL ante
 * el Instituto de la Propiedad NO está verificado. No se afirma que exista y
 * no se usan símbolos de marca registrada en ninguna superficie.
 */

/** Titular, desarrolladora y operadora de la plataforma MAPE.LEGAL. */
export const RAZON_SOCIAL = 'Corporación Hondureña Tenka, S.A.'

/** Rol de CHT, reutilizable tras su razón social (pie, JSON-LD, aviso legal). */
export const ROL_TITULAR = 'Titular y operadora de la plataforma MAPE.LEGAL'

/** Síntesis del rol de CHT en una oración, para párrafos descriptivos. */
export const ROL_CHT =
  'es titular, desarrolladora y operadora de la plataforma MAPE.LEGAL y ' +
  'presta servicios legales y mineros a los productores artesanales; no ' +
  'compra ni vende mineral.'

/* ── Precio referencial y tipo de cambio (hotfix neutralidad, 11-nov-2026) ── */

/**
 * AVISO LITERAL — mostrarlo junto a toda vista de precio, calculadora y
 * boletín, y cada vez que María cotice. No parafrasear.
 */
export const AVISO_PRECIO_REFERENCIAL =
  'Precio referencial estimado al 75% del precio internacional de referencia ' +
  'del oro, convertido a lempiras con un tipo de cambio de referencia de ' +
  'mercado (fuente y fecha indicadas). Es solo informativo: no es una oferta ' +
  'de compra, ni un precio oficial, ni una garantía de pago. MAPE.LEGAL no ' +
  'compra, no vende ni intermedia oro. Toda transacción se negocia libremente ' +
  'entre el productor y el comprador.'

/** Fórmula pública del precio referencial (mostrar junto al precio, con fuente y fecha). */
export const FORMULA_PRECIO_REFERENCIAL =
  'Precio referencial (L por gramo de oro fino) = precio internacional del oro ' +
  '× tipo de cambio de referencia de mercado × 0.75'

/**
 * Fuente REAL del tipo de cambio que usa la plataforma. No atribuir al BCH un
 * valor que proviene de este feed; la fuente y la fecha/hora se muestran junto
 * a cada precio y a cada tipo de cambio.
 */
export const FUENTE_TIPO_CAMBIO = 'exchangerate-api.com'

/** Etiqueta pública del tipo de cambio (sin "BCH"). */
export const ETIQUETA_TIPO_CAMBIO = 'Tipo de cambio de referencia de mercado'

/**
 * TEXTO LITERAL — declaración de conflicto de interés (Quiénes somos y
 * /aviso-legal). No nombra compradores. Willis confirma la redacción.
 */
export const CONFLICTO_INTERES_CHT =
  'Los socios de CHT tienen intereses en empresas del sector aurífero, ' +
  'incluida la comercialización de oro. Por eso el precio referencial se ' +
  'calcula con una fórmula pública y fija, y cada productor es libre de vender ' +
  'a quien quiera.'

export const AVISO_PLATAFORMA =
  `MAPE.LEGAL es una plataforma desarrollada y operada por ${RAZON_SOCIAL}, ` +
  'su titular. MAPE.LEGAL no compra, no vende ni intermedia oro.'

/**
 * PIE DE PÁGINA — nota legal del sello (hotfix de neutralidad, 11-nov-2026).
 * Reescrita sin comprador: el pie la renderiza completa y cierra con el © de
 * la titular. Pendiente de revisión legal.
 */
export const PIE_NOTA_LEGAL =
  'El Certificado de Origen o Certificación de Procedencia oficial lo emite ' +
  'el titular del derecho minero y debe ser autenticado por la Autoridad ' +
  'Minera o Municipal, conforme al artículo 35 del Reglamento Especial para ' +
  'la Minería Artesanal y la Pequeña Minería (Acuerdo Ejecutivo 088-B-2018) ' +
  'y al artículo 43, literal e, del Reglamento de la Ley General de Minería ' +
  '(Acuerdo Ejecutivo 042-2013). El sello o registro MAPE.LEGAL es un ' +
  'esquema voluntario y complementario de trazabilidad de la plataforma ' +
  `MAPE.LEGAL, de la que es titular y operadora ${RAZON_SOCIAL} No ` +
  'sustituye el documento oficial, no es un acto de INHGEOMIN ni de ninguna ' +
  'municipalidad, y no existe, a la fecha, un Acuerdo o Instructivo de ' +
  `INHGEOMIN publicado en La Gaceta que lo adopte. ${RAZON_SOCIAL} presta ` +
  'servicios legales y mineros a los productores artesanales y no compra ni ' +
  'vende mineral. MAPE.LEGAL no compra, no vende ni intermedia oro.'

/*
 * Domicilio de la titular (CHT): local Nexcrea, Tegucigalpa.
 */
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

/**
 * OBLIGATORIA — nota permanente del Certificado de Origen / Certificación
 * de Procedencia. Reformulada (10-nov-2026): el sello MAPE.LEGAL
 * es un registro voluntario y complementario de trazabilidad; no emite ni
 * respalda la emisión del documento oficial.
 */
export const CERTIFICADO_ORIGEN_NOTA =
  'El Certificado de Origen o Certificación de Procedencia oficial lo emite ' +
  'el titular del derecho minero y lo autentica la Autoridad Minera o ' +
  'Municipal (Art. 35, Reglamento Especial MAPE, Acuerdo 088-B-2018; art. 43, ' +
  'literal e, Reglamento 042-2013). El sello MAPE.LEGAL es un registro ' +
  'voluntario y complementario de trazabilidad: no sustituye el documento ' +
  'oficial, no es autoridad emisora ni acto de INHGEOMIN.'

/** Versión abreviada para el pie de página; enlaza a /aviso-legal. */
export const CERTIFICADO_ORIGEN_NOTA_BREVE =
  'El Certificado de Origen oficial lo emite el titular del derecho minero y ' +
  'lo autentica la Autoridad Minera o Municipal (Art. 35, Regl. Especial ' +
  'MAPE; art. 43.e, Regl. 042-2013). El sello MAPE.LEGAL es un registro ' +
  'voluntario y complementario; no es autoridad emisora ni acto de INHGEOMIN.'

/**
 * Obligación genérica del comprador (Art. 37 LGM). Hotfix de neutralidad
 * (11-nov-2026): no nombra a ningún comprador ni afirma inscripción alguna.
 * NO se publica como bloque propio en /aviso-legal.
 */
export const REGISTRO_COMERCIALIZADOR =
  'Quien compra mineral debe estar inscrito en el Registro de ' +
  'Comercializadores de INHGEOMIN (Art. 37, Ley General de Minería). Ese ' +
  'registro es una obligación del comprador, no del productor que vende su ' +
  'propia producción. MAPE.LEGAL no compra, no vende ni intermedia oro.'

/**
 * Condición genérica de toda venta formal. Hotfix de neutralidad: no
 * presenta a ningún comprador; describe lo que exige la ley al comprador.
 */
export const CONDICION_COMPRA =
  'Un comprador formal solo adquiere mineral a titulares de derecho minero ' +
  'vigente, con Certificación de Procedencia o Certificado de Origen oficial ' +
  'válido por lote (Art. 38, Ley General de Minería; Art. 34, Reglamento ' +
  'Especial MAPE). MAPE.LEGAL no compra ni vende mineral.'

/**
 * OBLIGATORIA — política de PUBLICACIÓN del precio referencial (hotfix de
 * neutralidad, 11-nov-2026). Es informativa: la plataforma no compra.
 */
export const POLITICA_PRECIO =
  'MAPE.LEGAL publica un precio referencial estimado al 75 % de la ' +
  'referencia internacional del oro, convertido a lempiras con un tipo de ' +
  'cambio de referencia de mercado, expresado por gramo de oro fino. Se ' +
  'publica una vez al día, con su fórmula, fuente y fecha. Es solo ' +
  'informativo: no es una oferta de compra ni un precio oficial.'

/**
 * OBLIGATORIA — encuadre de acceso a mercados. La exigencia proviene del
 * mercado comprador; no es una restricción impuesta al minero.
 */
export const MERCADOS_ACCESO =
  'Acceso a mercados que exigen certificación de origen.'

/** OBLIGATORIA — libertad de comercialización del operador. */
export const LIBERTAD_VENTA =
  'La comercialización de productos minerales es libre (Art. 37, Ley ' +
  'General de Minería). MAPE.LEGAL no compra ni vende: el titular del ' +
  'derecho minero conserva plena libertad de vender su producción a ' +
  'cualquier comprador.'

/* ── Citas legales usadas en el sitio ───────────────────────────────── */
/*
 * Capa de vigencia (sentencia SCO-0090-2014, La Gaceta No. 37,158): antes de
 * añadir una cita de la Ley General de Minería, contrastar el artículo contra
 * LGM_ARTICULOS_ANULADOS en lib/legal/vigenciaLGM.ts — un artículo anulado no
 * puede fundamentar copy público. Revisión 2026-08-04: ninguna entrada actual
 * cita artículos anulados.
 */

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
  // Verificado contra Gaceta 33,088; no impugnado en SCO-0090-2014.
  // Refuerzo: Art. 5 Regl. MAPE.
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

/* ── Precio referencial (/precio y /politica-de-precios) ────────────── */
/*
 * Hotfix de neutralidad (11-nov-2026): el precio publicado es REFERENCIAL e
 * informativo (75 % de la referencia internacional del oro). Ninguna de estas
 * constantes nombra a un comprador ni presenta una oferta de compra. Las
 * cláusulas 5 y 6 del encargo "Precio de Referencia" (2026-07-29) describen
 * la operación de un comprador y quedan @deprecated — no renderizar.
 */

/** Fórmula pública del precio referencial (Bloque 2 de /precio). */
export const PRECIO_REF_FORMULA = FORMULA_PRECIO_REFERENCIAL

/** Carácter del precio publicado: referencial e informativo, de nadie en particular. */
export const PRECIO_REF_CARACTER_COMERCIAL =
  'Este es un precio referencial informativo publicado por la plataforma ' +
  'MAPE.LEGAL. No es un precio oficial del Estado ni de INHGEOMIN, ni una ' +
  'oferta de compra de persona alguna. Toda transacción se negocia ' +
  'libremente entre el productor y el comprador.'

/** Título del bloque de precio referencial en /precios. */
export const PRECIOS_REFERENCIA_COMERCIAL =
  'Precio referencial (75%), fórmula pública y aviso'

/**
 * Nota del factor registrado en una fijación histórica (fila indeleble de
 * precios_referencia). Describe el factor REGISTRADO, no el vigente.
 */
export function factorVigenteNota(version: string): string {
  return (
    `Factor registrado en esta fijación conforme a la Política de publicación ` +
    `v${version}. Sujeto a revisión según el registro de versiones de dicha política.`
  )
}

/**
 * Bloque 3 de /precio: el precio referencial se expresa sobre oro fino.
 * Hotfix de neutralidad: sin método de ensaye ni contramuestra (son de un
 * comprador, no de la plataforma).
 */
export const PRECIO_REF_APLICACION_ORO_FINO =
  'El precio referencial se expresa por gramo de oro fino, no por peso bruto ' +
  'del material. La ley del material la determina, en cada transacción, el ' +
  'comprador con el productor mediante el método que acuerden; MAPE.LEGAL no ' +
  'practica ensayes ni liquida transacciones.'

/** Bloque 4 de /precio: título. Hotfix de neutralidad: sin comprador. */
export const PRECIO_REF_REQUISITOS_TITULO = 'Qué suele pedir un comprador formal'

/**
 * Bloque 4 de /precio: lo que la ley exige a cualquier comprador formal
 * verificar antes de adquirir mineral. No afirma que alguien compre.
 */
export const PRECIO_REF_REQUISITOS_ITEMS = [
  'Derecho minero vigente del productor (permiso de pequeña minería, permiso ' +
    'municipal de minería artesanal o concesión).',
  'Certificación de Procedencia o Certificado de Origen oficial del lote, ' +
    'emitido por el titular del derecho minero y autenticado por la ' +
    'Autoridad Minera o Municipal (Art. 35 del Reglamento Especial MAPE, ' +
    'Acuerdo 088-B-2018; art. 43, literal e, del Reglamento 042-2013).',
  'Identificación de la mina o cantera de procedencia del mineral.',
] as const

/** Bloque 4 de /precio: a quién corresponde el Registro de Comercializadores. */
export const PRECIO_REF_REQUISITOS_NOTA_REGISTRO =
  'El Registro de Comercializadores de INHGEOMIN corresponde al comprador, ' +
  'no al productor que vende su propia producción. MAPE.LEGAL no compra, no ' +
  'vende ni intermedia oro.'

/** Bloque 4 de /precio: cierre (Art. 38). Sin comprador nombrado. */
export const PRECIO_REF_REQUISITOS_CIERRE =
  'El comprador está obligado a verificar el origen de las sustancias ' +
  'minerales, conforme al Artículo 38 de la Ley General de Minería. Un ' +
  'comprador formal no adquiere mineral cuyo origen no pueda acreditarse ' +
  'documentalmente.'

/** Bloque 5 de /precio: título. */
export const PRECIO_REF_NATURALEZA_TITULO = 'Naturaleza de esta publicación'

/** Bloque 5 de /precio: naturaleza = el aviso literal del precio referencial. */
export const PRECIO_REF_NATURALEZA = AVISO_PRECIO_REFERENCIAL

/* Las cláusulas 5 y 6 de la Política de Precios v1.1 (liquidación XRF, ensayo
 * al fuego, contramuestra, verificaciones externas) describían la operación de
 * un COMPRADOR y se retiraron del módulo el 11-nov-2026: MAPE.LEGAL no compra
 * ni liquida transacciones. Quedan en el historial de git (PR #240). */

/**
 * Cláusula de revisión de la Política de publicación del precio referencial.
 * Hotfix de neutralidad: sin comprador, sin costos de ensaye ni refinería.
 */
export const PRECIO_REF_CLAUSULA_REVISION =
  'El factor referencial y las fuentes de los insumos podrán ser revisados ' +
  'por la titular de la plataforma. Toda revisión se publicará como una ' +
  'nueva versión de esta política, con al menos quince (15) días calendario ' +
  'de anticipación a su entrada en vigencia. Las versiones anteriores ' +
  'permanecerán accesibles públicamente.'

/* ── Aviso legal del sitio (/aviso-legal) ───────────────────────────── */

export const AVISO_NATURALEZA_INFORMATIVA =
  'El contenido de este sitio tiene carácter informativo general sobre ' +
  'el marco normativo minero de Honduras. No constituye asesoría legal ' +
  'para un caso concreto. La sola visita o consulta de este sitio no crea ' +
  `relación abogado–cliente con ${RAZON_SOCIAL}, titular y operadora de la ` +
  'plataforma, ni con los profesionales que colaboran con ella.'

export const AVISO_RESOLUCIONES =
  'La resolución de toda solicitud de derecho minero es potestad de la ' +
  `Autoridad Minera. ${RAZON_SOCIAL} (CHT), titular y operadora de la ` +
  'plataforma, gestiona ' +
  'expedientes y acompaña el trámite como proveedora de servicios legales ' +
  'y mineros; no otorga permisos ni puede asegurar el resultado de una ' +
  'resolución.'

/* ── Portal de verificación (/verificar) — interoperabilidad Fase 1 ──── */

/** Nota de método del portal de verificación. */
export const VERIFICAR_FRESCURA_NOTA =
  'Cada registro muestra su fuente documental y la fecha de su última ' +
  'verificación. La información no es en tiempo real; es información ' +
  'verificada contra documento.'

/** Estado inicial del registro público, mientras no existan registros. */
export const VERIFICAR_CARGA_INICIAL =
  'Registro en fase de carga inicial — piloto Iriona, Colón. Los registros ' +
  'del sello complementario que se publiquen en esta sección se conservarán ' +
  'de forma permanente.'

/** Intro del portal /verificar (hotfix de neutralidad, 11-nov-2026). */
export const VERIFICAR_INTRO =
  'Verificación del sello complementario MAPE.LEGAL. Introduzca el número ' +
  'de registro para comprobar si consta en la base operada por Corporación ' +
  'Hondureña Tenka, S.A. Esta consulta no verifica, ni sustituye, la ' +
  'Certificación de Procedencia o Certificado de Origen oficial, que emite ' +
  'el titular del derecho minero y autentica la Autoridad Minera o ' +
  'Municipal. MAPE.LEGAL no es autoridad emisora y no certifica en nombre ' +
  'de INHGEOMIN. La consulta es pública y solo muestra información no ' +
  'personal del registro (número, estado y fecha de última verificación). ' +
  'Los datos personales del productor y los montos no son públicos.'

/**
 * @deprecated — no renderizar (modelo abierto a comercializadores retirado
 * 11-nov-2026). Se conserva solo para no romper importaciones.
 */
export const VERIFICAR_ABIERTO =
  'El sello MAPE.LEGAL es un esquema voluntario y complementario de ' +
  'trazabilidad de la plataforma.'

/** Título del portal de verificación (h1 y metadata). */
export const VERIFICAR_TITULO = 'Verificación del sello complementario MAPE.LEGAL'

/** Estado "no encontrado" de /verificar/[numero]. */
export function VERIFICAR_NO_ENCONTRADO(numero: string): string {
  return (
    'No se encontró un registro del sello complementario MAPE.LEGAL con el ' +
    `número ${numero}. Verifique el número impreso o escriba a ` +
    `${CONTACTO.email}. Esta página no consulta ni valida el documento ` +
    'oficial de procedencia.'
  )
}

/** Estado "revocado" de /verificar/[numero]. */
export const VERIFICAR_REVOCADO =
  'Este registro del sello complementario fue revocado por la plataforma ' +
  `MAPE.LEGAL (operada por ${RAZON_SOCIAL}) y no debe considerarse vigente. No afecta ` +
  'la validez del documento oficial de procedencia, que corresponde ' +
  'verificar ante la autoridad que lo autenticó.'

/* ── Consulta informativa de derechos mineros (/registro) ───────────── */

export const REGISTRO_CONSULTA_TITULO =
  'Consulta informativa de derechos mineros (transcripción no oficial)'

/** Nota de la consulta informativa (hotfix de neutralidad, 11-nov-2026). */
export const REGISTRO_CONSULTA_NOTA =
  'Esta página reproduce, con carácter informativo, listados de concesiones ' +
  'y solicitudes que INHGEOMIN ha hecho públicos. No es el Registro Minero ' +
  'y Catastral de INHGEOMIN, ni un portal ni una base oficial del ' +
  'Instituto. Los datos pueden estar desactualizados. Para validar el ' +
  'estado de un derecho minero, consulte directamente a INHGEOMIN. ' +
  'Corporación Hondureña Tenka, S.A., titular y operadora de la plataforma ' +
  'MAPE.LEGAL, ofrece esta consulta como herramienta de debida diligencia.'
