// lib/precio/xlsxMinimo.ts
// ---------------------------------------------------------------------------
// Lector XLSX mínimo, sin dependencias: lo justo para leer la PRIMERA hoja de
// los archivos que publica el Banco Central de Honduras (series diarias del
// tipo de cambio) y devolver filas de celdas (número o texto).
//
// Un .xlsx es un ZIP con XML. Se implementa aquí: lectura del directorio
// central del ZIP, descompresión DEFLATE (node:zlib) y un parseo acotado de
// `xl/sharedStrings.xml` y `xl/worksheets/sheetN.xml`. No se evalúan fórmulas
// (se usa el valor cacheado `<v>`), no se leen estilos ni otras hojas.
// Cualquier estructura inesperada produce un error claro, nunca un valor
// adivinado. Server-only (node:zlib).
// ---------------------------------------------------------------------------

import { inflateRawSync } from 'node:zlib';

export type CeldaXlsx = number | string | null;

const FIRMA_FIN_DIRECTORIO = 0x06054b50;
const FIRMA_ENTRADA_CENTRAL = 0x02014b50;
const FIRMA_CABECERA_LOCAL = 0x04034b50;

/** `true` si los bytes empiezan con la firma ZIP ("PK\x03\x04"). */
export function pareceXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Tope de salida de DEFLATE. Un Excel del BCH cabe holgadamente; por encima, se rechaza. */
const XLSX_MAX_SALIDA_BYTES = 10 * 1024 * 1024;

/**
 * Lee todas las entradas del ZIP (nombre → bytes descomprimidos).
 * Devuelve null si DEFLATE falla o supera el tope: el llamador no inventa
 * celdas y deja actuar el respaldo del tipo de cambio.
 */
export function leerEntradasZip(bytes: Uint8Array): Map<string, Uint8Array> | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Fin del directorio central: buscar hacia atrás (el comentario del ZIP es variable).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (dv.getUint32(i, true) === FIRMA_FIN_DIRECTORIO) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('xlsx: no se encontró el directorio central del ZIP');
  const total = dv.getUint16(eocd + 10, true);
  const offsetDir = dv.getUint32(eocd + 16, true);

  const entradas = new Map<string, Uint8Array>();
  let p = offsetDir;
  const decoder = new TextDecoder('utf-8');
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== FIRMA_ENTRADA_CENTRAL) throw new Error('xlsx: entrada del directorio central corrupta');
    const metodo = dv.getUint16(p + 10, true);
    const tamComprimido = dv.getUint32(p + 20, true);
    const tamOriginal = dv.getUint32(p + 24, true);
    const lenNombre = dv.getUint16(p + 28, true);
    const lenExtra = dv.getUint16(p + 30, true);
    const lenComentario = dv.getUint16(p + 32, true);
    const offsetLocal = dv.getUint32(p + 42, true);
    const nombre = decoder.decode(bytes.subarray(p + 46, p + 46 + lenNombre));
    p += 46 + lenNombre + lenExtra + lenComentario;

    if (dv.getUint32(offsetLocal, true) !== FIRMA_CABECERA_LOCAL) throw new Error(`xlsx: cabecera local corrupta (${nombre})`);
    const lenNombreLocal = dv.getUint16(offsetLocal + 26, true);
    const lenExtraLocal = dv.getUint16(offsetLocal + 28, true);
    const inicio = offsetLocal + 30 + lenNombreLocal + lenExtraLocal;
    const datos = bytes.subarray(inicio, inicio + tamComprimido);
    let contenido: Uint8Array;
    if (metodo === 0) contenido = datos;
    else if (metodo === 8) {
      try {
        contenido = new Uint8Array(inflateRawSync(datos, { maxOutputLength: XLSX_MAX_SALIDA_BYTES }));
      } catch {
        return null;
      }
    } else throw new Error(`xlsx: método de compresión no soportado (${metodo}) en ${nombre}`);
    if (tamOriginal && contenido.length !== tamOriginal) {
      throw new Error(`xlsx: tamaño inesperado al descomprimir ${nombre}`);
    }
    entradas.set(nombre, contenido);
  }
  return entradas;
}

function desescaparXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

function textoDe(xmlFragmento: string): string {
  // Concatena todos los <t>…</t> (texto simple o runs enriquecidos).
  const partes = [...xmlFragmento.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescaparXml(m[1]));
  return partes.join('');
}

function leerSharedStrings(entradas: Map<string, Uint8Array>): string[] {
  const raw = entradas.get('xl/sharedStrings.xml');
  if (!raw) return [];
  const xml = new TextDecoder('utf-8').decode(raw);
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
}

/** Convierte "AB" → índice de columna base 0 (A=0, B=1, …, AA=26). */
export function columnaAIndice(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Devuelve las filas de la primera hoja como arreglos de celdas (índice =
 * columna). Celdas vacías → null. Números → number; texto (compartido o
 * inline) → string. Fórmulas: se usa el valor cacheado.
 */
export function leerPrimeraHoja(bytes: Uint8Array): CeldaXlsx[][] | null {
  if (!pareceXlsx(bytes)) throw new Error('xlsx: el contenido no es un archivo ZIP/XLSX');
  const entradas = leerEntradasZip(bytes);
  if (!entradas) return null;
  const nombreHoja = [...entradas.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!nombreHoja) throw new Error('xlsx: el archivo no contiene hojas');
  const shared = leerSharedStrings(entradas);
  const xml = new TextDecoder('utf-8').decode(entradas.get(nombreHoja)!);

  const filas: CeldaXlsx[][] = [];
  for (const fila of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const celdas: CeldaXlsx[] = [];
    for (const c of fila[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const cuerpo = c[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+)\d+"/);
      if (!ref) continue;
      const idx = columnaAIndice(ref[1]);
      const tipo = attrs.match(/\bt="(\w+)"/)?.[1] ?? 'n';
      let valor: CeldaXlsx = null;
      if (tipo === 'inlineStr') {
        valor = textoDe(cuerpo);
      } else {
        const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (v != null) {
          if (tipo === 's') valor = shared[Number(v)] ?? null;
          else if (tipo === 'str' || tipo === 'e') valor = desescaparXml(v);
          else if (tipo === 'b') valor = v === '1' ? 'TRUE' : 'FALSE';
          else {
            const n = Number(v);
            valor = Number.isFinite(n) ? n : desescaparXml(v);
          }
        }
      }
      while (celdas.length < idx) celdas.push(null);
      celdas[idx] = valor;
    }
    filas.push(celdas);
  }
  return filas;
}

const EXCEL_EPOCA_UTC = Date.UTC(1899, 11, 30);

/** Número de serie de fecha de Excel (sistema 1900) → "YYYY-MM-DD". */
export function serialExcelAFecha(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const ms = EXCEL_EPOCA_UTC + Math.floor(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
