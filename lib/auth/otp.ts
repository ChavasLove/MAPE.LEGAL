// lib/auth/otp.ts — acceso por código de un solo uso (OTP) enviado al correo.
// Módulo PURO (sin Supabase, sin Next): configuración, utilidades criptográficas
// y la máquina de decisiones que usan las rutas /api/auth/otp/*. Se prueba sin
// base de datos en tests/otp.test.ts.
//
// DISEÑO — Opción A (reestructura 2026-11-28, Fase 2): el código lo emite y lo
// canjea Supabase Auth (`auth.admin.generateLink` devuelve `email_otp`;
// `auth.verifyOtp` lo consume y entrega la sesión). La plataforma NO guarda el
// código, ni en claro ni como hash. Encima va un control propio (tabla
// `auth_otp_control`, migración 045) porque Supabase no limita los intentos por
// código ni ofrece un reenvío con espera:
//   · un solo uso      → `usado_en` (además del consumo del lado de Supabase)
//   · expiración corta → `expira_en` propio; no depende del ajuste del proyecto
//   · intentos máximos → `intentos` con bloqueo temporal
//   · reenvío          → espera mínima; emitir invalida el código anterior
//   · sin enumeración  → la fila de control se identifica por HMAC del correo
//     (con pepper) y existe también para correos sin cuenta; toda respuesta de
//     solicitud es idéntica.
//
// [POR CONFIRMAR — WILLIS] los cuatro valores de OTP_CONFIG son propuesta.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Único lugar donde viven los parámetros del OTP. */
export const OTP_CONFIG = {
  /** Dígitos del código. Debe coincidir con el ajuste "Email OTP Length" del proyecto en Supabase. */
  longitud: 6,
  /** Vigencia del código desde su emisión. */
  expiraMs: 10 * 60 * 1000,
  /** Intentos de verificación por código antes del bloqueo. */
  maxIntentos: 5,
  /** Espera mínima entre dos emisiones al mismo correo. */
  esperaReenvioMs: 60 * 1000,
  /** Duración del bloqueo tras agotar los intentos. */
  bloqueoMs: 15 * 60 * 1000,
  /** Límites de frecuencia (ventana de 15 minutos). */
  limiteSolicitudPorIp: 10,
  limiteSolicitudPorCorreo: 5,
  limiteVerificacionPorIp: 20,
  limiteVerificacionPorCorreo: 10,
  ventanaLimiteMs: 15 * 60 * 1000,
} as const;

/** Nombre de la variable de entorno del pepper (solo el nombre; nunca el valor). */
export const OTP_PEPPER_ENV = 'AUTH_OTP_PEPPER';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Correo en forma canónica (trim + minúsculas) o null si no es válido. */
export function normalizarCorreo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.trim().toLowerCase();
  if (v.length === 0 || v.length > 254 || !EMAIL_RE.test(v)) return null;
  return v;
}

/** Código con el formato esperado (solo dígitos, longitud exacta). */
export function esCodigoBienFormado(valor: unknown, longitud: number = OTP_CONFIG.longitud): valor is string {
  return typeof valor === 'string' && valor.length === longitud && /^\d+$/.test(valor);
}

/** HMAC-SHA256 del correo normalizado. Identifica la fila de control sin guardar el correo. */
export function hashCorreo(correoNormalizado: string, pepper: string): string {
  if (!pepper || pepper.length < 16) throw new Error('pepper ausente o demasiado corto');
  return createHmac('sha256', pepper).update(`otp:correo:${correoNormalizado}`, 'utf8').digest('hex');
}

/**
 * Código numérico aleatorio (CSPRNG). Solo lo usa el emisor de PRUEBAS y el
 * relleno de tiempo para correos sin cuenta: en producción el código lo genera
 * Supabase Auth.
 */
export function generarCodigo(longitud: number = OTP_CONFIG.longitud): string {
  let out = '';
  for (let i = 0; i < longitud; i++) out += String(randomInt(0, 10));
  return out;
}

