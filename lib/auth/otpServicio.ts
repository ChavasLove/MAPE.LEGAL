// lib/auth/otpServicio.ts — orquestación del acceso por OTP con dependencias
// inyectadas (almacén de control, emisor, canal de correo, canje, limitador,
// reloj). Las rutas /api/auth/otp/* pasan las implementaciones reales
// (lib/auth/otpSupabase.ts); los tests pasan dobles en memoria.
//
// Reglas que este módulo garantiza (probadas en tests/otp.test.ts):
//   1. un solo uso                 5. reenvío con espera + invalidación
//   2. expiración corta            6. sin enumeración de usuarios
//   3. intentos máximos + bloqueo  7. auditoría de intentos SIN el código
//   4. límite de frecuencia por IP y por correo (solicitar y verificar)

import {
  OTP_CONFIG,
  OTP_MENSAJES,
  controlAlEmitir,
  controlTrasIntento,
  esCodigoBienFormado,
  evaluarSolicitud,
  evaluarVerificacion,
  hashCorreo,
  normalizarCorreo,
  type ControlOtp,
} from './otp';

export interface AlmacenOtp {
  obtener(emailHash: string): Promise<ControlOtp | null>;
  /** Reemplaza el control (emisión nueva). */
  guardar(control: ControlOtp): Promise<void>;
  /**
   * Cuenta un intento de forma ATÓMICA y devuelve el control resultante (en la
   * BD: RPC `auth_otp_registrar_intento`). Devuelve null si no hay control.
   */
  registrarIntento(emailHash: string, ahora: Date): Promise<ControlOtp | null>;
  marcarUsado(emailHash: string, ahora: Date): Promise<void>;
}

export type EventoAuditoriaOtp =
  | 'solicitud_emitida' | 'solicitud_sin_cuenta' | 'solicitud_en_espera' | 'solicitud_bloqueada'
  | 'solicitud_limitada' | 'verificacion_ok' | 'verificacion_fallida' | 'verificacion_rechazada'
  | 'verificacion_limitada';

export interface AuditoriaOtp {
  evento: EventoAuditoriaOtp;
  email_hash: string | null;
  ip: string;
  detalle?: string;
}

