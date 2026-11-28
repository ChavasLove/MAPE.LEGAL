// lib/auth/sesionCookies.ts — destino por rol y cookies de sesión. Fuente única
// compartida por el acceso con contraseña (/api/auth/login) y el acceso por
// código (/api/auth/otp/verificar), para que ambos dejen la MISMA sesión.

import type { NextResponse } from 'next/server';
import type { Role } from '@/lib/userRoleLookup';

export const ROLE_REDIRECT: Record<Role, string> = {
  admin:             '/admin',
  abogado:           '/dashboard',
  tecnico_ambiental: '/dashboard',
  cliente:           '/portal',
  comercializador:   '/dashboard/cadena',
  planta:            '/dashboard/cadena',
  auditor:           '/dashboard/cadena',
  // Personal de la reestructura 2026-11-28.
  verificador:       '/dashboard/aprobaciones',
  recepcion:         '/dashboard/recepcion',
};

export function destinoPorRol(rol: string): string {
  return (ROLE_REDIRECT as Record<string, string>)[rol] ?? '/dashboard';
}

export interface SesionParaCookies {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TREINTA_DIAS = 60 * 60 * 24 * 30;

/** Fija auth-token, auth-role, auth-refresh y user-email (mismas reglas que el login). */
export function establecerCookiesSesion(res: NextResponse, sesion: SesionParaCookies, rol: Role, correo: string): void {
  const maxAge = sesion.expiresIn > 0 ? sesion.expiresIn : 3600;
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
  res.cookies.set('auth-token', sesion.accessToken, base);
  // auth-role vive más que el access token: es solo una pista para proxy.ts.
  res.cookies.set('auth-role', rol, { ...base, maxAge: TREINTA_DIAS });
  res.cookies.set('auth-refresh', sesion.refreshToken, { ...base, maxAge: TREINTA_DIAS });
  // Legible por el cliente solo para mostrarlo; nunca se confía para autorizar.
  res.cookies.set('user-email', correo, { ...base, httpOnly: false });
}
