/**
 * Estándar privado de debida diligencia MAPE.LEGAL — contenido público
 * (Etapa 2, brief v2.1, 12-nov-2026).
 *
 * Fuente única de la versión, el estado, la ESTRUCTURA del estándar y de la
 * política de cadena de suministro, y del mapeo a los cinco pasos de la Guía
 * de Debida Diligencia de la OCDE. Las páginas /estandar, /politica-de-cadena,
 * /auditoria y /quienes-somos importan de aquí; ninguna escribe texto propio
 * con consecuencia jurídica.
 *
 * Reglas duras del borrador:
 *  - Los textos definitivos del estándar y de la política NO existen todavía.
 *    Cada sección publica su título, su alcance y el marcador
 *    PLACEHOLDER_TEXTO. No inventar redacciones, umbrales, auditores ni
 *    resultados.
 *  - Ninguna superficie pública nombra a compradores, comercializadores ni
 *    plantas: la cadena se describe con CADENA_DESCRIPCION_PUBLICA.
 *  - CHT es desarrolladora y titular de la plataforma y del estándar; no
 *    compra ni vende mineral. El texto de identidad vive en copy-legal.ts.
 *  - Toda cita legal nueva lleva [VERIFICAR LEGAL MINERO] hasta que el equipo
 *    legal la confirme contra La Gaceta. Antes de citar la Ley General de
 *    Minería, contrastar contra LGM_ARTICULOS_ANULADOS (lib/legal/vigenciaLGM.ts).
 *  - Las guías OCDE, LBMA y CRAFT son referencias de diseño: no implican
 *    certificación, membresía ni aval.
 */

import { RAZON_SOCIAL } from './copy-legal'

/* ── Versión y estado ───────────────────────────────────────────────── */

export const ESTANDAR_VERSION = '2.0-BORRADOR'
export const ESTANDAR_FECHA = '2026-11-12'
export const ESTANDAR_ESTADO =
  'Borrador — pendiente de aprobación de CHT, CAPITÁN LEGAL y LEGAL MINERO'

export const POLITICA_CADENA_VERSION = '2.0-BORRADOR'
export const POLITICA_CADENA_FECHA = '2026-11-12'
export const POLITICA_CADENA_ESTADO =
  'Borrador — pendiente de aprobación de CHT, CAPITÁN LEGAL y LEGAL MINERO'

/* ── Auditoría externa ──────────────────────────────────────────────── */

export const AUDITORIA_RESUMEN_DISPONIBLE = false
export const AUDITORIA_CICLO = 'anual'
export const AUDITORIA_TEXTO_VACIO =
  'Aún no hay un resumen de auditoría externa publicado. El primer ciclo ' +
  'anual se publicará aquí, con versión y fecha, cuando exista un informe ' +
  'real de un auditor externo designado.'

/* ── Cadena y contacto ──────────────────────────────────────────────── */

/** Única forma pública de nombrar la cadena. No sustituir por nombres propios. */
export const CADENA_DESCRIPCION_PUBLICA =
  'la cadena de suministro de la planta de beneficio participante'

export const CANAL_CORRECCIONES = 'gerencia@mape.legal'

/** Marcador de texto pendiente. Se publica tal cual mientras no haya aprobación. */
export const PLACEHOLDER_TEXTO = '[TEXTO PENDIENTE DE APROBACIÓN]'

/** Marcador de parámetro sin valor definido (umbral de conciliación, etc.). */
export const PLACEHOLDER_POR_DEFINIR = '[POR DEFINIR]'

/** Marca que acompaña toda cita legal no confirmada por el equipo legal. */
export const MARCA_VERIFICAR_LEGAL = '[VERIFICAR LEGAL MINERO]'

/** Propósito del estándar en una oración (párrafo de apertura de /estandar). */
export const ESTANDAR_PROPOSITO =
  `MAPE.LEGAL es un estándar privado de debida diligencia para ` +
  `${CADENA_DESCRIPCION_PUBLICA}. Lo desarrolla y es su titular ${RAZON_SOCIAL} ` +
  '(CHT). Aplica únicamente a los actores de esa cadena que lo adoptan; no es un ' +
  'portal del Estado, no es un registro de INHGEOMIN y no está abierto a ' +
  'cualquier comercializador.'

