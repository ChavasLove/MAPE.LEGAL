// lib/perfiles/estados.ts — máquina de estados de un perfil (minero/productor u
// organización). PURO. Réplica en la migración 046 (triggers de `perfiles` y
// función `decidir_perfil`).
//
// REGLAS:
//   · Todo perfil nace `pendiente` (o `borrador` si el personal aún no terminó
//     de cargarlo). Nunca nace aprobado.
//   · Solo un perfil `aprobado` participa en lotes, recepciones y verificación.
//   · Aprobar / rechazar / suspender son DECISIONES: una por una, con actor
//     distinto de quien creó o editó, y con motivo obligatorio al rechazar o
//     suspender.
//   · Editar el contenido de un perfil ya decidido lo devuelve a `pendiente`
//     y sube la versión: lo aprobado es siempre una versión concreta (su hash
//     queda en la bitácora de aprobaciones). [POR CONFIRMAR — WILLIS: devolver
//     a pendiente (implementado) o crear una versión nueva en paralelo.]

import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/cadena/hash';

export const TIPOS_PERFIL = ['minero', 'organizacion'] as const;
export type TipoPerfil = (typeof TIPOS_PERFIL)[number];

export const ESTADOS_PERFIL = ['borrador', 'pendiente', 'aprobado', 'rechazado', 'suspendido'] as const;
export type EstadoPerfil = (typeof ESTADOS_PERFIL)[number];

/** Estados con los que puede nacer un perfil. */
export const ESTADOS_INICIALES: ReadonlyArray<EstadoPerfil> = ['pendiente', 'borrador'];

export const DECISIONES_PERFIL = ['aprobado', 'rechazado', 'suspendido'] as const;
export type DecisionPerfil = (typeof DECISIONES_PERFIL)[number];

/** Transiciones que hace el personal que CARGA (sin decisión). */
const TRANSICIONES_CARGA: Record<EstadoPerfil, ReadonlyArray<EstadoPerfil>> = {
  borrador: ['pendiente'],
  pendiente: [],
  aprobado: [],
  rechazado: ['pendiente'],   // corregido y reenviado
  suspendido: ['pendiente'],  // se pide una nueva revisión
};

/** Transiciones que son DECISIÓN del verificador. */
const TRANSICIONES_DECISION: Record<EstadoPerfil, ReadonlyArray<DecisionPerfil>> = {
  borrador: [],
  pendiente: ['aprobado', 'rechazado'],
  aprobado: ['suspendido'],
  rechazado: [],
  suspendido: [],
};

export function esEstadoPerfil(v: unknown): v is EstadoPerfil {
  return typeof v === 'string' && (ESTADOS_PERFIL as ReadonlyArray<string>).includes(v);
}

export function esDecisionPerfil(v: unknown): v is DecisionPerfil {
  return typeof v === 'string' && (DECISIONES_PERFIL as ReadonlyArray<string>).includes(v);
}

export function estadoInicial(solicitado?: unknown): EstadoPerfil {
  return solicitado === 'borrador' ? 'borrador' : 'pendiente';
}

export function puedeTransicionarCarga(de: EstadoPerfil, a: EstadoPerfil): boolean {
  return TRANSICIONES_CARGA[de].includes(a);
}

export type ResultadoDecision =
  | { ok: true; estado: DecisionPerfil }
  | { ok: false; motivo: 'transicion_invalida' | 'motivo_obligatorio' | 'decision_invalida' };

const MOTIVO_MIN = 5;

/** Valida una decisión contra el estado actual. No evalúa quién decide (eso es separacionDeFunciones). */
export function validarDecision(estadoActual: EstadoPerfil, decision: unknown, motivo: unknown): ResultadoDecision {
  if (!esDecisionPerfil(decision)) return { ok: false, motivo: 'decision_invalida' };
  if (!TRANSICIONES_DECISION[estadoActual].includes(decision)) return { ok: false, motivo: 'transicion_invalida' };
  if (decision !== 'aprobado') {
    if (typeof motivo !== 'string' || motivo.trim().length < MOTIVO_MIN) return { ok: false, motivo: 'motivo_obligatorio' };
  }
  return { ok: true, estado: decision };
}

/** Estado resultante de editar el contenido: lo ya decidido vuelve a revisión. */
export function estadoTrasEdicion(actual: EstadoPerfil): EstadoPerfil {
  return actual === 'borrador' ? 'borrador' : 'pendiente';
}

/** Solo un perfil aprobado origina lotes y recepciones. */
export function perfilHabilitado(perfil: { estado: EstadoPerfil } | null | undefined): boolean {
  return perfil?.estado === 'aprobado';
}

export type MotivoNoHabilitado = 'sin_perfil' | 'perfil_no_aprobado';

export function puedeOriginarLote(perfil: { estado: EstadoPerfil } | null | undefined):
  { ok: true } | { ok: false; motivo: MotivoNoHabilitado } {
  if (!perfil) return { ok: false, motivo: 'sin_perfil' };
  if (perfil.estado !== 'aprobado') return { ok: false, motivo: 'perfil_no_aprobado' };
  return { ok: true };
}

/**
 * Huella de la versión del contenido: SHA-256 del JSON canónico (claves
 * ordenadas). Réplica SQL: sha256_hex(jsonb_canonico(contenido)) — misma
 * salvedad de la 043 con decimales redundantes (evitar 1.0).
 */
export function hashContenidoPerfil(contenido: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalJson(contenido), 'utf8').digest('hex');
}

export const ESTADO_PERFIL_ETIQUETA: Record<EstadoPerfil, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  suspendido: 'Suspendido',
};

export const MOTIVO_DECISION_MENSAJE: Record<string, string> = {
  transicion_invalida: 'El estado actual del perfil no admite esa decisión.',
  motivo_obligatorio: 'El motivo es obligatorio al rechazar o suspender (mínimo 5 caracteres).',
  decision_invalida: 'Decisión inválida.',
  es_creador: 'Quien creó el perfil no puede decidir sobre él.',
  es_editor: 'Quien editó el perfil no puede decidir sobre él.',
  sin_actor: 'No se pudo identificar a quien decide.',
};
