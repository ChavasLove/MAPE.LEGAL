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

/* ── Identidad (Modelo B, confirmado por Willis 10-nov-2026) ─────────── */
/*
 * Dos personas jurídicas con roles distintos y no intercambiables:
 *
 *  - Inversiones Zekaii, S. de R.L. — DUEÑA y titular de la plataforma
 *    MAPE.LEGAL, operadora de la base de datos, COMPRADORA del oro a los
 *    productores y quien publica el precio de referencia (comercial, suyo).
 *  - Corporación Hondureña Tenka, S.A. (CHT) — presta servicios legales y
 *    mineros a los productores artesanales (expedientes, representación).
 *    NO es dueña, operadora, editora ni compradora; no compra ni vende mineral.
 *
 * MAPE.LEGAL es el nombre de la plataforma y del sello voluntario y
 * complementario de trazabilidad; no es una persona jurídica.
 *
 * Nota no bloqueante sobre la marca: el registro de la marca MAPE.LEGAL ante
 * el Instituto de la Propiedad NO está verificado. No se afirma que exista y
 * no se usan símbolos de marca registrada en ninguna superficie.
 */

/** Dueña y titular de la plataforma; compradora del oro. */
export const RAZON_SOCIAL = 'Inversiones Zekaii, S. de R.L.'

/** Proveedora de servicios legales y mineros a los productores. */
export const RAZON_SOCIAL_SERVICIOS_LEGALES = 'Corporación Hondureña Tenka, S.A.'

/** Rol de CHT, reutilizable tras su razón social. */
export const ROL_CHT =
  'presta servicios legales y mineros a los productores artesanales; no es ' +
  'dueña ni operadora de la plataforma y no compra ni vende mineral.'

export const AVISO_PLATAFORMA =
  `MAPE.LEGAL es una plataforma de la que es dueña y titular ${RAZON_SOCIAL}. ` +
  `${RAZON_SOCIAL_SERVICIOS_LEGALES}, ${ROL_CHT}`

/**
 * PIE DE PÁGINA — texto del Asesor legal (10-nov-2026), VERBATIM.
 * No parafrasear. El pie lo renderiza completo y cierra con el © de la dueña.
 */
export const PIE_NOTA_LEGAL =
  'El Certificado de Origen o Certificación de Procedencia oficial lo emite ' +
  'el titular del derecho minero y debe ser autenticado por la Autoridad ' +
  'Minera o Municipal, conforme al artículo 35 del Reglamento Especial para ' +
  'la Minería Artesanal y la Pequeña Minería (Acuerdo Ejecutivo 088-B-2018) ' +
  'y al artículo 43, literal e, del Reglamento de la Ley General de Minería ' +
  '(Acuerdo Ejecutivo 042-2013). El sello o registro MAPE.LEGAL es un ' +
  'esquema voluntario y complementario de trazabilidad de la plataforma ' +
  'MAPE.LEGAL, de la que es dueña Inversiones Zekaii, S. de R.L. No ' +
  'sustituye el documento oficial, no es un acto de INHGEOMIN ni de ninguna ' +
  'municipalidad, y no existe, a la fecha, un Acuerdo o Instructivo de ' +
  'INHGEOMIN publicado en La Gaceta que lo adopte. Corporación Hondureña ' +
  'Tenka, S.A., presta servicios legales y mineros a los productores ' +
  'artesanales; no es dueña ni operadora de la plataforma y no compra ni ' +
  'vende mineral. El esquema puede ser utilizado, en igualdad de ' +
  'condiciones, por cualquier comercializador inscrito en el Registro de ' +
  'Comercializadores de INHGEOMIN que cumpla el Manual del Estándar.'

/*
 * Domicilio: es el domicilio actual (local Nexcrea) heredado de la etapa en
 * que CHT figuraba como operadora. PENDIENTE: [CONFIRMAR CON WILLIS la
 * dirección de Inversiones Zekaii, S. de R.L.]. No inventar dirección ni
 * teléfono de Zekaii.
 */
