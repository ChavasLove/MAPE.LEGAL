// lib/acceso/personal.ts — RBAC en código para la reestructura de recepción,
// acceso y custodia (2026-11-28). Predicados PUROS (sin BD, sin Next): la API
// los aplica después de requireRole(); la RLS de 045–049 queda como defensa en
// profundidad. Patrón de lib/cadena/acceso.ts.
//
// REGLA BASE — "los usuarios solo ven": mineros (cliente) y organizaciones
// externas (comercializador, planta, auditor) no cargan datos de trazabilidad
// en este flujo. Toda la carga la hace el personal.
//
// [POR CONFIRMAR — WILLIS] quién verifica/aprueba (¿solo `verificador`, o
// también personal del operador de recepción?) y cuántos verificadores. Hoy:
// deciden `verificador` y `admin`, siempre con separación de funciones.

import type { Role } from '@/lib/userRoleLookup';

export const ACCIONES_PERSONAL = [
  'perfil:ver',
  'perfil:crear',
  'perfil:editar',
  'perfil:decidir',          // aprobar / rechazar / suspender
  'consentimiento:registrar',
  'consentimiento:revocar',
  'recepcion:ver',
  'recepcion:registrar',     // llegada, pesaje, análisis, etiquetado, sobres
  'caja:cerrar',
  'envio:registrar',
  'laboratorio:recibir',
  'recepcion:anular',        // siempre como evento de corrección
  'organizacion:gestionar',  // altas/bajas de membresías, invitaciones
  'membresia:activar',       // activar una invitación aceptada
  'documento:subir',
  'documento:revocar',
  'rol:asignar',
] as const;
export type AccionPersonal = (typeof ACCIONES_PERSONAL)[number];

const TODAS: ReadonlySet<AccionPersonal> = new Set(ACCIONES_PERSONAL);

const MATRIZ: Record<Role, ReadonlySet<AccionPersonal>> = {
  admin: TODAS,
  abogado: new Set<AccionPersonal>([
    'perfil:ver', 'perfil:crear', 'perfil:editar',
    'consentimiento:registrar', 'consentimiento:revocar',
    'recepcion:ver', 'organizacion:gestionar', 'documento:subir', 'documento:revocar',
  ]),
  tecnico_ambiental: new Set<AccionPersonal>([
    'perfil:ver', 'perfil:crear', 'perfil:editar', 'recepcion:ver', 'documento:subir',
  ]),
  verificador: new Set<AccionPersonal>([
    'perfil:ver', 'perfil:decidir', 'recepcion:ver', 'membresia:activar',
  ]),
  recepcion: new Set<AccionPersonal>([
    'perfil:ver', 'perfil:crear', 'perfil:editar',
    'consentimiento:registrar',
    'recepcion:ver', 'recepcion:registrar', 'caja:cerrar', 'envio:registrar',
    'laboratorio:recibir', 'recepcion:anular', 'documento:subir',
  ]),
  // Usuarios externos: solo ven. Ninguna acción de carga.
  cliente: new Set(),
  comercializador: new Set(),
  planta: new Set(),
  auditor: new Set(),
};

export function puede(rol: Role, accion: AccionPersonal): boolean {
  return MATRIZ[rol]?.has(accion) ?? false;
}

/** Roles que tienen permitida una acción — para pasar a requireRole(). */
export function rolesCon(accion: AccionPersonal): Role[] {
  return (Object.keys(MATRIZ) as Role[]).filter((r) => MATRIZ[r].has(accion));
}

const PERSONAL = new Set<Role>(['admin', 'abogado', 'tecnico_ambiental', 'verificador', 'recepcion']);

/** Personal: los únicos roles que cargan datos. */
export function esPersonal(rol: Role): boolean {
  return PERSONAL.has(rol);
}

/** Usuarios externos: mineros y organizaciones. Solo lectura de lo propio. */
export function esUsuarioSoloLectura(rol: Role): boolean {
  return !PERSONAL.has(rol);
}

export interface AutoriaRegistro {
  creado_por: string | null;
  /** Último usuario que editó el contenido (null si nadie lo editó tras crearlo). */
  editado_por: string | null;
}

export type ResultadoSeparacion = { ok: true } | { ok: false; motivo: 'es_creador' | 'es_editor' | 'sin_actor' };

/**
 * Separación de funciones: quien creó o editó un registro no puede aprobarlo.
 * Vale para todos los roles, incluido admin. Réplica del trigger
 * `fn_aprobacion_separacion_funciones` (migración 046).
 */
export function separacionDeFunciones(decisorId: string | null | undefined, registro: AutoriaRegistro): ResultadoSeparacion {
  if (!decisorId) return { ok: false, motivo: 'sin_actor' };
  if (registro.creado_por && registro.creado_por === decisorId) return { ok: false, motivo: 'es_creador' };
  if (registro.editado_por && registro.editado_por === decisorId) return { ok: false, motivo: 'es_editor' };
  return { ok: true };
}

export interface ContextoPersonal {
  rol: Role;
  userId: string;
  /** user_roles.organizacion_id — organización que opera el punto del usuario (o null). */
  organizacionId: string | null;
}

/**
 * Alcance por punto de recepción: `recepcion` con organización solo opera los
 * puntos de SU organización; sin organización asignada no opera ninguno. El
 * resto del personal (admin, abogado, tecnico_ambiental, verificador) ve todos.
 */
export function alcanzaPunto(ctx: ContextoPersonal, punto: { organizacion_id: string }): boolean {
  if (!esPersonal(ctx.rol)) return false;
  if (ctx.rol !== 'recepcion') return true;
  return ctx.organizacionId !== null && ctx.organizacionId === punto.organizacion_id;
}
