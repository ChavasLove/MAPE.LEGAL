// lib/perfiles/validacion.ts — validadores PUROS de los cuerpos de /api/perfiles.
// Lista cerrada de campos: nada del body llega a la base sin pasar por aquí.
//
// El contenido del perfil lo carga el PERSONAL a partir de documentos; no hay
// ningún campo de monto, medio de pago ni comprobante.

import { TIPOS_PERFIL, estadoInicial, type EstadoPerfil, type TipoPerfil } from './estados';
import { isObj, isUuid, type Resultado } from '@/lib/cadena/validacion';

/** Campos admitidos en `contenido`, por tipo de perfil. Texto corto; sin anidar. */
export const CAMPOS_CONTENIDO: Record<TipoPerfil, ReadonlyArray<string>> = {
  minero: ['nombre_legal', 'tipo_persona', 'municipio', 'departamento', 'representante', 'observaciones'],
  organizacion: ['razon_social', 'tipo_organizacion', 'municipio', 'departamento', 'representante', 'observaciones'],
};

const MAX_TEXTO = 300;
const MAX_DOCUMENTOS = 30;

export interface PerfilCrear {
  tipo: TipoPerfil;
  cliente_id: string | null;
  organizacion_id: string | null;
  contenido: Record<string, string>;
  documentos_respaldo: string[];
  estado: EstadoPerfil;
}

function limpiarContenido(tipo: TipoPerfil, crudo: unknown): Resultado<Record<string, string>> {
  if (!isObj(crudo)) return { ok: false, error: 'contenido debe ser un objeto.' };
  const permitidos = CAMPOS_CONTENIDO[tipo];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(crudo)) {
    if (!permitidos.includes(k)) return { ok: false, error: `Campo no admitido en el perfil: ${k}.` };
    if (v === null || v === undefined || v === '') continue;
    if (typeof v !== 'string') return { ok: false, error: `${k} debe ser texto.` };
    const t = v.trim();
    if (t.length > MAX_TEXTO) return { ok: false, error: `${k} supera ${MAX_TEXTO} caracteres.` };
    if (t.length > 0) out[k] = t;
  }
  return { ok: true, data: out };
}

function limpiarDocumentos(crudo: unknown): Resultado<string[]> {
  if (crudo === undefined || crudo === null) return { ok: true, data: [] };
  if (!Array.isArray(crudo)) return { ok: false, error: 'documentos_respaldo debe ser una lista.' };
  if (crudo.length > MAX_DOCUMENTOS) return { ok: false, error: `documentos_respaldo admite hasta ${MAX_DOCUMENTOS} elementos.` };
  for (const d of crudo) if (!isUuid(d)) return { ok: false, error: 'documentos_respaldo contiene un identificador inválido.' };
  return { ok: true, data: [...new Set(crudo as string[])] };
}

export function validarPerfilCrear(body: unknown): Resultado<PerfilCrear> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  const tipo = body.tipo;
  if (typeof tipo !== 'string' || !(TIPOS_PERFIL as ReadonlyArray<string>).includes(tipo)) {
    return { ok: false, error: `tipo inválido. Permitidos: ${TIPOS_PERFIL.join(', ')}.` };
  }
  const t = tipo as TipoPerfil;
  const cliente = body.cliente_id ?? null;
  const org = body.organizacion_id ?? null;
  if (t === 'minero' && (!isUuid(cliente) || org !== null)) {
    return { ok: false, error: 'Un perfil de minero exige cliente_id y no lleva organizacion_id.' };
  }
  if (t === 'organizacion' && (!isUuid(org) || cliente !== null)) {
    return { ok: false, error: 'Un perfil de organización exige organizacion_id y no lleva cliente_id.' };
  }
  const contenido = limpiarContenido(t, body.contenido ?? {});
  if (!contenido.ok) return contenido;
  const docs = limpiarDocumentos(body.documentos_respaldo);
  if (!docs.ok) return docs;
  return {
    ok: true,
    data: {
      tipo: t,
      cliente_id: t === 'minero' ? (cliente as string) : null,
      organizacion_id: t === 'organizacion' ? (org as string) : null,
      contenido: contenido.data,
      documentos_respaldo: docs.data,
      // Nunca nace aprobado, venga lo que venga en el body.
      estado: estadoInicial(body.estado),
    },
  };
}

export interface PerfilEditar {
  contenido?: Record<string, string>;
  documentos_respaldo?: string[];
  enviar_a_revision?: boolean;
}

export function validarPerfilEditar(tipo: TipoPerfil, body: unknown): Resultado<PerfilEditar> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  const permitidas = ['contenido', 'documentos_respaldo', 'enviar_a_revision'];
  for (const k of Object.keys(body)) {
    if (!permitidas.includes(k)) return { ok: false, error: `Campo no editable: ${k}.` };
  }
  const out: PerfilEditar = {};
  if (body.contenido !== undefined) {
    const c = limpiarContenido(tipo, body.contenido);
    if (!c.ok) return c;
    out.contenido = c.data;
  }
  if (body.documentos_respaldo !== undefined) {
    const d = limpiarDocumentos(body.documentos_respaldo);
    if (!d.ok) return d;
    out.documentos_respaldo = d.data;
  }
  if (body.enviar_a_revision !== undefined) {
    if (typeof body.enviar_a_revision !== 'boolean') return { ok: false, error: 'enviar_a_revision debe ser true/false.' };
    out.enviar_a_revision = body.enviar_a_revision;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'No hay cambios.' };
  return { ok: true, data: out };
}
