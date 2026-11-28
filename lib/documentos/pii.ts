// lib/documentos/pii.ts — enmascarado de datos personales ANTES de indexar un
// documento. PURO. El índice de consulta no necesita números de identidad,
// cuentas bancarias, teléfonos ni correos para responder sobre el estado de un
// expediente: se sustituyen por una marca. El documento original no se altera
// (queda en el respaldo, con su control de acceso).

export const CAMPOS_ENMASCARADOS = ['identidad', 'rtn', 'cuenta', 'telefono', 'correo'] as const;
export type CampoEnmascarado = (typeof CAMPOS_ENMASCARADOS)[number];

const MARCA: Record<CampoEnmascarado, string> = {
  identidad: '[IDENTIDAD OMITIDA]',
  rtn: '[RTN OMITIDO]',
  cuenta: '[CUENTA OMITIDA]',
  telefono: '[TELÉFONO OMITIDO]',
  correo: '[CORREO OMITIDO]',
};

// El orden importa: de lo más específico a lo más general.
const PATRONES: Array<{ campo: CampoEnmascarado; re: RegExp }> = [
  { campo: 'correo', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Cuenta bancaria (va ANTES que RTN e identidad: una cuenta puede tener su misma forma): precedida por la palabra, 8 a 20 dígitos con separadores.
  { campo: 'cuenta', re: /(?<=\b(?:cuenta|cta\.?|iban|n[úu]mero de cuenta)\b[^\d\n]{0,25})\d[\d -]{6,22}\d/gi },
  // RTN hondureño: 14 dígitos (con o sin guiones 4-4-6).
  { campo: 'rtn', re: /(?<!\d)\d{4}[- ]?\d{4}[- ]?\d{6}(?!\d)/g },
  // Documento de identidad: 13 dígitos (con o sin guiones 4-4-5).
  { campo: 'identidad', re: /(?<!\d)\d{4}[- ]?\d{4}[- ]?\d{5}(?!\d)/g },
  // Teléfono: +504 opcional y 8 dígitos (con o sin guion o espacio al medio).
  { campo: 'telefono', re: /(?<![\w-])(?:\+?504[ -]?)?[2389]\d{3}[ -]?\d{4}(?![\w-]*\d)/g },
];

export interface ResultadoEnmascarado {
  texto: string;
  /** Cuántas sustituciones se hicieron por tipo de dato (para la bitácora de ingesta; sin los valores). */
  omitidos: Record<CampoEnmascarado, number>;
}

export function enmascararPII(texto: string): ResultadoEnmascarado {
  const omitidos: Record<CampoEnmascarado, number> = { identidad: 0, rtn: 0, cuenta: 0, telefono: 0, correo: 0 };
  let out = texto;
  for (const { campo, re } of PATRONES) {
    out = out.replace(re, () => { omitidos[campo]++; return MARCA[campo]; });
  }
  return { texto: out, omitidos };
}

/** true si el texto todavía contiene algo con forma de dato personal. */
export function contienePII(texto: string): boolean {
  return PATRONES.some(({ re }) => new RegExp(re.source, re.flags.replace('g', '')).test(texto));
}
