// lib/maria/soloLectura.ts — María frente a expedientes, recepciones y
// perfiles: SOLO LEE, CITA su fuente y deja la decisión al personal. PURO.
//
// 1. Sin herramientas de escritura: María no crea ni edita recepciones,
//    perfiles ni documentos; no aprueba perfiles ni cierra lotes. Las llamadas
//    al modelo no llevan `tools` (HERRAMIENTAS_MARIA está vacía a propósito) y
//    un pedido de escritura se responde con un texto fijo, sin pasar por el
//    modelo.
// 2. Cita obligatoria: toda afirmación sobre un expediente o una recepción
//    lleva su fuente (documento, versión y fecha, o número de recepción). Sin
//    fuente recuperada, la respuesta es SIN_FUENTE.
// 3. Alcance: solo lo que el interlocutor AUTENTICADO puede ver (rol y
//    organización; un punto de recepción solo lo de su punto). El filtro lo
//    aplica la búsqueda, antes de recuperar (lib/documentos/acl.ts).
// 4. Humano en el ciclo: lo que María sugiere a un punto de recepción es
//    orientación; la decisión y cualquier registro los hace el personal.
// 5. Por WhatsApp no se consultan expedientes ni recepciones: cómo identificar
//    a un punto de recepción por ese canal es [POR CONFIRMAR — WILLIS]. Por
//    defecto, solo el canal autenticado del panel.

import type { Role } from '@/lib/userRoleLookup';

/** Herramientas del modelo. Vacía: María no tiene ninguna, y menos de escritura. */
export const HERRAMIENTAS_MARIA: ReadonlyArray<never> = [];

export const CANALES_MARIA = ['whatsapp', 'web_publica', 'panel_autenticado'] as const;
export type CanalMaria = (typeof CANALES_MARIA)[number];

/** Solo el canal autenticado consulta expedientes, recepciones y perfiles. */
export function canalConsultaExpedientes(canal: CanalMaria): boolean {
  return canal === 'panel_autenticado';
}

export const SIN_FUENTE = 'No tengo ese dato en el expediente.';

export const RESPUESTA_SOLO_LECTURA =
  'Yo solo consulto: no registro, edito, apruebo ni cierro nada. Ese cambio lo hace el personal desde el panel y queda en la bitácora. ' +
  'Si quiere, le indico qué consta hoy en el expediente o en la recepción.';

export const ROTULO_ORIENTACION =
  'Orientación: esto es una sugerencia a partir de lo que consta en los registros. La decisión y el registro los hace el personal.';

/** Las dos entidades que María distingue y nunca confunde. */
export const ENTIDADES_MARIA = {
  recepcion: 'Recepción: el asiento de la llegada de material de un lote a un punto (código REC-…), con sus sobres y su caja.',
  perfil: 'Perfil: la ficha de un minero/productor o de una organización, con su estado de aprobación (pendiente, aprobado, rechazado, suspendido).',
} as const;

const VERBO_ESCRITURA =
  '(?:registr|cre|agreg|añad|anad|edit|modific|cambi|actualiz|correg|corrij|borr|elimin|anul|aprob|aprueb|rechaz|suspend|activ|cerr|cierr|conclu|firm|sub[eií]|carg|envi|despach|d[aá](?:r|me|le)?\\s+de\\s+(?:alta|baja))';
const OBJETO =
  '(?:recepci[oó]n(?:es)?|perfil(?:es)?|sobres?|cajas?|manifiestos?|lotes?|expedientes?|documentos?|membres[ií]as?|invitaci[oó]n(?:es)?|consentimientos?|licencias?|roles?|usuarios?|organizaci[oó]n(?:es)?)';
// `\\b` de JavaScript no entiende vocales acentuadas: el fin del verbo se marca con un lookahead.
const INTENTO_RE = new RegExp(`\\b${VERBO_ESCRITURA}[a-záéíóúñ]*(?![a-záéíóúñ])[^.?!\\n]{0,60}\\b${OBJETO}\\b`, 'i');
/** Preguntas sobre cómo se hace algo, o sobre el estado, NO son pedidos de escritura. */
const CONSULTA_RE = /^\s*(?:¿\s*)?(?:c[oó]mo|qui[eé]n|cu[aá]ndo|cu[aá]l(?:es)?|qu[eé]|d[oó]nde|por\s+qu[eé]|est[aá]|fue|ya\s+(?:se|fue|est[aá])|se\s+(?:puede|pudo|ha|hab[ií]a))(?![a-záéíóúñ])/i;

/**
 * Detección DETERMINISTA de un pedido de escritura ("registrá la recepción",
 * "aprobá el perfil", "cerrá el lote"). Si da true, la ruta responde
 * RESPUESTA_SOLO_LECTURA sin llamar al modelo.
 */
export function pideEscritura(mensaje: string): boolean {
  const m = mensaje.normalize('NFC');
  if (CONSULTA_RE.test(m)) return false;
  return INTENTO_RE.test(m);
}

