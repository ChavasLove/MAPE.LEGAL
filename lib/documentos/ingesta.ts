// lib/documentos/ingesta.ts — preparación de un documento para el índice. PURO.
//
// Reglas de ingesta:
//   · solo documentos APROBADOS (estado 'verificado') y con respaldo VIGENTE;
//   · el texto se enmascara (lib/documentos/pii.ts) antes de fragmentarlo;
//   · cada fragmento hereda la ACL del respaldo: nunca una más abierta.

import { enmascararPII, type CampoEnmascarado } from './pii';
import type { NivelAcceso } from './respaldo';

export const ESTADO_DOCUMENTO_APROBADO = 'verificado';
const TAMANO_FRAGMENTO = 1200;
const MAX_FRAGMENTOS = 400;

export interface DocumentoParaIngesta {
  documento: { id: string; estado: string | null; nombre: string | null };
  respaldo: { id: string; version: number; vigente: boolean; nivel_acceso: NivelAcceso };
  fecha_documento?: string | null;
  texto: string;
}

export interface FragmentoParaIndice {
  documento_respaldo_id: string;
  orden: number;
  titulo: string;
  fecha_documento: string | null;
  contenido: string;
}

export type ResultadoIngesta =
  | { ok: true; fragmentos: FragmentoParaIndice[]; omitidos: Record<CampoEnmascarado, number> }
  | { ok: false; motivo: 'documento_no_aprobado' | 'respaldo_no_vigente' | 'texto_vacio' | 'documento_demasiado_largo' };

/** Parte el texto en fragmentos por párrafos, sin cortar a mitad de palabra. */
export function fragmentar(texto: string, tamano = TAMANO_FRAGMENTO): string[] {
  const parrafos = texto.replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: string[] = [];
  let actual = '';
  const cerrar = () => { if (actual) { out.push(actual); actual = ''; } };
  for (const p of parrafos) {
    let resto = p;
    while (resto.length > tamano) {
      cerrar();
      let corte = resto.lastIndexOf(' ', tamano);
      if (corte < tamano / 2) corte = tamano;
      out.push(resto.slice(0, corte).trim());
      resto = resto.slice(corte).trim();
    }
    if (actual && actual.length + resto.length + 1 > tamano) cerrar();
    actual = actual ? `${actual} ${resto}` : resto;
  }
  cerrar();
  return out;
}

export function prepararIngesta(d: DocumentoParaIngesta): ResultadoIngesta {
  if (d.documento.estado !== ESTADO_DOCUMENTO_APROBADO) return { ok: false, motivo: 'documento_no_aprobado' };
  if (!d.respaldo.vigente) return { ok: false, motivo: 'respaldo_no_vigente' };
  if (!d.texto.trim()) return { ok: false, motivo: 'texto_vacio' };
  const { texto, omitidos } = enmascararPII(d.texto);
  const partes = fragmentar(texto);
  if (partes.length > MAX_FRAGMENTOS) return { ok: false, motivo: 'documento_demasiado_largo' };
  const titulo = (d.documento.nombre ?? 'Documento').slice(0, 200);
  return {
    ok: true,
    omitidos,
    fragmentos: partes.map((contenido, i) => ({
      documento_respaldo_id: d.respaldo.id, orden: i + 1, titulo, fecha_documento: d.fecha_documento ?? null, contenido,
    })),
  };
}
