// lib/recepcion/manifiesto.ts — manifiesto DETERMINISTA de una caja.
//
// Mismo contenido → mismo JSON canónico → mismo SHA-256, sin importar el orden
// en que lleguen los sobres ni el formato numérico de los pesos. La función
// `cerrar_caja()` (migración 047) verifica que el hash corresponde al texto y
// que el manifiesto lista EXACTAMENTE los sobres de la caja con sus pesos.
//
// El manifiesto NO lleva precios, montos, ni datos personales: solo
// identificadores, etiquetas, números de sello y pesos.

import { createHash } from 'node:crypto';
import { canonicalJson, pesoCanonico } from '@/lib/cadena/hash';

export const VERSION_MANIFIESTO = 1;

export interface CajaParaManifiesto {
  codigo: string;
  precinto: string;
  punto_id: string;
  laboratorio_org_id: string;
  titular_cliente_id: string;
}

export interface SobreParaManifiesto {
  id: string;
  etiqueta: string | null;
  numero_sello: string | null;
  mina_id: string;
  lote_id: string;
  titular_cliente_id: string;
  peso_neto_g: number | string | null;
}

export interface Manifiesto {
  version: number;
  caja: { codigo: string; precinto: string; punto_id: string; laboratorio_org_id: string; titular_origen_id: string };
  sobres: Array<{ id: string; etiqueta: string; numero_sello: string; mina_id: string; lote_id: string; peso_neto_g: string }>;
  total_sobres: number;
  peso_total_g: string;
}

export type ResultadoManifiesto =
  | { ok: true; manifiesto: Manifiesto; canonico: string; hash: string }
  | { ok: false; motivo: 'caja_vacia' | 'sin_precinto' | 'sobres_incompletos' | 'mezcla_de_titulares'; sobres?: string[] };

/** Suma exacta en milésimas de gramo (enteros), sin errores de coma flotante. */
function sumarMilesimas(pesos: string[]): string {
  let total = BigInt(0);
  for (const p of pesos) {
    const [ent, dec = ''] = p.split('.');
    total += BigInt(ent) * BigInt(1000) + BigInt((dec + '000').slice(0, 3));
  }
  const s = total.toString().padStart(4, '0');
  return `${s.slice(0, -3)}.${s.slice(-3)}`;
}

export function construirManifiesto(caja: CajaParaManifiesto, sobres: ReadonlyArray<SobreParaManifiesto>): ResultadoManifiesto {
  const precinto = caja.precinto?.trim() ?? '';
  if (!precinto) return { ok: false, motivo: 'sin_precinto' };
  if (sobres.length === 0) return { ok: false, motivo: 'caja_vacia' };

  const ajenos = sobres.filter((s) => s.titular_cliente_id !== caja.titular_cliente_id).map((s) => s.id);
  if (ajenos.length > 0) return { ok: false, motivo: 'mezcla_de_titulares', sobres: ajenos };

  const incompletos = sobres
    .filter((s) => s.peso_neto_g === null || s.peso_neto_g === '' || !s.etiqueta?.trim() || !s.numero_sello?.trim())
    .map((s) => s.id);
  if (incompletos.length > 0) return { ok: false, motivo: 'sobres_incompletos', sobres: incompletos };

  const filas = sobres
    .map((s) => ({
      id: s.id,
      etiqueta: s.etiqueta!.trim(),
      numero_sello: s.numero_sello!.trim(),
      mina_id: s.mina_id,
      lote_id: s.lote_id,
      peso_neto_g: pesoCanonico(s.peso_neto_g),
    }))
    // Orden estable e independiente de la entrada: por id.
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const manifiesto: Manifiesto = {
    version: VERSION_MANIFIESTO,
    caja: {
      codigo: caja.codigo,
      precinto,
      punto_id: caja.punto_id,
      laboratorio_org_id: caja.laboratorio_org_id,
      titular_origen_id: caja.titular_cliente_id,
    },
    sobres: filas,
    total_sobres: filas.length,
    peso_total_g: sumarMilesimas(filas.map((f) => f.peso_neto_g)),
  };
  const canonico = canonicalJson(manifiesto);
  return { ok: true, manifiesto, canonico, hash: hashManifiesto(canonico) };
}

export function hashManifiesto(canonico: string): string {
  return createHash('sha256').update(canonico, 'utf8').digest('hex');
}

/** Comprueba que un manifiesto guardado no fue alterado. */
export function verificarManifiesto(canonico: string | null, hash: string | null): boolean {
  return !!canonico && !!hash && hashManifiesto(canonico) === hash;
}
