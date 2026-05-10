import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAuthEnv, logAuthEnvFailure } from '@/lib/authEnv';
import { lookupUserRole } from '@/lib/userRoleLookup';

const ROLE_REDIRECT: Record<string, string> = {
  admin:             '/admin',
  abogado:           '/dashboard',
  tecnico_ambiental: '/dashboard',
  cliente:           '/portal',
};

// POST /api/auth/oauth-session — completes the OAuth flow.
//
// The /auth/callback client page extracts access_token + refresh_token from
// the URL fragment Supabase appends after Google auth (implicit-flow style),
// and posts them here. We validate the JWT, look up the role via the
// SECURITY DEFINER RPC (lib/userRoleLookup.ts), and set the same cookie set
// used by /api/auth/login (auth-token, auth-role 30d, auth-refresh 30d,
// user-email).
//
// Trigger 015 inserts `user_roles` rows on auth.users INSERT (default
// 'cliente'). The lookup helper falls back to inserting that default if
// the row is somehow missing, so the OAuth flow doesn't dead-end.
export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token, expires_in } = await req.json();

    if (!access_token || typeof access_token !== 'string') {
      return NextResponse.json({ error: 'Token de acceso requerido' }, { status: 400 });
    }
    if (!refresh_token || typeof refresh_token !== 'string') {
      return NextResponse.json({ error: 'Refresh token requerido' }, { status: 400 });
    }

    const env = checkAuthEnv();
    if (!env.ok) {
      logAuthEnvFailure('oauth-session', env);
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta', code: 'SERVER_CONFIG' },
        { status: 500 }
      );
    }
    const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

    // Validate JWT against Supabase Auth.
    const validator = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: userRes, error: userErr } = await validator.auth.getUser(access_token);
    if (userErr || !userRes?.user) {
      console.error('[oauth-session] token validation failed:', userErr?.message);
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    const user = userRes.user;

    const roleClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const lookup = await lookupUserRole(roleClient, user.id, 'oauth-session');

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
      return NextResponse.json({ error: 'Sin rol asignado — contacte al administrador' }, { status: 403 });
    }

    const role         = lookup.role;
    const redirectTo   = ROLE_REDIRECT[role] ?? '/dashboard';
    const accessMaxAge = Number.isFinite(expires_in) && expires_in > 0 ? Number(expires_in) : 3600;

    const cookieOpts = {
      httpOnly: true as const,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge:   accessMaxAge,
      path:     '/',
    };

    const res = NextResponse.json({ ok: true, role, redirectTo });
    res.cookies.set('auth-token',   access_token,  cookieOpts);
    // auth-role outlives the access token so the proxy guard can read it
    // between expiry and the next /refresh call.
    res.cookies.set('auth-role',    role, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set('auth-refresh', refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set('user-email',   user.email ?? '', { ...cookieOpts, httpOnly: false });

    return res;
  } catch (err) {
    console.error('[oauth-session] unexpected:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
