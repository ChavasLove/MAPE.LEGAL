// Validación server-side del registro de Certificados de Origen
// (POST/PATCH /api/certificados). Server-only por el import de hash.ts
// (node:crypto). Whitelist cerrada de campos — nada del body llega a la BD sin
// pasar por aquí (invariante PR #159 §Auditoría: whitelist + CHECKs espejo).
//
// La plataforma NO emite el documento oficial: el POST registra lo que el
// titular emitió y la autoridad autenticó, y asienta el sello complementario.

import { sha256Hex } from '@/lib/certificados/hash';
import {
  CERTIFICADO_ESTADOS,
  COPIA_MINERO_ESTADOS,
  EMISOR_TITULAR_TIPOS,
  isSha256Hex,
  isStoragePathSafe,
  type CertificadoEstado,
  type CopiaMineroEstado,
  type EmisorTitularTipo,
} from '@/lib/certificados/sello';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Números de certificado/sello/folio/documento oficial: cortos, sin espacios
// raros, sin caracteres que compliquen la URL del QR.
const NUMERO_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,63}$/;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function optStr(v: unknown, max: number, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new Error(`${label} debe ser texto.`);
  const t = v.trim();
  if (t.length > max) throw new Error(`${label} supera ${max} caracteres.`);
  return t.length === 0 ? null : t;
}

function reqStr(v: unknown, max: number, label: string): string {
  const s = optStr(v, max, label);
  if (!s) throw new Error(`${label} es obligatorio.`);
  return s;
}

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function optDate(v: unknown, label: string): string | null | undefined {
  const s = optStr(v, 10, label);
  if (s === undefined || s === null) return s;
  if (!isValidDate(s)) throw new Error(`${label} debe tener formato YYYY-MM-DD.`);
  return s;
}

function reqDate(v: unknown, label: string): string {
  const s = optDate(v, label);
  if (!s) throw new Error(`${label} es obligatoria.`);
  return s;
}

function optNumero(v: unknown, label: string): string | null | undefined {
  const s = optStr(v, 64, label);
  if (s === undefined || s === null) return s;
  if (!NUMERO_RE.test(s)) throw new Error(`${label} tiene caracteres no permitidos.`);
  return s;
}

function optEnum<T extends string>(v: unknown, allowed: readonly T[], label: string): T | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new Error(`${label} inválido.`);
  }
  return v as T;
}

function optHash(v: unknown, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = typeof v === 'string' ? v.trim().toLowerCase() : v;
  if (!isSha256Hex(s)) throw new Error(`${label} debe ser SHA-256 en hex (64 caracteres).`);
  return s;
}

function optPath(v: unknown, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (!isStoragePathSafe(v)) {
    throw new Error(`${label} debe ser una ruta relativa corta sin "..", sin esquema ni barra inicial.`);
  }
  return (v as string).trim();
}