export const DOMICILIO_LINES = [
  'Local Nexcrea — Condominios Metrópolis',
  'Torre 1, Nivel 18',
  'Boulevard Suyapa, Tegucigalpa',
  'Francisco Morazán, Honduras',
] as const

/** Marcador para superficies que exijan el domicilio de la dueña. */
export const DOMICILIO_PENDIENTE_CONFIRMACION =
  '[CONFIRMAR CON WILLIS la dirección de Inversiones Zekaii, S. de R.L.]'

export const CONTACTO = {
  whatsapp: '+504 9737 3139',
  whatsappHref: 'https://wa.me/50497373139',
  email: 'gerencia@mape.legal',
  emailHref: 'mailto:gerencia@mape.legal',
} as const

/* ── Formulaciones obligatorias (§1.2 del encargo) ──────────────────── */

/**
 * OBLIGATORIA — nota permanente del Certificado de Origen / Certificación
 * de Procedencia. Reformulada (Modelo B, 10-nov-2026): el sello MAPE.LEGAL
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
 * Formulación NO afirmativa (Modelo B, 10-nov-2026). No se afirma que la
 * dueña de la plataforma ya cuente con el Registro de Comercializadores:
 * solo que debe mantenerlo vigente para comprar. No afirmar la inscripción
 * hasta que exista el acto y se verifique.
 */
export const REGISTRO_COMERCIALIZADOR =
  `${RAZON_SOCIAL} debe mantener vigente su inscripción en el Registro de ` +
  'Comercializadores de INHGEOMIN para comprar mineral (Art. 37, Ley ' +
  'General de Minería). El registro de comercializador es del comprador, ' +
  'no del productor que vende su propia producción.'

/** OBLIGATORIA — condición de compra de oro. */
export const CONDICION_COMPRA =
  `${RAZON_SOCIAL} compra únicamente a titulares de derecho minero ` +
  'vigente, con Certificación de Procedencia o Certificado de Origen ' +
  'oficial válido por lote.'

/**
 * OBLIGATORIA — política de precio publicada.
 *
 * Reformulada por el encargo "Precio de Referencia" (2026-07-29): se retira
 * la expresión del precio como porcentaje congelado — el factor de
 * comercialización vive en la Política de Precios versionada, con cláusula
 * de revisión — y se califica el gramo como oro fino (R5). Modelo B
 * (10-nov-2026): el precio es comercial y de Inversiones Zekaii; la
 * referencia es la "referencia internacional del oro" (el feed real no es
 * el fixing LBMA, no afirmarlo).
 */
export const POLITICA_PRECIO =
  `Un solo precio de referencia comercial de ${RAZON_SOCIAL}, expresado en ` +
  'lempiras por gramo de oro fino, fijado una vez al día con fórmula ' +
  'verificable: referencia internacional del oro, tipo de cambio de ' +
  'referencia del BCH y factor de comercialización conforme a la Política ' +
  `de Precios de ${RAZON_SOCIAL} vigente. Sin comisiones adicionales sobre ` +
  'la misma onza.'

/**
 * OBLIGATORIA — encuadre de acceso a mercados. La exigencia proviene del
 * mercado comprador; no es una restricción impuesta al minero.
 */
export const MERCADOS_ACCESO =
  'Acceso a mercados que exigen certificación de origen.'

/** OBLIGATORIA — libertad de comercialización del operador. */
export const LIBERTAD_VENTA =
  'La comercialización de productos minerales es libre (Art. 37, Ley ' +
  `General de Minería). Vender a ${RAZON_SOCIAL} no crea obligación de ` +
  'venta futura: el titular del derecho minero conserva plena libertad de ' +
  'vender su producción a cualquier comprador.'

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

/* ── Precio de Referencia (/precio y /politica-de-precios) ──────────── */
/*
 * Bloques del encargo "Precio de Referencia" (2026-07-29). Los marcados
 * TEXTO LEGAL — LITERAL se transcribieron carácter por carácter del script
 * de ejecución: prohibido parafrasear, resumir o traducir sin revisión legal.
 *
 * v1.2-BORRADOR (Modelo B, instrucción de Willis 10-nov-2026): en los bloques
 * literales se SUSTITUYE la razón social "Corporación Hondureña Tenka, S.A."
 * por "Inversiones Zekaii, S. de R.L." (la compradora). No se inventa
 * laboratorio ni se altera la distinción liquidación/contraste. El texto
 * resultante queda PENDIENTE DE REVISIÓN LEGAL.
 */

