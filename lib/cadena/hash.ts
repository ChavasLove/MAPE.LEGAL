// lib/cadena/hash.ts — cadena de custodia encadenada por hash.
//
// Cada evento de un lote lleva `hash = sha256(canonico)` donde `canonico` es la
// cadena de texto definida en canonicoEvento(); incluye el `hash_previo` del
// evento anterior (o 'GENESIS' en el primero). Alterar o eliminar un evento
// rompe la verificación de todos los posteriores.
//
// La migración 043 recalcula EXACTAMENTE el mismo canónico en PostgreSQL
// (trigger BEFORE INSERT sobre lote_eventos, pgcrypto digest). Si cambiás un
// campo aquí, cambiá la función SQL y el test cruzado tests/cadena.test.ts.
//
// Formato canónico (campos unidos por '|', en este orden):
//   lote_id | secuencia | tipo | actor_user_id ('' si null) |
//   fecha en ISO UTC con milisegundos (YYYY-MM-DDTHH:mm:ss.sssZ) |
//   lugar ('' si null) | peso_g con 3 decimales ('' si null) |
//   ley_fino con 6 decimales ('' si null) | detalle_canonico | hash_previo
// En PostgreSQL:
//   to_char(fecha at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
//   to_char(peso_g, 'FM999999999990.000'), to_char(ley_fino, 'FM0.000000').

import { createHash } from 'node:crypto';
import { HASH_GENESIS } from './types';

export interface EventoParaHash {
  lote_id: string;
  secuencia: number;
  tipo: string;
  actor_user_id?: string | null;
  fecha: string | Date;
  lugar?: string | null;
  peso_g?: number | string | null;
  ley_fino?: number | string | null;
  detalle?: Record<string, unknown> | null;
  /** Si ya viene calculado (fila leída de la BD) se usa tal cual. */
  detalle_canonico?: string | null;
  hash_previo: string;
}

/** JSON con claves ordenadas recursivamente y sin espacios. `null`/undefined → '{}'. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return '{}';
  return JSON.stringify(ordenar(value));
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        if (o[k] !== undefined) acc[k] = ordenar(o[k]);
        return acc;
      }, {});
  }
  return v;
}

export function fechaCanonica(fecha: string | Date): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) throw new Error('fecha inválida');
  return d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
}

export function pesoCanonico(peso: number | string | null | undefined): string {
  if (peso === null || peso === undefined || peso === '') return '';
  const n = typeof peso === 'string' ? Number(peso) : peso;
  if (!Number.isFinite(n) || n < 0) throw new Error('peso_g inválido');
  return n.toFixed(3);
}

export function leyCanonica(ley: number | string | null | undefined): string {
  if (ley === null || ley === undefined || ley === '') return '';
  const n = typeof ley === 'string' ? Number(ley) : ley;
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error('ley_fino inválida (fracción 0–1)');
  return n.toFixed(6);
}

export function canonicoEvento(e: EventoParaHash): string {
  const detalle = e.detalle_canonico ?? canonicalJson(e.detalle ?? {});
  return [
    e.lote_id,
    String(e.secuencia),
    e.tipo,
    e.actor_user_id ?? '',
    fechaCanonica(e.fecha),
    e.lugar ?? '',
    pesoCanonico(e.peso_g),
    leyCanonica(e.ley_fino),
    detalle,
    e.hash_previo,
  ].join('|');
}

export function hashEvento(e: EventoParaHash): string {
  return createHash('sha256').update(canonicoEvento(e), 'utf8').digest('hex');
}

export interface ResultadoVerificacion {
  ok: boolean;
  total: number;
  /** Secuencia del primer eslabón roto, si lo hay. */
  primeraRotura: number | null;
  motivo: string | null;
}

/**
 * Verifica una cadena completa (eventos ordenados por secuencia): secuencias
 * consecutivas desde 1, hash_previo = hash del anterior (GENESIS en el primero)
 * y hash recalculado igual al almacenado.
 */
export function verificarCadena(
  eventos: ReadonlyArray<EventoParaHash & { hash: string }>,
): ResultadoVerificacion {
  let previo = HASH_GENESIS;
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    if (e.secuencia !== i + 1) {
      return { ok: false, total: eventos.length, primeraRotura: e.secuencia, motivo: 'secuencia_no_consecutiva' };
    }
    if (e.hash_previo !== previo) {
      return { ok: false, total: eventos.length, primeraRotura: e.secuencia, motivo: 'hash_previo_no_coincide' };
    }
    const recalculado = hashEvento(e);
    if (recalculado !== e.hash) {
      return { ok: false, total: eventos.length, primeraRotura: e.secuencia, motivo: 'hash_alterado' };
    }
    previo = e.hash;
  }
  return { ok: true, total: eventos.length, primeraRotura: null, motivo: null };
}