/** Aviso de borrador (encabezado de /estandar y /politica-de-cadena). */
export const ESTANDAR_AVISO_BORRADOR =
  'Este documento es un borrador. Publica la estructura y el alcance de cada ' +
  'sección; los textos definitivos se incorporarán con versión y fecha una ' +
  'vez aprobados. Nada de lo aquí publicado constituye todavía una obligación ' +
  'exigible ni una declaración de cumplimiento.'

/* ── Estructura del estándar ────────────────────────────────────────── */

export interface SeccionDocumento {
  numero: number
  titulo: string
  /** Alcance de la sección (qué regula), sin redacción definitiva. */
  alcance: string
  /** Fundamento normativo de referencia, con marca de verificación si aplica. */
  fundamento?: string
  /** Texto definitivo: siempre PLACEHOLDER_TEXTO mientras el estado sea borrador. */
  texto: string
}

export const ESTANDAR_SECCIONES: readonly SeccionDocumento[] = [
  {
    numero: 1,
    titulo: 'Alcance y titularidad',
    alcance:
      `A quién aplica el estándar (${CADENA_DESCRIPCION_PUBLICA}), quién es su ` +
      `titular (${RAZON_SOCIAL}) y qué no es: no sustituye actos oficiales ni ` +
      'constituye autoridad.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 2,
    titulo: 'Definiciones',
    alcance:
      'Términos del estándar: fuente, lote, evento de custodia, titular de ' +
      'beneficio, comercializador, planta participante, auditor externo, ' +
      'consentimiento informado.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 3,
    titulo: 'Registro de fuentes',
    alcance:
      'Qué datos y documentos registra el comercializador por cada fuente de ' +
      'mineral antes de recibir un lote, y cómo se conservan.',
    fundamento:
      'Art. 43, incisos c, e y f, del Reglamento de la Ley General de Minería ' +
      `(Acuerdo Ejecutivo 042-2013) ${MARCA_VERIFICAR_LEGAL}`,
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 4,
    titulo: 'Elegibilidad del origen',
    alcance:
      'Condiciones para que una fuente sea elegible: permiso municipal vigente y ' +
      'área delimitada por INHGEOMIN; constancia de consulta previa, libre e ' +
      'informada (CLPI) cuando sea exigible; declaración de mercurio cero. Una ' +
      'fuente sin permiso vigente o fuera de área no puede originar lotes.',
    fundamento: `Art. 90 de la Ley General de Minería ${MARCA_VERIFICAR_LEGAL}`,
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 5,
    titulo: 'Cadena de custodia',
    alcance:
      'Cada lote lleva una secuencia de eventos encadenados por hash. Cada ' +
      'evento registra actor, fecha, lugar, peso y ley. Nada se borra ni se ' +
      'edita: una corrección es un evento nuevo que referencia al anterior.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 6,
    titulo: 'Conciliación de pesos',
    alcance:
      'Comparación del peso entre los puntos de la cadena (origen, acopio, ' +
      'laboratorio, refinado). Una diferencia por encima del umbral genera ' +
      `alerta y bloquea el lote. Umbral: ${PLACEHOLDER_POR_DEFINIR}.`,
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 7,
    titulo: 'Pagos bancarios e identificables',
    alcance:
      'Todo pago al productor se hace por medio bancario con referencia ' +
      'verificable. El efectivo no es un medio admitido: su registro bloquea el ' +
      'lote.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 8,
    titulo: 'Consentimiento informado para el acceso al expediente',
    alcance:
      'La planta participante accede al expediente del productor solo con ' +
      'consentimiento informado, firmado, con alcance definido y revocable. La ' +
      'revocación cierra el acceso hacia adelante y conserva la bitácora.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 9,
    titulo: 'Roles y acceso',
    alcance:
      'Roles de la plataforma (productor, comercializador, planta, auditor, ' +
      'administración), qué ve cada uno y bitácora de lectura y exportación. ' +
      'Ningún rol ve los márgenes de otro.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 10,
    titulo: 'Fundición',
    alcance:
      'La fundición la realiza únicamente el titular de beneficio identificado ' +
      'en el evento. Un evento de fundición a cargo del comercializador se ' +
      'rechaza.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 11,
    titulo: 'Auditoría externa anual',
    alcance:
      `Un auditor externo designado revisa el sistema con ciclo ${AUDITORIA_CICLO}, ` +
      'con acceso de lectura y exportación. El resumen se publica en /auditoria ' +
      'con versión y fecha, solo cuando exista un informe real.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 12,
    titulo: 'Correcciones y contacto',
    alcance:
      `Cómo señalar un error y por dónde: ${CANAL_CORRECCIONES}. Toda corrección ` +
      'se registra como evento nuevo, con fecha.',
    texto: PLACEHOLDER_TEXTO,
  },
]

