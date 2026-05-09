'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Client-side OAuth callback. Supabase can complete OAuth in two shapes:
//   1. Authorization code flow — `?code=...` in the query string (modern
//      default for Supabase projects; required when the project enforces
//      PKCE). Servers must perform the exchange because doing it client-side
//      would either expose the service-role key or require a code_verifier
//      that this page never minted. We forward to /api/auth/callback, which
//      runs `exchangeCodeForSession` and sets cookies in one redirect.
//   2. Implicit flow — `#access_token=...&refresh_token=...` in the URL
//      fragment. Servers can't read fragments, so we extract them here and
//      POST to /api/auth/oauth-session, which validates the JWT and sets
//      cookies.
//
// Before the dual-flow handling: projects on the code flow landed here with
// an empty hash and bounced back to /login?error=Sesion+invalida, which is
// exactly the "accounts created but can't enter dashboard" symptom.
export const dynamic = 'force-dynamic';

function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const oauthError = searchParams.get('error');
      const errorDesc  = searchParams.get('error_description');
      if (oauthError) {
        router.replace(`/login?error=${encodeURIComponent(errorDesc ?? oauthError)}`);
        return;
      }

      // ── Authorization code flow ────────────────────────────────────────
      // Hand off to the server route that exchanges the code for a session
      // and sets the cookie set. window.location.replace (not router.push)
      // because the destination is an API route, not a Next page; replace
      // (not assign) so the callback URL doesn't sit in browser history with
      // the single-use `code` still attached.
      const code = searchParams.get('code');
      if (code && typeof window !== 'undefined') {
        const next = new URL('/api/auth/callback', window.location.origin);
        next.searchParams.set('code', code);
        // Scrub the current entry first so back-button never points at a URL
        // containing the code (mirrors the implicit-flow scrub at line ~93).
        window.history.replaceState({}, '', '/auth/callback');
        window.location.replace(next.toString());
        return;
      }

      // ── Implicit flow ──────────────────────────────────────────────────
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (!hash) {
        router.replace('/login?error=Sesion+invalida');
        return;
      }

      const params       = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresIn    = params.get('expires_in');
      const fragmentErr  = params.get('error_description') ?? params.get('error');
      if (fragmentErr) {
        router.replace(`/login?error=${encodeURIComponent(fragmentErr)}`);
        return;
      }
      if (!accessToken || !refreshToken) {
        router.replace('/login?error=Tokens+faltantes');
        return;
      }

      try {
        const res = await fetch('/api/auth/oauth-session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            access_token:  accessToken,
            refresh_token: refreshToken,
            expires_in:    expiresIn ? Number(expiresIn) : undefined,
          }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          router.replace(`/login?error=${encodeURIComponent(data.error ?? 'Error de sesion')}`);
          return;
        }

        // Strip the access_token from the URL before navigating away so it
        // doesn't sit in browser history.
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname);
        }
        // Defense-in-depth: redirectTo today comes from a server-side allowlist
        // (ROLE_REDIRECT in /api/auth/oauth-session), so it's already safe. The
        // guard below ensures a future regression that lets user input flow
        // into that field can't turn this into an open-redirect.
        const target =
          typeof data.redirectTo === 'string'
            && data.redirectTo.startsWith('/')
            && !data.redirectTo.startsWith('//')
            && !data.redirectTo.startsWith('/\\')
              ? data.redirectTo
              : '/dashboard';
        router.push(target);
        router.refresh();
      } catch (err) {
        if (cancelled) return;
        console.error('[oauth-callback] error:', err);
        router.replace('/login?error=Error+de+conexion');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF9F5' }}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin" style={{ color: '#1F2A38' }} />
        <span className="text-sm" style={{ color: '#5E6B7B' }}>Iniciando sesión…</span>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF9F5' }}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: '#1F2A38' }} />
            <span className="text-sm" style={{ color: '#5E6B7B' }}>Cargando…</span>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
