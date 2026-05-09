import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { checkAuthEnv, logAuthEnvFailure } from '@/lib/authEnv';

const LOGIN_LIMIT     = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    const rateKey = `admin-login:${clientIpFrom(req)}:${String(email).toLowerCase()}`;
    const rate    = checkRateLimit(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta nuevamente en ${Math.ceil(rate.retryAfterSec / 60)} minutos.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    // env.ok now requires url + anonKey + serviceKey (see lib/authEnv.ts).
    // The role lookup below MUST bypass RLS, so the service-role key is
    // mandatory — falling back to the anon client returns 0 rows silently
    // and surfaces "Acceso denegado" indistinguishable from a real role miss.
    const env = checkAuthEnv();
    if (!env.ok) {
      logAuthEnvFailure('admin-login', env);
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta', code: 'SERVER_CONFIG' },
        { status: 500 }
      );
    }
    const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const key        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    // Service-role client for the role lookup. Anon client with
    // persistSession:false has no JWT session context here, so RLS would
    // evaluate auth.uid() = null and the SELECT would return 0 rows.
    const roleClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleRow } = await roleClient
      .from('user_roles')
      .select('rol, activo')
      .eq('user_id', data.user.id)
      .single();

    if (!roleRow || roleRow.rol !== 'admin' || !roleRow.activo) {
      return NextResponse.json({ error: 'Acceso denegado — se requiere rol de administrador' }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true, email: data.user.email });

    const maxAge    = data.session.expires_in ?? 3600;
    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge,
      path: '/',
    };

    // Legacy cookie (kept for existing admin layout guard)
    res.cookies.set('admin-token', data.session.access_token, cookieOpts);
    // Unified auth cookies
    res.cookies.set('auth-token', data.session.access_token, cookieOpts);
    // auth-role must outlive the access token so the proxy guard can still
    // read the role between access-token expiry and the next /refresh call.
    res.cookies.set('auth-role',  'admin', { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set('auth-refresh', data.session.refresh_token, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 30,  // 30 days
    });
    res.cookies.set('user-email', data.user.email ?? '', { ...cookieOpts, httpOnly: false });

    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
