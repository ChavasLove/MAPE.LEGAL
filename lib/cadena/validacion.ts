// lib/cadena/validacion.ts — validadores PUROS de los cuerpos que reciben las
// rutas /api/cadena/* (sin Supabase, sin Next). Cada validador devuelve un
// resultado discriminado para que la ruta responda 400 con el mensaje exacto;
// ningún campo del body llega a la BD sin pasar por aquí (invariante PR #159:
// whitelist cerrada + validaciones espejo de los CHECK de la migración 043).
//
// También vive aquí la matriz "qué tipos de evento puede registrar cada rol"
// (regla del estándar: el comercializador NUNCA registra fundición — ni
// siquiera llega al trigger; la planta no registra eventos de origen/acopio).

import {
  ALCANCES_CONSENTIMIENTO,
  ESTADOS_CLPI,
  MEDIOS_PAGO,
  TIPOS_EVENTO,
  TIPOS_ORGANIZACION,
  type AlcanceConsentimiento,
  type EstadoClpi,
  type TipoEvento,
  type TipoOrganizacion,
} from './types';
import { isSha256Hex, isStoragePathSafe } from '@/lib/certificados/sello';

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

/* ── Primitivas ─────────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Código de lote: LOTE-YYYY-NNNN (generado) o uno externo corto sin espacios.
const CODIGO_LOTE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/]{2,63}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** YYYY-MM-DD real (rechaza 2026-02-30). */
export function isFechaYmd(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Invalido extends Error {}

function optStr(v: unknown, max: number, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new Invalido(`${label} debe ser texto.`);
  const t = v.trim();
  if (t.length > max) throw new Invalido(`${label} supera ${max} caracteres.`);
  return t.length === 0 ? null : t;
}

function reqStr(v: unknown, max: number, label: string): string {
  const s = optStr(v, max, label);
  if (!s) throw new Invalido(`${label} es obligatorio.`);
  return s;
}

function optBool(v: unknown, label: string): boolean | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'boolean') throw new Invalido(`${label} debe ser true/false.`);
  return v;
}

function optDate(v: unknown, label: string): string | null | undefined {
  const s = optStr(v, 10, label);
  if (s === undefined || s === null) return s;
  if (!isFechaYmd(s)) throw new Invalido(`${label} debe tener formato YYYY-MM-DD.`);
  return s;
}

function reqUuid(v: unknown, label: string): string {
  if (!isUuid(v)) throw new Invalido(`${label} inválido (uuid).`);
  return v;
}

function optUuid(v: unknown, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return reqUuid(v, label);
}