/* ── Estructura de la política de cadena de suministro ──────────────── */
/*
 * Compromisos del Anexo II de la Guía OCDE adoptados como política PRIVADA de
 * la cadena. La Guía es referencia de diseño; adoptar su estructura no implica
 * certificación, membresía ni aval de la OCDE.
 */

export const POLITICA_CADENA_SECCIONES: readonly SeccionDocumento[] = [
  {
    numero: 1,
    titulo: 'Alcance y naturaleza de la política',
    alcance:
      `Política privada de ${CADENA_DESCRIPCION_PUBLICA}, adoptada por los ` +
      'actores que se adhieren al estándar. Referencia de diseño: Anexo II de ' +
      'la Guía de Debida Diligencia de la OCDE.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 2,
    titulo: 'Abusos graves — no tolerancia',
    alcance:
      'Exclusión de mineral vinculado a tortura, trabajo forzoso, peores formas ' +
      'de trabajo infantil, violaciones graves de derechos humanos o crímenes de ' +
      'guerra.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 3,
    titulo: 'Grupos armados no estatales — no tolerancia',
    alcance:
      'Exclusión de mineral que financie o beneficie, directa o indirectamente, ' +
      'a grupos armados no estatales.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 4,
    titulo: 'Fuerzas de seguridad públicas o privadas — mitigación',
    alcance:
      'Gestión del riesgo cuando intervienen fuerzas de seguridad en la zona de ' +
      'extracción o en el transporte.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 5,
    titulo: 'Sobornos y falsificación del origen — mitigación',
    alcance:
      'Rechazo de pagos indebidos y de declaraciones de origen falsas; medidas ' +
      'frente al riesgo detectado.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 6,
    titulo: 'Lavado de activos — mitigación',
    alcance:
      'Pagos bancarios e identificables como control principal; cooperación ' +
      'con las autoridades competentes cuando corresponda.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 7,
    titulo: 'Impuestos, regalías y tasas — mitigación',
    alcance:
      'Compromiso de que los actores de la cadena cumplan sus obligaciones ' +
      'tributarias y mineras ante el Estado.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 8,
    titulo: 'Mercurio',
    alcance:
      'Compromiso de mercurio cero en el beneficio del mineral de la cadena, ' +
      'con declaración por fuente.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 9,
    titulo: 'Consulta previa, libre e informada (CLPI)',
    alcance:
      'Exclusión del mineral de territorios de pueblos indígenas o tribales ' +
      'cuando no conste la CLPI exigible. Referencia: Convenio 169 de la OIT.',
    texto: PLACEHOLDER_TEXTO,
  },
  {
    numero: 10,
    titulo: 'Revisión y versiones',
    alcance:
      'Cómo se revisa la política, con qué anticipación se publica una nueva ' +
      'versión y dónde quedan accesibles las anteriores.',
    texto: PLACEHOLDER_TEXTO,
  },
]

/* ── Mapeo a los cinco pasos de la Guía OCDE ────────────────────────── */

