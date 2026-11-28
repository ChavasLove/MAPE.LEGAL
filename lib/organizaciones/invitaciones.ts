// lib/organizaciones/invitaciones.ts — invitaciones a una organización. PURO.
//
// El token es un secreto aleatorio que viaja SOLO en el correo; la base guarda
// su SHA-256 (un token de 256 bits no necesita sal ni pepper: no es adivinable).
// Un solo uso, con expiración. Aceptar la invitación crea una membresía
// PENDIENTE: no da derechos de escritura y no se activa sin un verificador.

import { createHash, randomBytes } from 'node:crypto';
import { normalizarCorreo } from '@/lib/auth/otp';
import { isObj, type Resultado } from '@/lib/cadena/validacion';
import { ROLES_EN_ORGANIZACION, type RolEnOrganizacion } from './membresias';

/** Vigencia de una invitación. [POR CONFIRMAR — WILLIS] Propuesta técnica: 7 días. */
export const INVITACION_VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Token nuevo (256 bits, base64url) y su hash. El token no se guarda. */
export function generarTokenInvitacion(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashTokenInvitacion(token) };
}

export function esTokenBienFormado(v: unknown): v is string {
  return typeof v === 'string' && TOKEN_RE.test(v);
}

export function hashTokenInvitacion(token: string): string {
  return createHash('sha256').update(`invitacion:${token}`, 'utf8').digest('hex');
}

export function venceEn(ahora: Date, vigenciaMs: number = INVITACION_VIGENCIA_MS): string {
  return new Date(ahora.getTime() + vigenciaMs).toISOString();
}

export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'expirada' | 'revocada';

export type ResultadoInvitacion =
  | { ok: true }
  | { ok: false; motivo: 'invitacion_invalida' | 'ya_aceptada' | 'expirada' | 'revocada' | 'correo_no_coincide' };

/** Réplica de aceptar_invitacion_organizacion() (048). */
export function evaluarInvitacion(
  inv: { estado: EstadoInvitacion; expira_en: string; correo: string } | null,
  ahora: Date,
  correoDelUsuario: string | null,
): ResultadoInvitacion {
  if (!inv) return { ok: false, motivo: 'invitacion_invalida' };
  if (inv.estado === 'aceptada') return { ok: false, motivo: 'ya_aceptada' };
  if (inv.estado === 'expirada') return { ok: false, motivo: 'expirada' };
  if (inv.estado === 'revocada') return { ok: false, motivo: 'revocada' };
  if (Date.parse(inv.expira_en) <= ahora.getTime()) return { ok: false, motivo: 'expirada' };
  if (!correoDelUsuario || correoDelUsuario.trim().toLowerCase() !== inv.correo.trim().toLowerCase()) {
    return { ok: false, motivo: 'correo_no_coincide' };
  }
  return { ok: true };
}

export function validarInvitacion(body: unknown): Resultado<{ correo: string; rol_en_organizacion: RolEnOrganizacion }> {
  if (!isObj(body)) return { ok: false, error: 'Cuerpo inválido.' };
  for (const k of Object.keys(body)) {
    if (!['correo', 'rol_en_organizacion'].includes(k)) return { ok: false, error: `Campo no admitido: ${k}.` };
  }
  const correo = normalizarCorreo(body.correo);
  if (!correo) return { ok: false, error: 'Correo inválido.' };
  const rol = body.rol_en_organizacion ?? 'miembro';
  if (typeof rol !== 'string' || !(ROLES_EN_ORGANIZACION as ReadonlyArray<string>).includes(rol)) {
    return { ok: false, error: 'rol_en_organizacion inválido.' };
  }
  return { ok: true, data: { correo, rol_en_organizacion: rol as RolEnOrganizacion } };
}

export const INVITACION_MENSAJE: Record<string, string> = {
  invitacion_invalida: 'La invitación no es válida.',
  ya_aceptada: 'Esta invitación ya fue aceptada. Cada invitación sirve una sola vez.',
  expirada: 'La invitación venció. Pida una nueva al equipo.',
  revocada: 'La invitación fue retirada.',
  correo_no_coincide: 'Esta invitación es para otra cuenta de correo.',
  ya_es_miembro: 'Esta cuenta ya pertenece a la organización.',
};