function optNum(v: unknown, label: string, opts: { min?: number; max?: number; gt?: number }): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${label} debe ser numérico.`);
  if (opts.gt !== undefined && !(n > opts.gt)) throw new Error(`${label} debe ser mayor que ${opts.gt}.`);
  if (opts.min !== undefined && n < opts.min) throw new Error(`${label} fuera de rango.`);
  if (opts.max !== undefined && n > opts.max) throw new Error(`${label} fuera de rango.`);
  return n;
}

function optUuid(v: unknown, label: string): string | null | undefined {
  const s = optStr(v, 36, label);
  if (s === undefined || s === null) return s;
  if (!UUID_RE.test(s)) throw new Error(`${label} no es un UUID válido.`);
  return s;
}

/** Payload validado para INSERT. Nunca contiene registrado_por/qr_url/hash_verificacion — los estampa la ruta. */
export interface CertificadoCreateData {
  numero_certificado: string;
  numero_sello: string;
  mina_id: string;
  expediente_id: string | null;
  fecha_emision: string;
  peso_oro_g: number;
  ley_oro_kt: number | null;
  estado: CertificadoEstado;
  valido_hasta: string;
  notas: string | null;
  // Documento oficial
  emisor_titular: string;
  emisor_titular_tipo: EmisorTitularTipo | null;
  autoridad_autentica: string;
  autoridad_autentica_fecha: string | null;
  numero_documento_oficial: string;
  escaneo_documento_oficial_path: string | null;
  escaneo_documento_oficial_hash_sha256: string | null;
  // Sello
  folio_talonario: string | null;
  ejemplar_sello_escaneo_path: string | null;
  hash_sha256: string | null;
  // Copia al minero
  copia_minero_estado: CopiaMineroEstado;
  copia_minero_fecha: string | null;
  copia_minero_constancia_path: string | null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function validateCreate(body: unknown): ValidationResult<CertificadoCreateData> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  try {
    // numero_certificado y numero_sello comparten serie (backfill 042): se acepta
    // cualquiera de los dos; si llega uno solo, el otro lo copia.
    const nc = optNumero(body.numero_certificado, 'numero_certificado') ?? null;
    const ns = optNumero(body.numero_sello, 'numero_sello') ?? null;
    const numero_certificado = nc ?? ns;
    const numero_sello = ns ?? nc;
    if (!numero_certificado || !numero_sello) {
      throw new Error('numero_certificado (o numero_sello) es obligatorio.');
    }

    const mina_id = optUuid(body.mina_id, 'mina_id');
    if (!mina_id) throw new Error('mina_id es obligatorio.');

    const fecha_emision = reqDate(body.fecha_emision, 'fecha_emision');
    const valido_hasta = optDate(body.valido_hasta, 'valido_hasta') ?? addDays(fecha_emision, 365);
    if (valido_hasta < fecha_emision) throw new Error('valido_hasta no puede ser anterior a fecha_emision.');

    const peso_oro_g = optNum(body.peso_oro_g, 'peso_oro_g', { gt: 0, max: 999_999_999 });
    if (peso_oro_g == null) throw new Error('peso_oro_g es obligatorio.');

    const autoridad_autentica_fecha = optDate(body.autoridad_autentica_fecha, 'autoridad_autentica_fecha') ?? null;
    if (autoridad_autentica_fecha && autoridad_autentica_fecha < fecha_emision) {
      throw new Error('autoridad_autentica_fecha no puede ser anterior a fecha_emision.');
    }

    const copia_minero_estado = optEnum(body.copia_minero_estado, COPIA_MINERO_ESTADOS, 'copia_minero_estado') ?? 'pendiente';
    const copia_minero_fecha = optDate(body.copia_minero_fecha, 'copia_minero_fecha') ?? null;
    if (copia_minero_estado !== 'pendiente' && !copia_minero_fecha) {
      throw new Error('copia_minero_fecha es obligatoria cuando la copia ya fue entregada.');
    }

    const data: CertificadoCreateData = {
      numero_certificado,
      numero_sello,
      mina_id,
      expediente_id: optUuid(body.expediente_id, 'expediente_id') ?? null,
      fecha_emision,
      peso_oro_g,
      ley_oro_kt: optNum(body.ley_oro_kt, 'ley_oro_kt', { gt: 0, max: 24 }) ?? null,
      estado: optEnum(body.estado, CERTIFICADO_ESTADOS, 'estado') ?? 'vigente',
      valido_hasta,
      notas: optStr(body.notas, 2000, 'notas') ?? null,
      emisor_titular: reqStr(body.emisor_titular, 200, 'emisor_titular'),
      emisor_titular_tipo: optEnum(body.emisor_titular_tipo, EMISOR_TITULAR_TIPOS, 'emisor_titular_tipo') ?? null,
      autoridad_autentica: reqStr(body.autoridad_autentica, 200, 'autoridad_autentica'),
      autoridad_autentica_fecha,
      numero_documento_oficial: reqStr(body.numero_documento_oficial, 64, 'numero_documento_oficial'),
      escaneo_documento_oficial_path: optPath(body.escaneo_documento_oficial_path, 'escaneo_documento_oficial_path') ?? null,
      escaneo_documento_oficial_hash_sha256: optHash(body.escaneo_documento_oficial_hash_sha256, 'escaneo_documento_oficial_hash_sha256') ?? null,
      folio_talonario: optNumero(body.folio_talonario, 'folio_talonario') ?? null,
      ejemplar_sello_escaneo_path: optPath(body.ejemplar_sello_escaneo_path, 'ejemplar_sello_escaneo_path') ?? null,
      hash_sha256: optHash(body.hash_sha256, 'hash_sha256') ?? null,
      copia_minero_estado,
      copia_minero_fecha,
      copia_minero_constancia_path: optPath(body.copia_minero_constancia_path, 'copia_minero_constancia_path') ?? null,
    };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Campos editables por PATCH. Deliberadamente EXCLUIDOS (inmutables tras el
 * asiento): numero_certificado, numero_sello, mina_id, peso_oro_g,
 * fecha_emision, hash_verificacion, qr_url (derivado), registrado_por,
 * emitido_por (legacy). Los dos hashes solo admiten el primer llenado
 * (NULL → valor); el trigger trg_certificados_hash_inmutable rechaza el resto.
 */
export const CERTIFICADO_PATCH_FIELDS = [
  'estado', 'valido_hasta', 'ley_oro_kt', 'notas', 'expediente_id',
  'emisor_titular', 'emisor_titular_tipo', 'autoridad_autentica', 'autoridad_autentica_fecha',
  'numero_documento_oficial', 'escaneo_documento_oficial_path', 'escaneo_documento_oficial_hash_sha256',
  'folio_talonario', 'ejemplar_sello_escaneo_path', 'hash_sha256',
  'copia_minero_estado', 'copia_minero_fecha', 'copia_minero_constancia_path',
] as const;

export type CertificadoPatchData = Partial<Record<(typeof CERTIFICADO_PATCH_FIELDS)[number], unknown>>;

export function validatePatch(body: unknown): ValidationResult<CertificadoPatchData> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  const out: Record<string, unknown> = {};
  try {
    for (const key of Object.keys(body)) {
      if (!(CERTIFICADO_PATCH_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`Campo no editable: ${key}.`);
      }
    }
    const b = body as Record<string, unknown>;
    const put = (k: string, v: unknown) => { if (v !== undefined) out[k] = v; };

    put('estado', optEnum(b.estado, CERTIFICADO_ESTADOS, 'estado'));
    put('valido_hasta', optDate(b.valido_hasta, 'valido_hasta'));
    put('ley_oro_kt', optNum(b.ley_oro_kt, 'ley_oro_kt', { gt: 0, max: 24 }));
    put('notas', optStr(b.notas, 2000, 'notas'));
    put('expediente_id', optUuid(b.expediente_id, 'expediente_id'));
    put('emisor_titular', optStr(b.emisor_titular, 200, 'emisor_titular'));
    put('emisor_titular_tipo', optEnum(b.emisor_titular_tipo, EMISOR_TITULAR_TIPOS, 'emisor_titular_tipo'));
    put('autoridad_autentica', optStr(b.autoridad_autentica, 200, 'autoridad_autentica'));
    put('autoridad_autentica_fecha', optDate(b.autoridad_autentica_fecha, 'autoridad_autentica_fecha'));
    put('numero_documento_oficial', optStr(b.numero_documento_oficial, 64, 'numero_documento_oficial'));
    put('escaneo_documento_oficial_path', optPath(b.escaneo_documento_oficial_path, 'escaneo_documento_oficial_path'));
    put('escaneo_documento_oficial_hash_sha256', optHash(b.escaneo_documento_oficial_hash_sha256, 'escaneo_documento_oficial_hash_sha256'));
    put('folio_talonario', optNumero(b.folio_talonario, 'folio_talonario'));
    put('ejemplar_sello_escaneo_path', optPath(b.ejemplar_sello_escaneo_path, 'ejemplar_sello_escaneo_path'));
    put('hash_sha256', optHash(b.hash_sha256, 'hash_sha256'));
    put('copia_minero_estado', optEnum(b.copia_minero_estado, COPIA_MINERO_ESTADOS, 'copia_minero_estado'));
    put('copia_minero_fecha', optDate(b.copia_minero_fecha, 'copia_minero_fecha'));
    put('copia_minero_constancia_path', optPath(b.copia_minero_constancia_path, 'copia_minero_constancia_path'));

    // Los campos obligatorios del documento oficial no pueden vaciarse por PATCH.
    for (const k of ['emisor_titular', 'autoridad_autentica', 'numero_documento_oficial'] as const) {
      if (k in out && out[k] === null) throw new Error(`${k} no puede quedar vacío.`);
    }
    if (Object.keys(out).length === 0) throw new Error('Nada que actualizar.');
    return { ok: true, data: out as CertificadoPatchData };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * hash_verificacion (020, NOT NULL): huella del cuerpo canónico del ASIENTO.
 * Formato PROVISIONAL hasta que la Fase 2B fije el cuerpo canónico definitivo —
 * se documenta en docs/certificado-oficial-y-sello.md. No incluye datos
 * personales (el nombre del titular queda fuera a propósito).
 */
export function buildHashVerificacion(d: Pick<CertificadoCreateData,
  'numero_certificado' | 'mina_id' | 'fecha_emision' | 'peso_oro_g' | 'numero_documento_oficial'>): string {
  const cuerpo = [
    'mape.legal/certificado-origen/v0',
    d.numero_certificado,
    d.mina_id,
    d.fecha_emision,
    d.peso_oro_g.toFixed(3),
    d.numero_documento_oficial,
  ].join('|');
  return sha256Hex(cuerpo);
}