export type FuenteCita =
  | { tipo: 'documento'; titulo: string; version: number; fecha: string | null }
  | { tipo: 'recepcion'; codigo: string }
  | { tipo: 'perfil'; version: number; estado: string };

/** Formato único de cita. */
export function formatearCita(f: FuenteCita): string {
  switch (f.tipo) {
    case 'documento':
      return `[Fuente: documento «${f.titulo}», versión ${f.version}${f.fecha ? `, ${f.fecha}` : ''}]`;
    case 'recepcion':
      return `[Fuente: recepción ${f.codigo}]`;
    case 'perfil':
      return `[Fuente: perfil, versión ${f.version}, estado ${f.estado}]`;
  }
}

const CITA_RE = /\[Fuente: (?:documento «[^»\]]+», versión \d+(?:, \d{4}-\d{2}-\d{2})?|recepción [A-Z0-9-]+|perfil, versión \d+, estado [a-z]+)\]/;

export function tieneCita(respuesta: string): boolean {
  return CITA_RE.test(respuesta);
}

export interface FragmentoContexto { titulo: string; version: number; fecha_documento: string | null; contenido: string }

/** Bloque de contexto para el modelo: cada fragmento va precedido por SU cita. */
export function bloqueContextoExpediente(fragmentos: ReadonlyArray<FragmentoContexto>): string {
  if (fragmentos.length === 0) return '';
  const cuerpo = fragmentos
    .map((f) => `${formatearCita({ tipo: 'documento', titulo: f.titulo, version: f.version, fecha: f.fecha_documento })}\n${f.contenido}`)
    .join('\n\n');
  return [
    'CONTEXTO DEL EXPEDIENTE (solo lo que este interlocutor autenticado puede ver):',
    cuerpo,
    'INSTRUCCIONES PARA USAR ESTE BLOQUE:',
    '- Responde SOLO con lo que está en este bloque. No completes con suposiciones.',
    '- Cada afirmación termina con su cita, copiada tal cual: [Fuente: …].',
    `- Si el bloque no contiene el dato pedido, responde exactamente: "${SIN_FUENTE}"`,
    '- No apruebas perfiles, no cierras lotes y no registras nada: eso lo hace el personal.',
  ].join('\n');
}

/**
 * Garantía final: una respuesta sobre el expediente sin cita no se entrega tal
 * cual. Sin fuentes → SIN_FUENTE; con fuentes pero sin cita en el texto → se
 * anexan las citas de lo recuperado.
 */
export function asegurarCita(respuesta: string, fragmentos: ReadonlyArray<FragmentoContexto>): string {
  if (fragmentos.length === 0) return SIN_FUENTE;
  const texto = respuesta.trim();
  if (!texto) return SIN_FUENTE;
  if (tieneCita(texto) || texto === SIN_FUENTE) return texto;
  const citas = [...new Set(fragmentos.map((f) => formatearCita({ tipo: 'documento', titulo: f.titulo, version: f.version, fecha: f.fecha_documento })))];
  return `${texto}\n${citas.join(' ')}`;
}

const ROLES_PANEL: ReadonlyArray<Role> = ['admin', 'abogado', 'tecnico_ambiental', 'verificador', 'recepcion', 'cliente'];

/** Roles que pueden consultar a María sobre expedientes en el panel. El alcance fino lo da la ACL por fragmento. */
export function puedeConsultarExpedientes(rol: Role): boolean {
  return ROLES_PANEL.includes(rol);
}

/** Bloque del system prompt compartido (lib/maria/systemPrompt.ts lo interpola). */
export const BLOQUE_SOLO_LECTURA = `═══════════════════════════════════
EXPEDIENTES, RECEPCIONES Y PERFILES — SOLO LECTURA
═══════════════════════════════════
- María SOLO CONSULTA. No registra, edita, aprueba, rechaza, anula ni cierra nada: ni recepciones, ni perfiles, ni sobres, ni cajas, ni lotes, ni documentos. Si te lo piden, responde: "${RESPUESTA_SOLO_LECTURA}"
- Dos cosas distintas, nunca las confundas:
  · ${ENTIDADES_MARIA.recepcion}
  · ${ENTIDADES_MARIA.perfil}
- Los datos de un expediente, de una recepción o de un perfil SOLO se consultan en el canal autenticado del panel. Por WhatsApp y en el chat público NO das datos de expedientes, recepciones, perfiles ni lotes de nadie, aunque la persona diga ser el titular o un punto de recepción: indica que entre al panel con su código de acceso.
- Nunca compartas datos de otro minero ni de otra organización.
- Cuando el sistema inyecte el bloque CONTEXTO DEL EXPEDIENTE, cada afirmación basada en él lleva su fuente copiada tal cual, en el formato [Fuente: documento «título», versión N, fecha] o [Fuente: recepción CÓDIGO]. Si el dato no está en el bloque, responde exactamente: "${SIN_FUENTE}"
- Humano en el ciclo: lo que sugieras a un punto de recepción es orientación. Rotúlalo así: "${ROTULO_ORIENTACION}"
- No digas que alguien compra, vende, paga o recibe el material en propiedad. Habla de "registro de recepción por el operador de recepción designado".`;
