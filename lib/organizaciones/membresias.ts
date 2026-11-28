// lib/organizaciones/membresias.ts — reglas PURAS de membresías de
// organización. Réplica de los triggers de la migración 048.
//
// Una membresía dice "pertenece a": NO concede derechos de escritura. Las
// altas, activaciones y bajas las hace el personal; el minero y la
// organización solo ven su pertenencia.

import type { Role } from '@/lib/userRoleLookup';
import { isObj, isUuid, type Resultado } from '@/lib/cadena/validacion';

export const ESTADOS_MEMBRESIA = ['pendiente', 'activa', 'baja'] as const;
export type EstadoMembresia = (typeof ESTADOS_MEMBRESIA)[number];

export const ROLES_EN_ORGANIZACION = ['miembro', 'representante', 'contacto'] as const;
export type RolEnOrganizacion = (typeof ROLES_EN_ORGANIZACION)[number];

export interface Membresia {
  id: string; organizacion_id: string; perfil_id: string | null; user_id: string | null;
  rol_en_organizacion: RolEnOrganizacion; estado: EstadoMembresia; alta_por: string;
  fecha_alta: string; fecha_activacion: string | null; fecha_baja: string | null;
}

export type ResultadoTransicion =
  | { ok: true }
  | { ok: false; motivo: 'transicion_invalida' | 'activacion_no_autorizada' | 'separacion_de_funciones' | 'motivo_obligatorio' };

/**
 * pendiente → activa (solo verificador/admin, y nunca quien dio el alta)
 * pendiente | activa → baja (con motivo). La baja es terminal.
 */
export function validarTransicionMembresia(input: {
  de: EstadoMembresia; a: EstadoMembresia; actorId: string; actorRol: Role; altaPor: string; motivo?: unknown;
}): ResultadoTransicion {
  const { de, a } = input;
  if (de === 'pendiente' && a === 'activa') {
    if (input.actorRol !== 'verificador' && input.actorRol !== 'admin') return { ok: false, motivo: 'activacion_no_autorizada' };
    if (input.actorId === input.altaPor) return { ok: false, motivo: 'separacion_de_funciones' };
    return { ok: true };
  }
  if ((de === 'pendiente' || de === 'activa') && a === 'baja') {
    if (typeof input.motivo !== 'string' || input.motivo.trim().length < 5) return { ok: false, motivo: 'motivo_obligatorio' };
    return { ok: true };
  }
  return { ok: false, motivo: 'transicion_invalida' };
}

/** Contexto de quien consulta, para el aislamiento entre organizaciones. */
export interface PertenenciaUsuario {
  userId: string;
  /** perfiles.id del usuario si es titular (o null). */
  perfilId: string | null;
  membresias: ReadonlyArray<Pick<Membresia, 'organizacion_id' | 'perfil_id' | 'user_id' | 'rol_en_organizacion' | 'estado'>>;
}

function esPropia(p: PertenenciaUsuario, m: { perfil_id: string | null; user_id: string | null }): boolean {
  return m.user_id === p.userId || (p.perfilId !== null && m.perfil_id === p.perfilId);
}

/** ¿Representa (membresía activa de representante) a la organización? */
export function representaOrganizacion(p: PertenenciaUsuario, organizacionId: string): boolean {
  return p.membresias.some((m) => m.organizacion_id === organizacionId && m.estado === 'activa'
    && m.rol_en_organizacion === 'representante' && esPropia(p, m));
}

/**
 * Membresías que un usuario EXTERNO puede ver: las propias, y —si es
 * representante activo— las de su organización. Nunca las de otra.
 */
export function membresiasVisibles<T extends Pick<Membresia, 'organizacion_id' | 'perfil_id' | 'user_id'>>(
  p: PertenenciaUsuario, todas: ReadonlyArray<T>,
): T[] {
  return todas.filter((m) => esPropia(p, m) || representaOrganizacion(p, m.organizacion_id));
}

/**
 * Lotes que una organización puede ver de sus miembros: solo los de titulares
 * con membresía ACTIVA en ella Y con un consentimiento vigente que incluya el
 * alcance "lotes" otorgado a esa organización (043). Sin consentimiento: nada.
 */
export function lotesVisiblesParaOrganizacion<L extends { cliente_id: string }>(input: {
  organizacionId: string;
  lotes: ReadonlyArray<L>;
  /** cliente_id de los titulares con membresía activa en la organización. */
  titularesActivos: ReadonlyArray<string>;
  consentimientos: ReadonlyArray<{ cliente_id: string; otorgado_a_org_id: string; estado: string; alcance: Record<string, unknown> | null }>;
}): L[] {
  const activos = new Set(input.titularesActivos);
  const conConsentimiento = new Set(
    input.consentimientos
      .filter((c) => c.otorgado_a_org_id === input.organizacionId && c.estado === 'vigente' && c.alcance?.lotes === true)
      .map((c) => c.cliente_id),
  );
  return input.lotes.filter((l) => activos.has(l.cliente_id) && conConsentimiento.has(l.cliente_id));
}

/** Un municipio adopta el estándar: no es parte compradora del flujo. */
export function papelAdmitidoParaTipo(tipoOrganizacion: string, papel: string): boolean {
  if (tipoOrganizacion === 'municipio' && papel === 'parte_compradora') return false;
  if (papel === 'laboratorio_destino' && tipoOrganizacion !== 'laboratorio') return false;
  return true;
}

export interface MembresiaAlta { perfil_id: string | null; user_id: string | null; rol_en_organizacion: RolEnOrganizacion }

export function validarMembresiaAlta(body: unknown): Resultado<MembresiaAlta> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  for (const k of Object.keys(body)) {
    if (!['perfil_id', 'user_id', 'rol_en_organizacion'].includes(k)) return { ok: false, error: `Campo no admitido: ${k}.` };
  }
  const perfil = body.perfil_id ?? null;
  const user = body.user_id ?? null;
  if ((perfil === null) === (user === null)) return { ok: false, error: 'Indique perfil_id o user_id (uno solo).' };
  if (perfil !== null && !isUuid(perfil)) return { ok: false, error: 'perfil_id inválido.' };
  if (user !== null && !isUuid(user)) return { ok: false, error: 'user_id inválido.' };
  const rol = body.rol_en_organizacion ?? 'miembro';
  if (typeof rol !== 'string' || !(ROLES_EN_ORGANIZACION as ReadonlyArray<string>).includes(rol)) {
    return { ok: false, error: `rol_en_organizacion inválido. Permitidos: ${ROLES_EN_ORGANIZACION.join(', ')}.` };
  }
  return { ok: true, data: { perfil_id: perfil as string | null, user_id: user as string | null, rol_en_organizacion: rol as RolEnOrganizacion } };
}

export const MEMBRESIA_MENSAJE: Record<string, string> = {
  transicion_invalida: 'El estado actual de la membresía no admite ese cambio.',
  activacion_no_autorizada: 'Solo un verificador activa una membresía.',
  separacion_de_funciones: 'Quien dio el alta no puede activar la membresía.',
  motivo_obligatorio: 'La baja exige un motivo (mínimo 5 caracteres).',
  municipio_no_es_parte_compradora: 'Un municipio adopta el estándar; no figura como parte compradora.',
};

export const ESTADO_MEMBRESIA_ETIQUETA: Record<EstadoMembresia, string> = { pendiente: 'Pendiente de activación', activa: 'Activa', baja: 'De baja' };
export const ROL_ORG_ETIQUETA: Record<RolEnOrganizacion, string> = { miembro: 'Miembro', representante: 'Representante', contacto: 'Contacto' };