export interface PasoOcde {
  paso: 1 | 2 | 3 | 4 | 5
  titulo: string
  /** Módulos y controles de la plataforma que responden al paso. */
  modulos: readonly string[]
}

/** Cinco pasos. No existe un sexto. */
export const MAPEO_OCDE: readonly PasoOcde[] = [
  {
    paso: 1,
    titulo: 'Establecer sistemas sólidos de gestión',
    modulos: [
      'Titularidad del estándar y de la plataforma en CHT',
      'Control de acceso por rol (RBAC)',
      'Registro de fuentes',
      'Cadena de custodia con eventos encadenados por hash',
      'Pagos bancarios e identificables',
      'Política de cadena de suministro publicada',
    ],
  },
  {
    paso: 2,
    titulo: 'Identificar y evaluar los riesgos de la cadena',
    modulos: [
      'Bloqueo de fuentes sin permiso vigente o fuera de área delimitada',
      'Declaración de mercurio cero por fuente',
      'Exclusión de origen sin CLPI exigible',
      'Conciliación de pesos y alertas',
      'Detección de acceso sin consentimiento informado',
    ],
  },
  {
    paso: 3,
    titulo: 'Diseñar y aplicar una estrategia frente a los riesgos',
    modulos: [
      'Bloqueo del lote: pago en efectivo, pago sin referencia bancaria, fuente sin permiso, fundición no realizada por el titular de beneficio, diferencia de peso sobre el umbral',
      'Bitácora de lectura y exportación',
      'Roles que no ven los márgenes de otros actores',
    ],
  },
  {
    paso: 4,
    titulo: 'Auditoría independiente de la debida diligencia',
    modulos: [
      'Rol de auditor externo',
      'Acceso de lectura y exportación',
      `Ciclo ${AUDITORIA_CICLO}`,
      'Resumen anual publicado cuando exista un informe real',
    ],
  },
  {
    paso: 5,
    titulo: 'Informar anualmente sobre la debida diligencia',
    modulos: [
      'Página pública del resumen de auditoría (/auditoria)',
      'Versión y fecha visibles',
      'Sin resultados inventados: vacío declarado hasta el primer informe',
    ],
  },
]

/* ── Referencias de diseño ──────────────────────────────────────────── */

export interface ReferenciaDiseno {
  nombre: string
  detalle: string
}

export const REFERENCIAS_DISENO: readonly ReferenciaDiseno[] = [
  {
    nombre: 'Guía de Debida Diligencia de la OCDE para cadenas de suministro responsables de minerales',
    detalle: '3.ª edición (2016), incluido el Anexo II (política modelo).',
  },
  {
    nombre: 'LBMA Responsible Gold Guidance',
    detalle: 'Guía de oro responsable de la London Bullion Market Association.',
  },
  {
    nombre: 'CRAFT 2.1',
    detalle: 'Código para la mitigación de riesgos en la minería artesanal y de pequeña escala.',
  },
]

/** Frase obligatoria junto a cada referencia de diseño. */
export const REFERENCIAS_DISENO_NOTA =
  'Referencia de diseño; no implica certificación, membresía ni aval.'

/* ── Sello complementario y documento oficial ───────────────────────── */

/**
 * Nota del sello frente al Certificado de Origen oficial. Complementa
 * CERTIFICADO_ORIGEN_NOTA (copy-legal.ts) en /estandar. La cita de Art. 35
 * lleva marca porque el estándar la reutiliza en un contexto nuevo.
 */
export const SELLO_NOTA_ESTANDAR =
  'El sello MAPE.LEGAL es voluntario y complementario. El Certificado de ' +
  'Origen oficial lo emite el titular del derecho minero y lo autentica la ' +
  'Autoridad Minera o Municipal (Art. 35 del Reglamento Especial MAPE, ' +
  `Acuerdo 088-B-2018 ${MARCA_VERIFICAR_LEGAL}). El estándar registra ese ` +
  'documento; no lo emite ni lo sustituye.'
