import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/auth/refresh — exchanges the auth-refresh cookie for a new access
// token and rotates both cookies. Called by client-side hooks ahead of
// expiry to keep dashboard sessions alive past the 1-hour Supabase JWT TTL.
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('auth-refresh')?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 });
  }

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    // Refresh token expired or revoked — force re-login by clearing cookies
    const res = NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    for (const name of ['auth-token', 'auth-role', 'auth-refresh', 'user-email', 'admin-token']) {
      res.cookies.set(name, '', { maxAge: 0, path: '/' });
    }
    return res;
  }

  const role    = req.cookies.get('auth-role')?.value ?? 'cliente';
  const maxAge  = data.session.expires_in ?? 3600;
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };

  const res = NextResponse.json({ ok: true, expires_in: maxAge });
  res.cookies.set('auth-token', data.session.access_token, cookieOpts);
  res.cookies.set('auth-refresh', data.session.refresh_token, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 30,
  });
  if (role === 'admin') {
    res.cookies.set('admin-token', data.session.access_token, cookieOpts);
  }
  return res;
}