export interface SesionOtp {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

export interface DependenciasOtp {
  almacen: AlmacenOtp;
  pepper: string;
  ahora(): Date;
  /** Devuelve ok=false al superar el límite. */
  limitar(clave: string, limite: number, ventanaMs: number): { ok: boolean; retryAfterSec: number };
  /** Emite un código para el correo. null = el correo no tiene cuenta (o no se pudo emitir). */
  emitir(correo: string): Promise<{ codigo: string } | null>;
  /** Entrega el código por correo. */
  enviar(correo: string, codigo: string): Promise<void>;
  /** Canjea el código por una sesión. null = código incorrecto. */
  canjear(correo: string, codigo: string): Promise<SesionOtp | null>;
  /** Bitácora de intentos. NUNCA recibe el código. */
  auditar(evento: AuditoriaOtp): void;
}

export type ResultadoSolicitud =
  | { ok: true; mensaje: string; esperaReenvioSeg: number }
  | { ok: false; status: 400 | 429; mensaje: string; retryAfterSec?: number };

/**
 * Solicita un código. La respuesta de éxito es SIEMPRE la misma (mismo cuerpo,
 * mismo valor de espera) exista o no la cuenta, se haya emitido o no.
 */
export async function solicitarOtp(deps: DependenciasOtp, correoCrudo: unknown, ip: string): Promise<ResultadoSolicitud> {
  const correo = normalizarCorreo(correoCrudo);
  if (!correo) return { ok: false, status: 400, mensaje: OTP_MENSAJES.formato };

  const cfg = OTP_CONFIG;
  const emailHash = hashCorreo(correo, deps.pepper);
  const neutra: ResultadoSolicitud = {
    ok: true,
    mensaje: OTP_MENSAJES.solicitud,
    esperaReenvioSeg: Math.ceil(cfg.esperaReenvioMs / 1000),
  };

  const porIp = deps.limitar(`otp:sol:ip:${ip}`, cfg.limiteSolicitudPorIp, cfg.ventanaLimiteMs);
  if (!porIp.ok) {
    deps.auditar({ evento: 'solicitud_limitada', email_hash: emailHash, ip, detalle: 'ip' });
    return { ok: false, status: 429, mensaje: OTP_MENSAJES.frecuencia, retryAfterSec: porIp.retryAfterSec };
  }
  // El límite por correo NO cambia la respuesta (sería un oráculo de existencia
  // de actividad): simplemente no se emite.
  const porCorreo = deps.limitar(`otp:sol:correo:${emailHash}`, cfg.limiteSolicitudPorCorreo, cfg.ventanaLimiteMs);
  if (!porCorreo.ok) {
    deps.auditar({ evento: 'solicitud_limitada', email_hash: emailHash, ip, detalle: 'correo' });
    return neutra;
  }

  const ahora = deps.ahora();
  const control = await deps.almacen.obtener(emailHash);
  const decision = evaluarSolicitud(control, ahora);
  if (!decision.emitir) {
    deps.auditar({
      evento: decision.motivo === 'bloqueado' ? 'solicitud_bloqueada' : 'solicitud_en_espera',
      email_hash: emailHash, ip,
    });
    return neutra;
  }

  // El control se escribe SIEMPRE (también para correos sin cuenta): la espera
  // de reenvío y el bloqueo se comportan igual en ambos casos.
  await deps.almacen.guardar(controlAlEmitir(emailHash, ahora));

  const emitido = await deps.emitir(correo);
  if (!emitido) {
    deps.auditar({ evento: 'solicitud_sin_cuenta', email_hash: emailHash, ip });
    return neutra;
  }
  // El envío no bloquea la respuesta ni altera su forma.
  void deps.enviar(correo, emitido.codigo).catch(() => {
    deps.auditar({ evento: 'solicitud_emitida', email_hash: emailHash, ip, detalle: 'envio_fallido' });
  });
  deps.auditar({ evento: 'solicitud_emitida', email_hash: emailHash, ip });
  return neutra;
}

export type ResultadoVerificacion =
  | { ok: true; sesion: SesionOtp; correo: string }
  | { ok: false; status: 400 | 401 | 429; mensaje: string; retryAfterSec?: number };

/** Verifica un código. Todo rechazo usa mensajes neutros. */
export async function verificarOtp(
  deps: DependenciasOtp, correoCrudo: unknown, codigoCrudo: unknown, ip: string,
): Promise<ResultadoVerificacion> {
  const correo = normalizarCorreo(correoCrudo);
  const codigo = typeof codigoCrudo === 'string' ? codigoCrudo.trim() : codigoCrudo;
  if (!correo || !esCodigoBienFormado(codigo)) return { ok: false, status: 400, mensaje: OTP_MENSAJES.formato };

  const cfg = OTP_CONFIG;
  const emailHash = hashCorreo(correo, deps.pepper);

  const porIp = deps.limitar(`otp:ver:ip:${ip}`, cfg.limiteVerificacionPorIp, cfg.ventanaLimiteMs);
  const porCorreo = deps.limitar(`otp:ver:correo:${emailHash}`, cfg.limiteVerificacionPorCorreo, cfg.ventanaLimiteMs);
  if (!porIp.ok || !porCorreo.ok) {
    deps.auditar({ evento: 'verificacion_limitada', email_hash: emailHash, ip });
    return {
      ok: false, status: 429, mensaje: OTP_MENSAJES.frecuencia,
      retryAfterSec: Math.max(porIp.retryAfterSec, porCorreo.retryAfterSec),
    };
  }

  const ahora = deps.ahora();
  const control = await deps.almacen.obtener(emailHash);
  const previa = evaluarVerificacion(control, ahora);
  if (!previa.proceder) {
    deps.auditar({ evento: 'verificacion_rechazada', email_hash: emailHash, ip, detalle: previa.motivo });
    const bloqueo = previa.motivo === 'bloqueado' || previa.motivo === 'intentos_agotados';
    return { ok: false, status: 401, mensaje: bloqueo ? OTP_MENSAJES.bloqueado : OTP_MENSAJES.invalido };
  }

  // El intento se cuenta ANTES de canjear: dos verificaciones simultáneas no
  // pueden compartir el mismo cupo.
  const contado = await deps.almacen.registrarIntento(emailHash, ahora);
  if (!contado || contado.intentos > cfg.maxIntentos) {
    deps.auditar({ evento: 'verificacion_rechazada', email_hash: emailHash, ip, detalle: 'intentos_agotados' });
    return { ok: false, status: 401, mensaje: OTP_MENSAJES.bloqueado };
  }

  const sesion = await deps.canjear(correo, codigo);
  if (!sesion) {
    deps.auditar({ evento: 'verificacion_fallida', email_hash: emailHash, ip, detalle: `intento_${contado.intentos}` });
    const agotado = contado.intentos >= cfg.maxIntentos;
    return { ok: false, status: 401, mensaje: agotado ? OTP_MENSAJES.bloqueado : OTP_MENSAJES.invalido };
  }

  await deps.almacen.marcarUsado(emailHash, ahora);
  deps.auditar({ evento: 'verificacion_ok', email_hash: emailHash, ip });
  return { ok: true, sesion, correo };
}

/** Almacén en memoria — SOLO tests. Replica la atomicidad del RPC. */
export class AlmacenOtpEnMemoria implements AlmacenOtp {
  private filas = new Map<string, ControlOtp>();
  async obtener(emailHash: string) { return this.filas.get(emailHash) ?? null; }
  async guardar(control: ControlOtp) { this.filas.set(control.email_hash, { ...control }); }
  async registrarIntento(emailHash: string, ahora: Date) {
    const actual = this.filas.get(emailHash);
    if (!actual) return null;
    const nuevo = controlTrasIntento(actual, ahora);
    this.filas.set(emailHash, nuevo);
    return { ...nuevo };
  }
  async marcarUsado(emailHash: string, ahora: Date) {
    const actual = this.filas.get(emailHash);
    if (actual) this.filas.set(emailHash, { ...actual, usado_en: ahora.toISOString() });
  }
}
