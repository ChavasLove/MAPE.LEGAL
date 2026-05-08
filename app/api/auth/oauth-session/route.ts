import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
// and posts them here. We validate the JWT, look up the role, and set the
// same cookie set used by /api/auth/login (auth-token, auth-role 30d,
// auth-refresh 30d, user-email, plus admin-token if role = admin).
//
// `user_roles` is created automatically by trigger 015 (default 'cliente'),
// so we only ever read it here.
export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token, expires_in } = await req.json();

    if (!access_token || typeof access_token !== 'string') {
      return NextResponse.json({ error: 'Token de acceso requerido' }, { status: 400 });
    }
    if (!refresh_token || typeof refresh_token !== 'string') {
      return NextResponse.json({ error: 'Refresh token requerido' }, { status: 400 });
    }

    const url     = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 });
    }

    // Validate JWT against Supabase Auth.
    const validator = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: userRes, error: userErr } = await validator.auth.getUser(access_token);
    if (userErr || !userRes?.user) {
      console.error('[oauth-session] token validation failed:', userErr?.message);
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    const user = userRes.user;

    // Look up role with the service-role client to bypass RLS — JWT context
    // doesn't always propagate when persistSession is off.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const roleClient = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : validator;

    const { data: roleRow, error: roleErr } = await roleClient
      .from('user_roles')
      .select('rol, activo')
      .eq('user_id', user.id)
      .single();

    if (roleErr || !roleRow) {
      console.error('[oauth-session] user_roles lookup failed:', roleErr?.message);
      return NextResponse.json({ error: 'Sin rol asignado — contacte al administrador' }, { status: 403 });
    }
    if (!roleRow.activo) {
      return NextResponse.json({ error: 'Cuenta inactiva — contacte al administrador' }, { status: 403 });
    }

    const role         = roleRow.rol as string;
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

    if (role === 'admin') {
      res.cookies.set('admin-token', access_token, cookieOpts);
    }

    return res;
  } catch (err) {
    console.error('[oauth-session] unexpected:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