/** Fórmula publicada del Precio de Referencia (Bloque 2 de /precio). */
export const PRECIO_REF_FORMULA =
  'Precio (L/gramo de oro fino) = ( Referencia internacional del oro en USD ' +
  'por onza troy ÷ 31.1035 ) × Factor de comercialización × Tipo de cambio ' +
  'de referencia del BCH'

/** Carácter comercial del precio publicado (Modelo B). */
export const PRECIO_REF_CARACTER_COMERCIAL =
  `Este es un precio de referencia comercial de ${RAZON_SOCIAL}. No es un ` +
  'precio oficial del Estado, de INHGEOMIN ni de MAPE.LEGAL como estándar. ' +
  'Otros comercializadores adheridos al esquema publican, si lo desean, sus ' +
  'propias condiciones.'

/** Título del bloque de precio comercial en /precios. */
export const PRECIOS_REFERENCIA_COMERCIAL =
  `Precio de referencia de ${RAZON_SOCIAL}, fórmula y requisitos para vender`

/**
 * Nota del factor de comercialización en el Bloque 2 de /precio. Modelo B:
 * describe el factor REGISTRADO en la fijación mostrada (fila indeleble), no
 * un factor "vigente" — el factor de compra al productor está pendiente.
 */
export function factorVigenteNota(version: string): string {
  return (
    `Factor registrado en esta fijación conforme a la Política de Precios ` +
    `v${version}. Sujeto a revisión según la cláusula 4 de dicha política.`
  )
}

/** TEXTO LEGAL — LITERAL. Bloque 3 de /precio: aplicación sobre oro fino. */
export const PRECIO_REF_APLICACION_ORO_FINO =
  'El precio se aplica sobre el contenido de oro fino, no sobre el peso ' +
  'bruto del material entregado. La ley del material se determina ' +
  'mediante el método declarado en la Política de Precios vigente, ' +
  'practicado en presencia del vendedor o de su representante. El ' +
  'vendedor tiene derecho a solicitar contramuestra y a que ésta sea ' +
  'analizada por un tercero, conforme al procedimiento establecido en ' +
  'dicha política.'

/**
 * Bloque 4 de /precio: título de requisitos. v1.2-BORRADOR (Modelo B):
 * comprador = Inversiones Zekaii. Pendiente de revisión legal.
 */
export const PRECIO_REF_REQUISITOS_TITULO =
  `Requisitos para vender mineral a ${RAZON_SOCIAL}`

/**
 * Bloque 4 de /precio: los tres requisitos, en orden. v1.2-BORRADOR (Modelo
 * B): el Registro de Comercializadores es del comprador — ya NO se exige al
 * vendedor; el documento oficial lo emite el titular y lo autentica la
 * Autoridad Minera o Municipal. Pendiente de revisión legal.
 */
export const PRECIO_REF_REQUISITOS_ITEMS = [
  'Derecho minero vigente del vendedor (permiso de pequeña minería, permiso ' +
    'municipal de minería artesanal o concesión).',
  'Certificación de Procedencia o Certificado de Origen oficial del lote ' +
    'ofrecido, emitido por el titular del derecho minero y autenticado por ' +
    'la Autoridad Minera o Municipal (Art. 35 del Reglamento Especial MAPE, ' +
    'Acuerdo 088-B-2018; art. 43, literal e, del Reglamento 042-2013).',
  'Identificación de la mina o cantera de procedencia del mineral.',
] as const

/** Bloque 4 de /precio: a quién corresponde el Registro de Comercializadores. */
export const PRECIO_REF_REQUISITOS_NOTA_REGISTRO =
  'El Registro de Comercializadores de INHGEOMIN corresponde al comprador — ' +
  `${RAZON_SOCIAL} u otro comercializador adherido —, no al productor que ` +
  `vende su propia producción. ${RAZON_SOCIAL_SERVICIOS_LEGALES}, no compra ` +
  'ni vende mineral.'