/** Número finito; acepta string numérica (los forms mandan texto). */
function optNum(v: unknown, label: string, opts: { min?: number; max?: number } = {}): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Invalido(`${label} debe ser numérico.`);
  if (opts.min !== undefined && n < opts.min) throw new Invalido(`${label} debe ser ≥ ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new Invalido(`${label} debe ser ≤ ${opts.max}.`);
  return n;
}

function envolver<T>(fn: () => T): Resultado<T> {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    if (e instanceof Invalido) return { ok: false, error: e.message };
    throw e;
  }
}

/* ── Matriz rol × tipo de evento ────────────────────────────────────────── */

const EVENTOS_COMERCIALIZADOR: ReadonlyArray<TipoEvento> = ['origen_mina', 'acopio', 'transporte', 'correccion', 'nota'];
const EVENTOS_PLANTA: ReadonlyArray<TipoEvento> = ['recepcion_planta', 'laboratorio', 'fundicion', 'refinado', 'nota'];

/**
 * Tipos de evento que un rol puede registrar en un lote PROPIO. `admin`
 * (CHT) puede registrar cualquiera (corrección documentada). Los demás roles
 * (abogado, tecnico_ambiental, auditor, cliente) no registran eventos.
 */
export function tiposEventoPermitidos(rol: string): ReadonlyArray<TipoEvento> {
  if (rol === 'admin') return TIPOS_EVENTO;
  if (rol === 'comercializador') return EVENTOS_COMERCIALIZADOR;
  if (rol === 'planta') return EVENTOS_PLANTA;
  return [];
}

export function puedeRegistrarTipoEvento(rol: string, tipo: string): boolean {
  return (tiposEventoPermitidos(rol) as ReadonlyArray<string>).includes(tipo);
}

/* ── Evento ─────────────────────────────────────────────────────────────── */

export interface EventoBody {
  tipo: TipoEvento;
  fecha: string;              // ISO timestamptz
  lugar: string | null;
  peso_g: number | null;
  ley_fino: number | null;    // fracción 0–1
  detalle: Record<string, unknown>;
}

export type ResultadoEvento =
  | { ok: true; data: EventoBody }
  | { ok: false; status: 400 | 403; error: string };

/**
 * Valida el body de POST /lotes/[id]/eventos. 403 cuando el tipo existe pero
 * el rol no puede registrarlo (p. ej. comercializador + fundicion); 400 ante
 * tipo desconocido o campos fuera de rango.
 */
export function validarBodyEvento(body: unknown, rol: string, ahora: Date = new Date()): ResultadoEvento {
  if (!isObj(body)) return { ok: false, status: 400, error: 'Cuerpo inválido.' };
  const tipo = typeof body.tipo === 'string' ? body.tipo.trim() : '';
  if (!(TIPOS_EVENTO as ReadonlyArray<string>).includes(tipo)) {
    return { ok: false, status: 400, error: `tipo inválido. Permitidos: ${TIPOS_EVENTO.join(', ')}` };
  }
  if (!puedeRegistrarTipoEvento(rol, tipo)) {
    return { ok: false, status: 403, error: `El rol ${rol} no puede registrar eventos de tipo ${tipo}.` };
  }
  try {
    let fecha: string;
    if (body.fecha === undefined || body.fecha === null || body.fecha === '') {
      fecha = ahora.toISOString();
    } else {
      if (typeof body.fecha !== 'string') throw new Invalido('fecha debe ser texto ISO.');
      const d = new Date(body.fecha);
      if (Number.isNaN(d.getTime())) throw new Invalido('fecha inválida (ISO 8601).');
      // Tolerancia de reloj: no se aceptan eventos "del futuro" (más de 5 min).
      if (d.getTime() > ahora.getTime() + 5 * 60_000) throw new Invalido('fecha no puede ser futura.');
      fecha = d.toISOString();
    }
    const lugar = optStr(body.lugar, 200, 'lugar') ?? null;
    const peso_g = optNum(body.peso_g, 'peso_g', { min: 0, max: 99_999_999_999 }) ?? null;
    const ley_fino = optNum(body.ley_fino, 'ley_fino', { min: 0, max: 1 }) ?? null;
    let detalle: Record<string, unknown> = {};
    if (body.detalle !== undefined && body.detalle !== null) {
      if (!isObj(body.detalle)) throw new Invalido('detalle debe ser un objeto JSON.');
      if (JSON.stringify(body.detalle).length > 20_000) throw new Invalido('detalle supera 20 000 caracteres.');
      detalle = body.detalle;
    }
    return { ok: true, data: { tipo: tipo as TipoEvento, fecha, lugar, peso_g, ley_fino, detalle } };
  } catch (e) {
    if (e instanceof Invalido) return { ok: false, status: 400, error: e.message };
    throw e;
  }
}

/* ── Pago ───────────────────────────────────────────────────────────────── */

export interface PagoBody {
  medio: string;                 // crudo: la regla de negocio la aplica validarPago()/el RPC
  referencia_bancaria: string;   // crudo (puede venir vacío: el RPC bloquea el lote)
  monto_lps: number;
  banco: string | null;
  fecha_pago: string;            // YYYY-MM-DD
}

/**
 * Valida FORMA del body de POST /lotes/[id]/pagos. Deliberadamente NO rechaza
 * medio/referencia inválidos: eso es regla de negocio (validarPago en
 * lib/cadena/reglas.ts) y el RPC `registrar_pago_lote` debe recibir el intento
 * para BLOQUEAR el lote. Aquí solo se exige que los campos existan con el tipo
 * correcto y que monto/fecha sean sanos.
 */
export function validarBodyPago(body: unknown): Resultado<PagoBody> {
  return envolver(() => {
    if (!isObj(body)) throw new Invalido('Cuerpo inválido.');
    const medio = typeof body.medio === 'string' ? body.medio.trim().toLowerCase() : '';
    if (medio.length === 0) throw new Invalido(`medio es obligatorio. Admitidos: ${MEDIOS_PAGO.join(', ')}`);
    if (medio.length > 40) throw new Invalido('medio supera 40 caracteres.');
    const referencia_bancaria = typeof body.referencia_bancaria === 'string' ? body.referencia_bancaria.trim() : '';
    if (referencia_bancaria.length > 120) throw new Invalido('referencia_bancaria supera 120 caracteres.');
    const monto = optNum(body.monto_lps, 'monto_lps', { min: 0 });
    if (monto === undefined || monto === null || monto <= 0) throw new Invalido('monto_lps debe ser un número mayor que 0.');
    const banco = optStr(body.banco, 120, 'banco') ?? null;
    const fecha_pago = optDate(body.fecha_pago, 'fecha_pago');
    if (!fecha_pago) throw new Invalido('fecha_pago es obligatoria (YYYY-MM-DD).');
    return { medio, referencia_bancaria, monto_lps: monto, banco, fecha_pago };
  });
}

/* ── Fuente ─────────────────────────────────────────────────────────────── */

export interface FuenteBody {
  organizacion_id?: string;      // solo admin lo manda; el comercializador usa la suya
  cliente_id: string;
  mina_id: string | null;
  permiso_municipal_numero: string | null;
  permiso_vigente_hasta: string | null;
  dentro_area_inhgeomin: boolean | null;
  declaracion_mercurio_cero: boolean | null;
  clpi_estado: EstadoClpi;
  documentos: Record<string, unknown>;
}

export function validarBodyFuente(body: unknown): Resultado<FuenteBody> {
  return envolver(() => {
    if (!isObj(body)) throw new Invalido('Cuerpo inválido.');
    const organizacion_id = optUuid(body.organizacion_id, 'organizacion_id');
    const cliente_id = reqUuid(body.cliente_id, 'cliente_id');
    const mina_id = optUuid(body.mina_id, 'mina_id') ?? null;
    const permiso_municipal_numero = optStr(body.permiso_municipal_numero, 80, 'permiso_municipal_numero') ?? null;
    const permiso_vigente_hasta = optDate(body.permiso_vigente_hasta, 'permiso_vigente_hasta') ?? null;
    const dentro_area_inhgeomin = optBool(body.dentro_area_inhgeomin, 'dentro_area_inhgeomin') ?? null;
    const declaracion_mercurio_cero = optBool(body.declaracion_mercurio_cero, 'declaracion_mercurio_cero') ?? null;
    // Sin documento de CLPI la fuente nace 'pendiente' (no elegible) — nunca se
    // presume 'no_aplica'.
    const clpiRaw = body.clpi_estado === undefined || body.clpi_estado === null ? 'pendiente' : body.clpi_estado;
    if (typeof clpiRaw !== 'string' || !(ESTADOS_CLPI as ReadonlyArray<string>).includes(clpiRaw)) {
      throw new Invalido(`clpi_estado inválido. Permitidos: ${ESTADOS_CLPI.join(', ')}`);
    }
    let documentos: Record<string, unknown> = {};
    if (body.documentos !== undefined && body.documentos !== null) {
      if (!isObj(body.documentos)) throw new Invalido('documentos debe ser un objeto JSON.');
      if (JSON.stringify(body.documentos).length > 20_000) throw new Invalido('documentos supera 20 000 caracteres.');
      documentos = body.documentos;
    }
    const out: FuenteBody = {
      cliente_id, mina_id, permiso_municipal_numero, permiso_vigente_hasta,
      dentro_area_inhgeomin, declaracion_mercurio_cero, clpi_estado: clpiRaw as EstadoClpi, documentos,
    };
    if (organizacion_id) out.organizacion_id = organizacion_id;
    return out;
  });
}

/* ── Lote ───────────────────────────────────────────────────────────────── */

export interface LoteBody {
  fuente_id: string;
  codigo: string | null;
  planta_org_id: string | null;
}

export function validarBodyLote(body: unknown): Resultado<LoteBody> {
  return envolver(() => {
    if (!isObj(body)) throw new Invalido('Cuerpo inválido.');
    const fuente_id = reqUuid(body.fuente_id, 'fuente_id');
    const codigo = optStr(body.codigo, 64, 'codigo') ?? null;
    if (codigo && !CODIGO_LOTE_RE.test(codigo)) throw new Invalido('codigo inválido (3–64 caracteres: letras, números, . _ - /).');
    const planta_org_id = optUuid(body.planta_org_id, 'planta_org_id') ?? null;
    return { fuente_id, codigo, planta_org_id };
  });
}

/**
 * Código LOTE-YYYY-NNNN: máximo entero del año + 1 (mismo criterio que
 * dashboardService.createDashExpediente — nunca ORDER BY lexicográfico).
 */
export function generarCodigoLote(existentes: ReadonlyArray<string | null | undefined>, year: number = new Date().getFullYear()): string {
  const prefix = `LOTE-${year}-`;
  let max = 0;
  for (const c of existentes) {
    if (!c || !c.startsWith(prefix)) continue;
    const n = parseInt(c.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/* ── Organización ───────────────────────────────────────────────────────── */

export interface OrganizacionBody {
  tipo: TipoOrganizacion;
  nombre: string;
  rtn: string | null;
}

export function validarBodyOrganizacion(body: unknown): Resultado<OrganizacionBody> {
  return envolver(() => {
    if (!isObj(body)) throw new Invalido('Cuerpo inválido.');
    const tipo = typeof body.tipo === 'string' ? body.tipo.trim() : '';
    if (!(TIPOS_ORGANIZACION as ReadonlyArray<string>).includes(tipo)) {
      throw new Invalido(`tipo inválido. Permitidos: ${TIPOS_ORGANIZACION.join(', ')}`);
    }
    const nombre = reqStr(body.nombre, 200, 'nombre');
    const rtn = optStr(body.rtn, 20, 'rtn') ?? null;
    if (rtn && !/^[0-9\-]{8,20}$/.test(rtn)) throw new Invalido('rtn inválido (dígitos y guiones, 8–20).');
    return { tipo: tipo as TipoOrganizacion, nombre, rtn };
  });
}

/* ── Consentimiento ─────────────────────────────────────────────────────── */

export interface ConsentimientoBody {
  cliente_id: string;
  otorgado_a_org_id: string;
  documento_path: string;
  hash_sha256: string;
  fecha_firma: string;
  alcance: Partial<Record<AlcanceConsentimiento, boolean>>;
}

export function validarBodyConsentimiento(body: unknown): Resultado<ConsentimientoBody> {
  return envolver(() => {
    if (!isObj(body)) throw new Invalido('Cuerpo inválido.');
    const cliente_id = reqUuid(body.cliente_id, 'cliente_id');
    const otorgado_a_org_id = reqUuid(body.otorgado_a_org_id, 'otorgado_a_org_id');
    if (!isStoragePathSafe(body.documento_path)) throw new Invalido('documento_path inválido (ruta relativa de Storage, sin "..", ≤ 240).');
    const documento_path = (body.documento_path as string).trim();
    const hashRaw = typeof body.hash_sha256 === 'string' ? body.hash_sha256.trim().toLowerCase() : '';
    if (!isSha256Hex(hashRaw)) throw new Invalido('hash_sha256 inválido (64 hex).');
    const fecha_firma = optDate(body.fecha_firma, 'fecha_firma');
    if (!fecha_firma) throw new Invalido('fecha_firma es obligatoria (YYYY-MM-DD).');
    if (!isObj(body.alcance)) throw new Invalido('alcance debe ser un objeto { expediente?, documentos?, lotes? }.');
    const alcance: Partial<Record<AlcanceConsentimiento, boolean>> = {};
    for (const k of Object.keys(body.alcance)) {
      if (!(ALCANCES_CONSENTIMIENTO as ReadonlyArray<string>).includes(k)) {
        throw new Invalido(`alcance desconocido: ${k}. Permitidos: ${ALCANCES_CONSENTIMIENTO.join(', ')}`);
      }
      const v = body.alcance[k];
      if (typeof v !== 'boolean') throw new Invalido(`alcance.${k} debe ser true/false.`);
      alcance[k as AlcanceConsentimiento] = v;
    }
    if (!Object.values(alcance).some(Boolean)) throw new Invalido('alcance debe habilitar al menos un ámbito.');
    return { cliente_id, otorgado_a_org_id, documento_path, hash_sha256: hashRaw, fecha_firma, alcance };
  });
}

export interface RevocacionBody {
  motivo: string | null;
  constancia_path: string | null;
}

export function validarBodyRevocacion(body: unknown): Resultado<RevocacionBody> {
  return envolver(() => {
    const b = body === undefined || body === null ? {} : body;
    if (!isObj(b)) throw new Invalido('Cuerpo inválido.');
    const motivo = optStr(b.motivo, 500, 'motivo') ?? null;
    let constancia_path: string | null = null;
    if (b.constancia_path !== undefined && b.constancia_path !== null && b.constancia_path !== '') {
      if (!isStoragePathSafe(b.constancia_path)) throw new Invalido('constancia_path inválido (ruta relativa de Storage).');
      constancia_path = (b.constancia_path as string).trim();
    }
    return { motivo, constancia_path };
  });
}

/* ── Exportación / listados ─────────────────────────────────────────────── */

export function parseLimit(raw: string | null, def: number, max: number): number {
  const n = raw === null ? def : parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

/**
 * Proyección de un pago para `auditor`: sin monto (decisión documentada,
 * pendiente de confirmación de Willis — el auditor verifica trazabilidad y
 * bancarización, no el valor de la transacción).
 */
export function redactarPagoParaAuditor<T extends { monto_lps?: unknown }>(pago: T): Omit<T, 'monto_lps'> & { monto_lps_omitido: true } {
  const { monto_lps: _omit, ...resto } = pago;
  void _omit;
  return { ...resto, monto_lps_omitido: true };
}
