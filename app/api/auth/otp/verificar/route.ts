// POST /api/auth/otp/verificar — canjea el código por una sesión y deja las
// mismas cookies que el acceso con contraseña. Mensajes neutros ante todo
// rechazo; el código nunca se registra.

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIpFrom } from '@/lib/rateLimit';
import { checkAuthEnv, logAuthEnvFailure } from '@/lib/authEnv';
import { lookupUserRole } from '@/lib/userRoleLookup';
import { verificarOtp } from '@/lib/auth/otpServicio';
import { dependenciasOtpReales } from '@/lib/auth/otpSupabase';
import { destinoPorRol, establecerCookiesSesion } from '@/lib/auth/sesionCookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { email, codigo } = (body ?? {}) as { email?: unknown; codigo?: unknown };

  const env = checkAuthEnv();
  const deps = env.ok ? dependenciasOtpReales() : null;
  if (!env.ok || !deps) {
    if (!env.ok) logAuthEnvFailure('otp/verificar', env);
    else console.error('[otp/verificar] configuración incompleta (pepper)');
    return NextResponse.json({ error: 'Configuración de servidor incompleta', code: 'SERVER_CONFIG' }, { status: 500 });
  }

  try {
    const r = await verificarOtp(deps, email, codigo, clientIpFrom(req));
    if (!r.ok) {
      return NextResponse.json(
        { error: r.mensaje },
        { status: r.status, headers: r.retryAfterSec ? { 'Retry-After': String(r.retryAfterSec) } : undefined },
      );
    }

    const roleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const lookup = await lookupUserRole(roleClient, r.sesion.userId, 'otp/verificar');
    if (!lookup.ok) {
      const inactiva = lookup.reason === 'inactive';
      return NextResponse.json(
        { error: inactiva ? 'Cuenta inactiva — contacte al administrador' : 'Sin rol asignado — contacte al administrador' },
        { status: 403 },
      );
    }

    const res = NextResponse.json({ ok: true, role: lookup.role, redirectTo: destinoPorRol(lookup.role) });
    establecerCookiesSesion(res, r.sesion, lookup.role, r.correo);
    return res;
  } catch (err) {
    console.error('[otp/verificar] no disponible:', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ error: 'El acceso por código no está disponible en este momento.', code: 'OTP_NO_DISPONIBLE' }, { status: 503 });
  }
}
