import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { checkAuthEnv, logAuthEnvFailure } from '@/lib/authEnv';

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

    // Require the service-role key in addition to url+anonKey: the role
    // lookup below MUST bypass RLS, otherwise the anon client returns 0
    // rows (auth.uid() is null without a session) and the route surfaces
    // "Sin rol asignado" — indistinguishable from a real role miss.
    const env = checkAuthEnv();
    if (!env.ok || env.serviceKey !== 'ok') {
      logAuthEnvFailure('login', env);
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta', code: 'SERVER_CONFIG' },
        { status: 500 }
      );
    }
    const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

    // Authenticate with anon client (validates credentials via Supabase Auth)
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    // Block login until the user has confirmed their email. The login page
    // reads `code: 'EMAIL_NOT_CONFIRMED'` to render a "Reenviar correo" button.
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

    // Fetch role using service role client to bypass RLS — this is safe because:
    // 1. We have already authenticated the user above
    // 2. This code runs server-side only (API route)
    // The anon client cannot be used here: with persistSession: false there
    // is no JWT session context, so auth.uid() is null in RLS and the
    // "Users can read own role" policy never matches. The env-var guard
    // above ensures serviceKey is always present at this point.
    const roleClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleRow, error: roleError } = await roleClient
      .from('user_roles')
      .select('rol, activo')
      .eq('user_id', data.user.id)
      .single();

    let role: string;

    if (!roleRow) {
      // Forensic logging — capture full PostgREST error context so a future
      // miss is diagnosable from Vercel function logs alone (PGRST116 = no
      // rows, 42501 = permission denied, 42P17 = recursive policy, etc.).
      console.error('[login] user_roles miss', {
        user_id: data.user.id,
        email:   data.user.email,
        code:    roleError?.code,
        message: roleError?.message,
        details: (roleError as { details?: string } | null)?.details,
        hint:    (roleError as { hint?: string }    | null)?.hint,
      });

      // Distinguish a real DB failure (RLS recursion, permission denied,
      // network hiccup) from PGRST116 "no rows found". On a real failure,
      // surfacing the code helps the operator instead of confusing them with
      // "Sin rol asignado" which suggests user-level misconfiguration.
      if (roleError && roleError.code !== 'PGRST116') {
        return NextResponse.json(
          {
            error: `Error de base de datos (${roleError.code}) — contacte al administrador`,
            code:  roleError.code,
          },
          { status: 500 }
        );
      }

      // PGRST116 / null row → self-heal with default 'cliente' role. Same
      // pattern as oauth-session and callback. The PGRST116 guard above
      // confirms no row exists, so the upsert (without ignoreDuplicates)
      // can't demote an existing admin to cliente.
      const { error: upsertErr } = await roleClient
        .from('user_roles')
        .upsert(
          { user_id: data.user.id, rol: 'cliente', activo: true },
          { onConflict: 'user_id' }
        );

      if (upsertErr) {
        console.error('[login] user_roles fallback upsert failed:', upsertErr);
        return NextResponse.json(
          { error: 'Sin rol asignado — contacte al administrador' },
          { status: 403 }
        );
      }

      role = 'cliente';
    } else {
      if (!roleRow.activo) {
        return NextResponse.json({ error: 'Cuenta inactiva — contacte al administrador' }, { status: 403 });
      }
      role = roleRow.rol as string;
    }

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

    // Backward-compat: keep admin-token for existing admin layout guard
    if (role === 'admin') {
      res.cookies.set('admin-token', data.session.access_token, cookieOpts);
    }

    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
