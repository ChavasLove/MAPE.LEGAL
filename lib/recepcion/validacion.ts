// lib/recepcion/validacion.ts — validadores PUROS de los cuerpos de
// /api/recepcion/*. Lista cerrada de campos: no existe ningún campo de monto,
// medio de pago, precio ni comprobante, y un body que los traiga se rechaza.

import { isObj, isUuid, type Resultado } from '@/lib/cadena/validacion';
import { ESTADOS_EMBALAJE, MODOS_ENTREGA, PAPELES_FLUJO, TIPOS_PUNTO, type EstadoEmbalaje, type ModoEntrega, type PapelFlujo, type TipoPunto } from './types';

class Invalido extends Error {}

function soloCampos(body: Record<string, unknown>, permitidos: ReadonlyArray<string>): void {
  for (const k of Object.keys(body)) if (!permitidos.includes(k)) throw new Invalido(`Campo no admitido: ${k}.`);
}
function texto(v: unknown, max: number, label: string, req = false): string | null {
  if (v === undefined || v === null || v === '') {
    if (req) throw new Invalido(`${label} es obligatorio.`);
    return null;
  }
  if (typeof v !== 'string') throw new Invalido(`${label} debe ser texto.`);
  const t = v.trim();
  if (t.length > max) throw new Invalido(`${label} supera ${max} caracteres.`);
  if (req && !t) throw new Invalido(`${label} es obligatorio.`);
  return t || null;
}
function uuid(v: unknown, label: string): string {
  if (!isUuid(v)) throw new Invalido(`${label} inválido.`);
  return v;
}
function enumerado<T extends string>(v: unknown, lista: ReadonlyArray<T>, label: string): T {
  if (typeof v !== 'string' || !(lista as ReadonlyArray<string>).includes(v)) throw new Invalido(`${label} inválido. Permitidos: ${lista.join(', ')}.`);
  return v as T;
}
function numero(v: unknown, label: string, max: number): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max) throw new Invalido(`${label} debe ser un número entre 0 y ${max}.`);
  return n;
}
function fechaHora(v: unknown, label: string, ahora: Date): string {
  if (v === undefined || v === null || v === '') return ahora.toISOString();
  if (typeof v !== 'string') throw new Invalido(`${label} debe ser texto ISO.`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Invalido(`${label} inválida.`);
  if (d.getTime() > ahora.getTime() + 5 * 60_000) throw new Invalido(`${label} no puede ser futura.`);
  return d.toISOString();
}
function fechaYmd(v: unknown, label: string): string | null {
  const t = texto(v, 10, label);
  if (t === null) return null;
  const d = new Date(`${t}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) throw new Invalido(`${label} debe ser YYYY-MM-DD.`);
  return t;
}
function envolver<T>(body: unknown, fn: (b: Record<string, unknown>) => T): Resultado<T> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  try {
    return { ok: true, data: fn(body) };
  } catch (e) {
    if (e instanceof Invalido) return { ok: false, error: e.message };
    throw e;
  }
}

export interface RecepcionBody {
  punto_id: string; lote_id: string; mina_id: string; modo_entrega: ModoEntrega; guia: string | null;
  fecha_llegada: string; estado_embalaje: EstadoEmbalaje; observaciones: string | null;
}
export function validarRecepcion(body: unknown, ahora: Date = new Date()): Resultado<RecepcionBody> {
  return envolver(body, (b) => {
    soloCampos(b, ['punto_id', 'lote_id', 'mina_id', 'modo_entrega', 'guia', 'fecha_llegada', 'estado_embalaje', 'observaciones']);
    return {
      punto_id: uuid(b.punto_id, 'punto_id'),
      lote_id: uuid(b.lote_id, 'lote_id'),
      mina_id: uuid(b.mina_id, 'mina_id'),
      modo_entrega: enumerado(b.modo_entrega, MODOS_ENTREGA, 'modo_entrega'),
      guia: texto(b.guia, 80, 'guia'),
      fecha_llegada: fechaHora(b.fecha_llegada, 'fecha_llegada', ahora),
      estado_embalaje: b.estado_embalaje === undefined ? 'no_aplica' : enumerado(b.estado_embalaje, ESTADOS_EMBALAJE, 'estado_embalaje'),
      observaciones: texto(b.observaciones, 1000, 'observaciones'),
    };
  });
}

export interface SobreBody {
  peso_bruto_g?: number | null; peso_neto_g?: number | null; instrumento?: string | null; calibracion_fecha?: string | null;
  ley_fino?: number | null; certificado_id?: string | null; numero_sello?: string | null; etiqueta?: string | null; caja_id?: string | null;
}
const CAMPOS_SOBRE = ['peso_bruto_g', 'peso_neto_g', 'instrumento', 'calibracion_fecha', 'ley_fino', 'certificado_id', 'numero_sello', 'etiqueta', 'caja_id'];
const ETIQUETA_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,63}$/;

export function validarSobre(body: unknown, opts: { permitirCaja: boolean }): Resultado<SobreBody> {
  return envolver(body, (b) => {
    soloCampos(b, opts.permitirCaja ? CAMPOS_SOBRE : CAMPOS_SOBRE.filter((c) => c !== 'caja_id'));
    const out: SobreBody = {};
    if ('peso_bruto_g' in b) out.peso_bruto_g = numero(b.peso_bruto_g, 'peso_bruto_g', 99_999_999);
    if ('peso_neto_g' in b) out.peso_neto_g = numero(b.peso_neto_g, 'peso_neto_g', 99_999_999);
    if (out.peso_bruto_g != null && out.peso_neto_g != null && out.peso_neto_g > out.peso_bruto_g) throw new Invalido('El peso neto no puede superar el peso bruto.');
    if ('instrumento' in b) out.instrumento = texto(b.instrumento, 120, 'instrumento');
    if ('calibracion_fecha' in b) out.calibracion_fecha = fechaYmd(b.calibracion_fecha, 'calibracion_fecha');
    if ('ley_fino' in b) out.ley_fino = numero(b.ley_fino, 'ley_fino', 1);
    if ('certificado_id' in b) out.certificado_id = b.certificado_id === null || b.certificado_id === '' ? null : uuid(b.certificado_id, 'certificado_id');
    for (const c of ['numero_sello', 'etiqueta'] as const) {
      if (c in b) {
        const t = texto(b[c], 64, c);
        if (t !== null && !ETIQUETA_RE.test(t)) throw new Invalido(`${c} tiene caracteres no permitidos.`);
        out[c] = t;
      }
    }
    if ('caja_id' in b) out.caja_id = b.caja_id === null || b.caja_id === '' ? null : uuid(b.caja_id, 'caja_id');
    return out;
  });
}

export interface CajaBody { punto_id: string; titular_cliente_id: string; laboratorio_org_id: string }
export function validarCaja(body: unknown): Resultado<CajaBody> {
  return envolver(body, (b) => {
    soloCampos(b, ['punto_id', 'titular_cliente_id', 'laboratorio_org_id']);
    return {
      punto_id: uuid(b.punto_id, 'punto_id'),
      titular_cliente_id: uuid(b.titular_cliente_id, 'titular_cliente_id'),
      laboratorio_org_id: uuid(b.laboratorio_org_id, 'laboratorio_org_id'),
    };
  });
}

export function validarCierre(body: unknown): Resultado<{ precinto: string }> {
  return envolver(body, (b) => {
    soloCampos(b, ['precinto']);
    return { precinto: texto(b.precinto, 64, 'precinto', true)! };
  });
}

export interface EnvioBody { medio: ModoEntrega; guia: string | null; fecha_envio: string }
export function validarEnvio(body: unknown, ahora: Date = new Date()): Resultado<EnvioBody> {
  return envolver(body, (b) => {
    soloCampos(b, ['medio', 'guia', 'fecha_envio']);
    return { medio: enumerado(b.medio, MODOS_ENTREGA, 'medio'), guia: texto(b.guia, 80, 'guia'), fecha_envio: fechaHora(b.fecha_envio, 'fecha_envio', ahora) };
  });
}

export interface RecepcionLabBody { fecha_recepcion: string; precinto_integro: boolean; pesos: Array<{ sobre_id: string; peso_g: string }> }
export function validarRecepcionLaboratorio(body: unknown, ahora: Date = new Date()): Resultado<RecepcionLabBody> {
  return envolver(body, (b) => {
    soloCampos(b, ['fecha_recepcion', 'precinto_integro', 'pesos']);
    if (typeof b.precinto_integro !== 'boolean') throw new Invalido('precinto_integro debe ser true/false.');
    if (!Array.isArray(b.pesos) || b.pesos.length > 500) throw new Invalido('pesos debe ser una lista (máximo 500).');
    const vistos = new Set<string>();
    const pesos = b.pesos.map((p) => {
      if (!isObj(p)) throw new Invalido('Cada peso debe ser un objeto.');
      soloCampos(p, ['sobre_id', 'peso_g']);
      const id = uuid(p.sobre_id, 'sobre_id');
      if (vistos.has(id)) throw new Invalido('Hay un sobre repetido en los pesos.');
      vistos.add(id);
      const n = numero(p.peso_g, 'peso_g', 99_999_999);
      if (n === null) throw new Invalido('peso_g es obligatorio.');
      return { sobre_id: id, peso_g: n.toFixed(3) };
    });
    return { fecha_recepcion: fechaHora(b.fecha_recepcion, 'fecha_recepcion', ahora), precinto_integro: b.precinto_integro, pesos };
  });
}

export function validarAnulacion(body: unknown): Resultado<{ motivo: string }> {
  return envolver(body, (b) => {
    soloCampos(b, ['motivo']);
    const m = texto(b.motivo, 500, 'motivo', true)!;
    if (m.length < 5) throw new Invalido('El motivo es obligatorio (mínimo 5 caracteres).');
    return { motivo: m };
  });
}

export function validarPunto(body: unknown): Resultado<{ organizacion_id: string; tipo: TipoPunto; nombre: string }> {
  return envolver(body, (b) => {
    soloCampos(b, ['organizacion_id', 'tipo', 'nombre']);
    const nombre = texto(b.nombre, 120, 'nombre', true)!;
    if (nombre.length < 2) throw new Invalido('nombre es demasiado corto.');
    return { organizacion_id: uuid(b.organizacion_id, 'organizacion_id'), tipo: enumerado(b.tipo, TIPOS_PUNTO, 'tipo'), nombre };
  });
}

export function validarParte(body: unknown): Resultado<{ papel: PapelFlujo; organizacion_id: string; lote_id: string | null; punto_id: string | null }> {
  return envolver(body, (b) => {
    soloCampos(b, ['papel', 'organizacion_id', 'lote_id', 'punto_id']);
    const lote = b.lote_id ? uuid(b.lote_id, 'lote_id') : null;
    const punto = b.punto_id ? uuid(b.punto_id, 'punto_id') : null;
    if ((lote === null) === (punto === null)) throw new Invalido('Indique lote_id o punto_id (uno solo).');
    return { papel: enumerado(b.papel, PAPELES_FLUJO, 'papel'), organizacion_id: uuid(b.organizacion_id, 'organizacion_id'), lote_id: lote, punto_id: punto };
  });
}

/** Código correlativo PREFIJO-AAAA-NNNN a partir de los existentes. */
export function generarCodigo(prefijo: string, existentes: ReadonlyArray<string | null | undefined>, year: number = new Date().getFullYear()): string {
  const base = `${prefijo}-${year}-`;
  let max = 0;
  for (const c of existentes) {
    if (!c || !c.startsWith(base)) continue;
    const n = Number.parseInt(c.slice(base.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${base}${String(max + 1).padStart(4, '0')}`;
}