/**
 * TEXTO LEGAL — LITERAL (v1.2-BORRADOR: razón social sustituida por
 * instrucción de Willis 10-nov-2026; pendiente de revisión legal).
 * Bloque 4 de /precio: cierre (Art. 38).
 */
export const PRECIO_REF_REQUISITOS_CIERRE =
  'El comprador está obligado a verificar el origen de las sustancias ' +
  `minerales, conforme al Artículo 38 de la Ley de Minería. ${RAZON_SOCIAL} ` +
  'no adquiere mineral cuyo origen no pueda acreditarse documentalmente.'

/** TEXTO LEGAL — LITERAL. Bloque 5 de /precio: título. */
export const PRECIO_REF_NATURALEZA_TITULO = 'Naturaleza de esta publicación'

/**
 * TEXTO LEGAL — LITERAL (v1.2-BORRADOR: razón social sustituida por
 * instrucción de Willis 10-nov-2026; pendiente de revisión legal).
 * Bloque 5 de /precio: naturaleza jurídica.
 */
export const PRECIO_REF_NATURALEZA =
  'Esta publicación tiene carácter informativo y no constituye oferta de ' +
  `compra. ${RAZON_SOCIAL} no queda obligada a adquirir mineral por la sola ` +
  'publicación de este precio de referencia. Toda operación se perfecciona ' +
  'mediante contrato individual de compraventa, previa verificación del ' +
  'origen del mineral y de la elegibilidad del vendedor conforme a los ' +
  'requisitos señalados.'

/* Cláusulas 5 y 6 de la Política de Precios (Adenda 01, 2026-07-29).
 * TEXTO LEGAL — LITERAL: transcritas carácter por carácter; prohibido
 * alterar la distinción entre método de liquidación y método de contraste.
 * v1.2-BORRADOR: la razón social "Corporación Hondureña Tenka, S.A." se
 * sustituye por "Inversiones Zekaii, S. de R.L." (instrucción de Willis
 * 10-nov-2026). Pendiente de revisión legal. */

export interface ClausulaPolitica {
  num: string
  titulo: string
  texto: string
}

/** TEXTO LEGAL — LITERAL. Cláusula 5: título. */
export const POLITICA_CL5_TITULO = 'Determinación de la ley del material'

/** TEXTO LEGAL — LITERAL. Cláusula 5: subsecciones 5.1–5.5. */
export const POLITICA_CL5: readonly ClausulaPolitica[] = [
  {
    num: '5.1',
    titulo: 'Objeto del precio.',
    texto:
      'El precio de referencia se aplica sobre el contenido de oro fino del ' +
      'material entregado, expresado en gramos de oro fino. No se aplica ' +
      'sobre el peso bruto del material.',
  },
  {
    num: '5.2',
    titulo: 'Método de liquidación.',
    texto:
      'La ley que determina el pago de cada transacción se establece ' +
      'mediante fluorescencia de rayos X (XRF), practicada sobre superficie ' +
      'preparada del material, en presencia del vendedor o de su ' +
      'representante. La preparación de superficie es obligatoria y ' +
      'consiste en la exposición de superficie fresca en dos caras opuestas ' +
      'del material, o en su fusión y homogeneización previas. Ninguna ' +
      'lectura se practica sobre superficie sin preparar.',
  },
  {
    num: '5.3',
    titulo: 'Método de contraste.',
    texto:
      'El método de referencia es el ensayo al fuego, mediante fusión con ' +
      'litargirio, carbonato de sodio, bórax, sílice y agente reductor, ' +
      'seguido de copelación y lectura del régulo metálico resultante por ' +
      'fluorescencia de rayos X. Este método se aplica en tres supuestos: ' +
      'cuando el vendedor ejerce su derecho de contramuestra; en la ' +
      'verificación periódica de calibración del método de liquidación; y ' +
      'en la reconciliación con la refinería de destino.',
  },
  {
    num: '5.4',
    titulo: 'Muestreo del material.',
    texto:
      'Cuando el material entregado sea producto ya recuperado por el ' +
      'vendedor, la determinación se practica sobre material previamente ' +
      'fundido y homogeneizado, con toma de muestra en dos puntos opuestos. ' +
      'Cuando el material entregado sea mineral, la determinación se ' +
      'practica sobre muestra pulverizada de entre diez (10) y cincuenta ' +
      '(50) gramos. El procedimiento operativo detallado de muestreo forma ' +
      'parte integrante de esta política y se publica junto con ella.',
  },
  {
    num: '5.5',
    titulo: 'Muestra testigo.',
    texto:
      'De cada lote se conserva una porción sellada e identificada, firmada ' +
      `por el vendedor y por ${RAZON_SOCIAL}, en custodia por noventa (90) ` +
      'días calendario contados desde la fecha de la transacción. La muestra ' +
      'testigo constituye la base de cualquier verificación posterior.',
  },
] as const

