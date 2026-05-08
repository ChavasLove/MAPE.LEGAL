import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ROLE_REDIRECT: Record<string, string> = {
  admin:             '/admin',
  abogado:           '/dashboard',
  tecnico_ambiental: '/dashboard',
  cliente:           '/portal',
};

// GET /api/auth/callback — OAuth callback handler.
// Supabase redirects here after Google (or other provider) auth with `?code=`.
// We exchange the code for a session, set our cookie set, and redirect by role.
//
// Note: trigger `on_auth_user_created` (migration 015) auto-creates a
// `user_roles` row defaulted to `cliente`. We never insert here — we just read.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code             = searchParams.get('code');
    const oauthError       = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (oauthError) {
      console.error('[auth/callback] OAuth error:', oauthError, errorDescription);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription ?? oauthError)}`, req.url)
      );
    }
    if (!code) {
      return NextResponse.redirect(new URL('/login?error=Codigo+de+autenticacion+faltante', req.url));
    }

    const url     = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anonKey) {
      return NextResponse.redirect(new URL('/login?error=Configuracion+de+servidor+incompleta', req.url));
    }

    // Exchange code for session
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !data.session) {
      console.error('[auth/callback] Session exchange failed:', sessionError?.message);
      return NextResponse.redirect(new URL('/login?error=Sesion+invalida', req.url));
    }

    const user       = data.session.user;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    // Service-role client is used for the role lookup so RLS cannot silently
    // hide the row when the access-token JWT context isn't propagated.
    const roleClient = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

    const { data: roleRow, error: roleErr } = await roleClient
      .from('user_roles')
      .select('rol, activo')
      .eq('user_id', user.id)
      .single();

    if (roleErr || !roleRow) {
      // Trigger 015 should always populate this row; if it didn't, fail loud
      // so an admin can diagnose, rather than silently elevating to a default.
      console.error('[auth/callback] user_roles lookup failed:', roleErr?.message);
      return NextResponse.redirect(new URL('/login?error=Sin+rol+asignado', req.url));
    }

    if (!roleRow.activo) {
      return NextResponse.redirect(new URL('/login?error=Cuenta+inactiva', req.url));
    }

    const role       = roleRow.rol as string;
    const redirectTo = ROLE_REDIRECT[role] ?? '/dashboard';
    const accessMaxAge = data.session.expires_in ?? 3600;

    const cookieOpts = {
      httpOnly: true as const,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge:   accessMaxAge,
      path:     '/',
    };

    const res = NextResponse.redirect(new URL(redirectTo, req.url));
    res.cookies.set('auth-token',   data.session.access_token,  cookieOpts);
    // auth-role outlives the access token so the proxy guard can read the role
    // between access-token expiry and the next /refresh call.
    res.cookies.set('auth-role',    role, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set('auth-refresh', data.session.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    // Non-httpOnly so the client can read it for display only — never trusted for auth.
    res.cookies.set('user-email',   user.email ?? '', { ...cookieOpts, httpOnly: false });

    if (role === 'admin') {
      res.cookies.set('admin-token', data.session.access_token, cookieOpts);
    }

    return res;
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err);
    return NextResponse.redirect(new URL('/login?error=Error+interno', req.url));
  }
}
