// lib/auth/otpSupabase.ts — implementaciones REALES de las dependencias del OTP
// (SERVER-ONLY). Los clientes de Supabase se crean dentro de las funciones,
// nunca a nivel de módulo.
//
// Opción A: el código lo emite Supabase Auth (`generateLink` devuelve
// `email_otp`) y lo canjea `verifyOtp`, que entrega la sesión. La plataforma no
// fabrica tokens ni guarda el código.
//
// PENDIENTE DE PRUEBA contra un proyecto real (no hay Supabase en el entorno de
// desarrollo): tipo de verificación 'email' para el código de `generateLink`
// ('magiclink'), y longitud/vigencia del código en los ajustes del proyecto.
// Ver docs/reestructura/runbook-aplicacion.md §OTP.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/services/adminSupabase';
import { emailCodigoAcceso } from '@/services/emailService';
import { checkRateLimit } from '@/lib/rateLimit';
import { OTP_CONFIG, OTP_PEPPER_ENV, type ControlOtp } from './otp';
import type { AlmacenOtp, AuditoriaOtp, DependenciasOtp, SesionOtp } from './otpServicio';

const COLUMNAS = 'email_hash, emitido_en, expira_en, intentos, usado_en, bloqueado_hasta';

function aControl(fila: unknown): ControlOtp | null {
  if (!fila || typeof fila !== 'object') return null;
  const f = fila as Record<string, unknown>;
  if (typeof f.email_hash !== 'string' || typeof f.emitido_en !== 'string' || typeof f.expira_en !== 'string') return null;
  return {
    email_hash: f.email_hash,
    emitido_en: f.emitido_en,
    expira_en: f.expira_en,
    intentos: Number(f.intentos ?? 0),
    usado_en: typeof f.usado_en === 'string' ? f.usado_en : null,
    bloqueado_hasta: typeof f.bloqueado_hasta === 'string' ? f.bloqueado_hasta : null,
  };
}

/** Almacén sobre `auth_otp_control` (migración 045). Lanza si la base falla: la ruta responde 503. */
export function almacenOtpSupabase(admin: SupabaseClient): AlmacenOtp {
  return {
    async obtener(emailHash) {
      const { data, error } = await admin.from('auth_otp_control').select(COLUMNAS).eq('email_hash', emailHash).maybeSingle();
      if (error) throw new ErrorAlmacenOtp(error.code ?? 'desconocido');
      return aControl(data);
    },
    async guardar(control) {
      const { error } = await admin.from('auth_otp_control')
        .upsert({ ...control, updated_at: new Date().toISOString() }, { onConflict: 'email_hash' });
      if (error) throw new ErrorAlmacenOtp(error.code ?? 'desconocido');
    },
    async registrarIntento(emailHash) {
      const { data, error } = await admin.rpc('auth_otp_registrar_intento', {
        p_email_hash: emailHash,
        p_max_intentos: OTP_CONFIG.maxIntentos,
        p_bloqueo_seg: Math.ceil(OTP_CONFIG.bloqueoMs / 1000),
      });
      if (error) throw new ErrorAlmacenOtp(error.code ?? 'desconocido');
      return aControl(Array.isArray(data) ? data[0] : data);
    },
    async marcarUsado(emailHash, ahora) {
      const { error } = await admin.from('auth_otp_control')
        .update({ usado_en: ahora.toISOString(), updated_at: ahora.toISOString() })
        .eq('email_hash', emailHash);
      if (error) throw new ErrorAlmacenOtp(error.code ?? 'desconocido');
    },
  };
}

export class ErrorAlmacenOtp extends Error {
  constructor(readonly codigo: string) {
    super(`almacén de OTP no disponible (${codigo})`);
  }
}

/** Dependencias reales. Devuelve null si falta configuración (la ruta responde 500 SERVER_CONFIG). */
export function dependenciasOtpReales(): DependenciasOtp | null {
  const pepper = process.env[OTP_PEPPER_ENV]?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!pepper || pepper.length < 16 || !url || !anonKey) return null;

  let admin: SupabaseClient;
  try {
    admin = getAdminClient();
  } catch {
    return null;
  }

  const auditar = (e: AuditoriaOtp): void => {
    // Jamás se registra el código ni el correo en claro.
    void Promise.resolve(admin.from('auth_otp_auditoria').insert({
      evento: e.evento, email_hash: e.email_hash, ip: e.ip, detalle: e.detalle ?? null,
    })).then(({ error }) => {
      if (error) console.warn('[otp] auditoría no registrada:', error.code);
    }).catch(() => { /* no fatal */ });
  };

  return {
    almacen: almacenOtpSupabase(admin),
    pepper,
    ahora: () => new Date(),
    limitar: (clave, limite, ventanaMs) => checkRateLimit(clave, limite, ventanaMs),
    auditar,

    async emitir(correo) {
      // Solo se emite para cuentas que ya existen: la emisión no crea usuarios.
      const { data: userId, error: existeErr } = await admin.rpc('auth_usuario_id_por_correo', { p_email: correo });
      if (existeErr) throw new ErrorAlmacenOtp(existeErr.code ?? 'desconocido');
      if (!userId) return null;
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: correo });
      const codigo = data?.properties?.email_otp;
      if (error || !codigo) {
        console.error('[otp] no se pudo emitir el código:', error?.status ?? 'sin_codigo');
        return null;
      }
      return { codigo };
    },

    async enviar(correo, codigo) {
      await emailCodigoAcceso(correo, codigo, Math.round(OTP_CONFIG.expiraMs / 60000));
    },

    async canjear(correo, codigo): Promise<SesionOtp | null> {
      const publico = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await publico.auth.verifyOtp({ email: correo, token: codigo, type: 'email' });
      if (error || !data.session || !data.user) return null;
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in ?? 3600,
        userId: data.user.id,
      };
    },
  };
}