/** TEXTO LEGAL — LITERAL. Cláusula 6: título. */
export const POLITICA_CL6_TITULO = 'Liquidación, contramuestra y ajuste'

/** TEXTO LEGAL — LITERAL. Cláusula 6: subsecciones 6.1–6.6. */
export const POLITICA_CL6: readonly ClausulaPolitica[] = [
  {
    num: '6.1',
    titulo: 'Liquidación provisional.',
    texto:
      'El pago se efectúa el mismo día de la entrega, sobre la base del ' +
      'método de liquidación señalado en la cláusula 5.2. Esta liquidación ' +
      'tiene carácter provisional.',
  },
  {
    num: '6.2',
    titulo: 'Derecho de contramuestra.',
    texto:
      'El vendedor tiene derecho a solicitar, sin costo alguno y dentro de ' +
      'los quince (15) días calendario siguientes a la transacción, que la ' +
      'muestra testigo sea analizada por el método de contraste. La ' +
      'solicitud no requiere expresión de causa.',
  },
  {
    num: '6.3',
    titulo: 'Laboratorio dirimente.',
    texto:
      'Cuando el resultado del método de contraste difiera del resultado de ' +
      'liquidación en más del margen señalado en la cláusula 6.4, ' +
      'cualquiera de las partes puede requerir el análisis de la muestra ' +
      'testigo por el laboratorio tercero designado en el Anexo I de esta ' +
      'política. Su resultado es definitivo para ambas partes. El costo se ' +
      'asume por la parte cuyo resultado resulte más alejado del dictamen ' +
      'del laboratorio dirimente.',
  },
  {
    num: '6.4',
    titulo: 'Liquidación final y ajuste.',
    texto:
      'La diferencia entre la liquidación provisional y el resultado ' +
      'definitivo se ajusta en la siguiente transacción del vendedor, o ' +
      'mediante pago o cargo directo si no hubiere transacción posterior ' +
      'dentro de treinta (30) días. El ajuste opera en ambas direcciones y ' +
      'no excede de dos (2) puntos porcentuales de ley por transacción. ' +
      'Toda diferencia que exceda ese límite suspende la liquidación y ' +
      'activa el procedimiento de la cláusula 6.3.',
  },
  {
    num: '6.5',
    titulo: 'Verificación externa periódica.',
    texto:
      `${RAZON_SOCIAL} remite trimestralmente muestras ciegas a un ` +
      'laboratorio independiente y publica los resultados de esa ' +
      'verificación en el sitio institucional, junto con el histórico de ' +
      'verificaciones anteriores.',
  },
  {
    num: '6.6',
    titulo: 'Constancia.',
    texto:
      'El resultado de la determinación de ley, el método empleado, la ' +
      'identificación de la muestra testigo y el detalle de cualquier ' +
      'ajuste constan en el estado de cuenta de la transacción entregado ' +
      'al vendedor.',
  },
] as const