/** Comparación en tiempo constante de dos cadenas (hex, códigos, tokens). */
export function igualesTiempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // Compara contra sí mismo para no revelar la diferencia de longitud por tiempo.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/* ── Estado de control ──────────────────────────────────────────────────── */

/** Fila de `auth_otp_control` (045). Fechas ISO. Nunca contiene el código. */
export interface ControlOtp {
  email_hash: string;
  emitido_en: string;
  expira_en: string;
  intentos: number;
  usado_en: string | null;
  bloqueado_hasta: string | null;
}

export type DecisionSolicitud =
  | { emitir: true }
  | { emitir: false; motivo: 'espera_reenvio' | 'bloqueado'; esperaSeg: number };

/** ¿Se puede emitir un código nuevo ahora? */
export function evaluarSolicitud(control: ControlOtp | null, ahora: Date, cfg = OTP_CONFIG): DecisionSolicitud {
  if (!control) return { emitir: true };
  const t = ahora.getTime();
  if (control.bloqueado_hasta) {
    const hasta = Date.parse(control.bloqueado_hasta);
    if (hasta > t) return { emitir: false, motivo: 'bloqueado', esperaSeg: Math.ceil((hasta - t) / 1000) };
  }
  const desde = Date.parse(control.emitido_en);
  const restante = desde + cfg.esperaReenvioMs - t;
  if (restante > 0) return { emitir: false, motivo: 'espera_reenvio', esperaSeg: Math.ceil(restante / 1000) };
  return { emitir: true };
}

export type MotivoRechazo = 'sin_codigo' | 'usado' | 'expirado' | 'intentos_agotados' | 'bloqueado';

export type DecisionVerificacion = { proceder: true } | { proceder: false; motivo: MotivoRechazo };

/** ¿Se puede intentar canjear un código ahora? No consulta el código: solo el control. */
export function evaluarVerificacion(control: ControlOtp | null, ahora: Date, cfg = OTP_CONFIG): DecisionVerificacion {
  if (!control) return { proceder: false, motivo: 'sin_codigo' };
  const t = ahora.getTime();
  if (control.bloqueado_hasta && Date.parse(control.bloqueado_hasta) > t) return { proceder: false, motivo: 'bloqueado' };
  if (control.usado_en) return { proceder: false, motivo: 'usado' };
  if (Date.parse(control.expira_en) <= t) return { proceder: false, motivo: 'expirado' };
  if (control.intentos >= cfg.maxIntentos) return { proceder: false, motivo: 'intentos_agotados' };
  return { proceder: true };
}

/** Control nuevo al emitir: reinicia intentos y uso (invalida el código anterior). */
export function controlAlEmitir(emailHash: string, ahora: Date, cfg = OTP_CONFIG): ControlOtp {
  return {
    email_hash: emailHash,
    emitido_en: ahora.toISOString(),
    expira_en: new Date(ahora.getTime() + cfg.expiraMs).toISOString(),
    intentos: 0,
    usado_en: null,
    bloqueado_hasta: null,
  };
}

/** Control tras un intento fallido (el intento ya contado). Bloquea al agotar. */
export function controlTrasIntento(control: ControlOtp, ahora: Date, cfg = OTP_CONFIG): ControlOtp {
  const intentos = control.intentos + 1;
  return {
    ...control,
    intentos,
    bloqueado_hasta: intentos >= cfg.maxIntentos ? new Date(ahora.getTime() + cfg.bloqueoMs).toISOString() : control.bloqueado_hasta,
  };
}

/* ── Mensajes neutros (no revelan si el correo existe) ──────────────────── */

export const OTP_MENSAJES = {
  solicitud: 'Si el correo tiene acceso a la plataforma, recibirá un código en los próximos minutos.',
  invalido: 'Código inválido o vencido. Solicite un código nuevo.',
  bloqueado: 'Demasiados intentos. Espere unos minutos y solicite un código nuevo.',
  frecuencia: 'Demasiadas solicitudes. Intente de nuevo más tarde.',
  formato: 'Revise el correo y el código ingresados.',
} as const;
