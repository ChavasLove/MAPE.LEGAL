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

// GET /api/auth/callback — OAuth callback handler.
// Supabase redirects here after Google (or other provider) auth with `?code=`.
// We exchange the code for a session, set our cookie set, and redirect by role.
//
// Reached via two paths:
//   - Direct: when Supabase is configured to redirect OAuth straight to a
//     server route (`?code=...` in query)
//   - Forwarded: from app/auth/callback/page.tsx when the client page detects
//     a `?code=` (modern code flow) and bounces here so the exchange runs
//     server-side
//
// Role lookup goes through the SECURITY DEFINER RPC (lib/userRoleLookup.ts)
// so it works regardless of `service_role.rolbypassrls` state on the
// Supabase project.
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

    const env = checkAuthEnv();
    if (!env.ok) {
      logAuthEnvFailure('auth/callback', env);
      return NextResponse.redirect(new URL('/login?error=Configuracion+de+servidor+incompleta', req.url));
    }
    const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

    // Exchange code for session.
    //
    // Note on PKCE: the OAuth flow is initiated in app/login/page.tsx by
    // hitting /auth/v1/authorize directly (no `code_challenge` param), which
    // tells Supabase to use the non-PKCE OAuth code flow — the exchange
    // below works without a verifier. If a future change initiates OAuth via
    // supabase-js's `signInWithOAuth` (which adds PKCE), the code_verifier
    // would need to round-trip via cookies (e.g., `@supabase/ssr`) for this
    // exchange to succeed. The full sessionError is logged below so a PKCE
    // mismatch surfaces in Vercel logs as `invalid_grant` rather than the
    // generic redirect message.
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !data.session) {
      console.error('[auth/callback] Session exchange failed', {
        message: sessionError?.message,
        status:  sessionError?.status,
        name:    sessionError?.name,
      });
      return NextResponse.redirect(new URL('/login?error=Sesion+invalida', req.url));
    }

    const user = data.session.user;

    const roleClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const lookup = await lookupUserRole(roleClient, user.id, 'auth/callback');

    if (!lookup.ok) {
      if (lookup.reason === 'inactive') {
        return NextResponse.redirect(new URL('/login?error=Cuenta+inactiva', req.url));
      }
      if (lookup.reason === 'db_error') {
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(`Error de base de datos (${lookup.errorCode ?? '?'})`)}`, req.url)
        );
      }
      return NextResponse.redirect(new URL('/login?error=Sin+rol+asignado', req.url));
    }

    const role         = lookup.role;
    const redirectTo   = ROLE_REDIRECT[role] ?? '/dashboard';
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

    return res;
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err);
    return NextResponse.redirect(new URL('/login?error=Error+interno', req.url));
  }
}