/** LITERAL (Tarea 7, Adenda 01): estado vacío de verificaciones externas. */
export const VERIFICACIONES_EXTERNAS_VACIO =
  'Primera verificación externa programada. Los resultados de todas las ' +
  'verificaciones se publicarán en esta sección de forma permanente.'

/**
 * TEXTO LEGAL — LITERAL (v1.2-BORRADOR: razón social sustituida por
 * instrucción de Willis 10-nov-2026; pendiente de revisión legal).
 * Cláusula 4 de la Política de Precios: revisión.
 */
export const PRECIO_REF_CLAUSULA_REVISION =
  `El factor de comercialización podrá ser revisado por ${RAZON_SOCIAL} ` +
  'cuando varíen de manera sostenida los costos de ensaye, transporte, ' +
  'seguridad, financiamiento o las condiciones de la relación con la ' +
  'refinería de destino. Toda revisión se publicará como ' +
  'una nueva versión de esta política, con al menos quince (15) días ' +
  'calendario de anticipación a su entrada en vigencia. Las versiones ' +
  'anteriores permanecerán accesibles públicamente.'

/* ── Aviso legal del sitio (/aviso-legal) ───────────────────────────── */

export const AVISO_NATURALEZA_INFORMATIVA =
  'El contenido de este sitio tiene carácter informativo general sobre ' +
  'el marco normativo minero de Honduras. No constituye asesoría legal ' +
  'para un caso concreto. La sola visita o consulta de este sitio no crea ' +
  `relación alguna con ${RAZON_SOCIAL} (dueña de la plataforma), ni una ` +
  `relación abogado–cliente con ${RAZON_SOCIAL_SERVICIOS_LEGALES} ni con ` +
  'los profesionales que colaboran con ella.'

export const AVISO_RESOLUCIONES =
  'La resolución de toda solicitud de derecho minero es potestad de la ' +
  `Autoridad Minera. ${RAZON_SOCIAL_SERVICIOS_LEGALES} (CHT) gestiona ` +
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

/** Texto del Asesor (10-nov-2026), VERBATIM — intro del portal /verificar. */
export const VERIFICAR_INTRO =
  'Verificación del sello complementario MAPE.LEGAL. Introduzca el número ' +
  'de registro para comprobar si consta en la base operada por Inversiones ' +
  'Zekaii, S. de R.L. Esta consulta no verifica, ni sustituye, la ' +
  'Certificación de Procedencia o Certificado de Origen oficial, que emite ' +
  'el titular del derecho minero y autentica la Autoridad Minera o ' +
  'Municipal. MAPE.LEGAL no es autoridad emisora y no certifica en nombre ' +
  'de INHGEOMIN. La consulta es pública y solo muestra información no ' +
  'personal del registro (número, estado y fecha de última verificación). ' +
  'Los datos personales del productor y los montos no son públicos.'

/** Apertura del esquema a otros comercializadores. */
export const VERIFICAR_ABIERTO =
  'El esquema está abierto a comercializadores registrados que se adhieran ' +
  'al Manual del Estándar.'

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
  `MAPE.LEGAL (${RAZON_SOCIAL}) y no debe considerarse vigente. No afecta ` +
  'la validez del documento oficial de procedencia, que corresponde ' +
  'verificar ante la autoridad que lo autenticó.'

/* ── Consulta informativa de derechos mineros (/registro) ───────────── */

export const REGISTRO_CONSULTA_TITULO =
  'Consulta informativa de derechos mineros (transcripción no oficial)'

/** Texto del Asesor (10-nov-2026), VERBATIM. */
export const REGISTRO_CONSULTA_NOTA =
  'Esta página reproduce, con carácter informativo, listados de concesiones ' +
  'y solicitudes que INHGEOMIN ha hecho públicos. No es el Registro Minero ' +
  'y Catastral de INHGEOMIN, ni un portal ni una base oficial del ' +
  'Instituto. Los datos pueden estar desactualizados. Para validar el ' +
  'estado de un derecho minero, consulte directamente a INHGEOMIN. ' +
  'Inversiones Zekaii, S. de R.L., opera esta consulta como herramienta de ' +
  'debida diligencia de la plataforma MAPE.LEGAL.'
