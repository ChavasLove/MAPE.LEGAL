import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { checkAuthEnv, logAuthEnvFailure } from '@/lib/authEnv';
import { lookupUserRole } from '@/lib/userRoleLookup';

const ROLE_REDIRECT: Record<string, string> = {
  admin:             '/admin',
  abogado:           '/dashboard',
  tecnico_ambiental: '/dashboard',
  cliente:           '/portal',
};

const LOGIN_LIMIT       = 5;
const LOGIN_WINDOW_MS   = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 });
    }

    const rateKey = `login:${clientIpFrom(req)}:${String(email).toLowerCase()}`;
    const rate    = checkRateLimit(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta nuevamente en ${Math.ceil(rate.retryAfterSec / 60)} minutos.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    const env = checkAuthEnv();
    if (!env.ok) {
      logAuthEnvFailure('login', env);
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta', code: 'SERVER_CONFIG' },
        { status: 500 }
      );
    }
    const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    if (!data.user.email_confirmed_at) {
      return NextResponse.json(
        {
          error: 'Confirma tu correo antes de iniciar sesión.',
          code:  'EMAIL_NOT_CONFIRMED',
          email,
        },
        { status: 403 }
      );
    }

    const roleClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const lookup = await lookupUserRole(roleClient, data.user.id, 'login');

    if (!lookup.ok) {
      if (lookup.reason === 'inactive') {
        return NextResponse.json({ error: 'Cuenta inactiva — contacte al administrador' }, { status: 403 });
      }
      if (lookup.reason === 'db_error') {
        return NextResponse.json(
          {
            error: `Error de base de datos (${lookup.errorCode ?? '?'}) — contacte al administrador`,
            code:  lookup.errorCode,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Sin rol asignado — contacte al administrador' },
        { status: 403 }
      );
    }

    const role       = lookup.role;
    const redirectTo = ROLE_REDIRECT[role] ?? '/dashboard';
    const maxAge     = data.session.expires_in ?? 3600;

    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge,
      path: '/',
    };

    const res = NextResponse.json({ ok: true, role, redirectTo });
    res.cookies.set('auth-token', data.session.access_token, cookieOpts);
    // auth-role must outlive the access token so the proxy guard can still
    // read the role between access-token expiry and the next /refresh call.
    res.cookies.set('auth-role',  role, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    // Long-lived refresh token — used by /api/auth/refresh to mint a new access token
    res.cookies.set('auth-refresh', data.session.refresh_token, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 30,  // 30 days
    });
    // Non-httpOnly so the client can read it for display purposes only — not trusted for auth
    res.cookies.set('user-email', email, { ...cookieOpts, httpOnly: false });

    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
