'use client';

import { useEffect, useState, Suspense } from 'react';
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
// Defensive layers (added after a "stuck on /auth/callback" report):
//   - 15s AbortController on the implicit-flow fetch so it can never hang
//   - At 8s, render a visible "tomó más de lo normal" message + manual link
//   - At 20s, hard redirect to /login?error=Tiempo+de+espera+excedido
//   - Post-success: window.location.assign() instead of router.push() — the
//     destination is a server-rendered protected layout, and a hard nav
//     guarantees the just-set cookies travel with the request (sidesteps
//     any client-router cache race)
//   - console.log checkpoints so the rama taken is visible in DevTools
export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT_MS    = 15_000;
const STUCK_UI_DELAY_MS   =  8_000;
const HARD_GIVEUP_MS      = 20_000;

function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [showStuck, setShowStuck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => { if (!cancelled) setShowStuck(true); }, STUCK_UI_DELAY_MS));
    timers.push(setTimeout(() => {
      if (cancelled) return;
      console.warn('[oauth-callback] hard giveup — redirecting to /login');
      window.location.replace('/login?error=Tiempo+de+espera+excedido');
    }, HARD_GIVEUP_MS));

    async function run() {
      const oauthError = searchParams.get('error');
      const errorDesc  = searchParams.get('error_description');
      if (oauthError) {
        console.warn('[oauth-callback] oauth error in query', { oauthError, errorDesc });
        router.replace(`/login?error=${encodeURIComponent(errorDesc ?? oauthError)}`);
        return;
      }

      // ── Authorization code flow ────────────────────────────────────────
      const code = searchParams.get('code');
      if (code && typeof window !== 'undefined') {
        console.log('[oauth-callback] code-flow → forwarding to /api/auth/callback');
        const next = new URL('/api/auth/callback', window.location.origin);
        next.searchParams.set('code', code);
        // Scrub the current entry first so back-button never points at a URL
        // containing the code.
        window.history.replaceState({}, '', '/auth/callback');
        window.location.replace(next.toString());
        return;
      }

      // ── Implicit flow ──────────────────────────────────────────────────
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (!hash) {
        console.warn('[oauth-callback] no code + no hash — redirecting to /login');
        router.replace('/login?error=Sesion+invalida');
        return;
      }

      const params       = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresIn    = params.get('expires_in');
      const fragmentErr  = params.get('error_description') ?? params.get('error');
      if (fragmentErr) {
        console.warn('[oauth-callback] fragment error', fragmentErr);
        router.replace(`/login?error=${encodeURIComponent(fragmentErr)}`);
        return;
      }
      if (!accessToken || !refreshToken) {
        console.warn('[oauth-callback] hash present but tokens missing');
        router.replace('/login?error=Tokens+faltantes');
        return;
      }

      console.log('[oauth-callback] implicit-flow → POST /api/auth/oauth-session');

      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch('/api/auth/oauth-session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            access_token:  accessToken,
            refresh_token: refreshToken,
            expires_in:    expiresIn ? Number(expiresIn) : undefined,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          console.warn('[oauth-callback] oauth-session error', { status: res.status, data });
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
        console.log('[oauth-callback] success → window.location.assign', target);
        // Hard nav (not router.push). The destination is a server-rendered
        // protected layout that calls getServerAuth(); a full reload guarantees
        // the just-set Set-Cookie headers travel with the request, sidestepping
        // any client-router cache race.
        window.location.assign(target);
      } catch (err) {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        console.error('[oauth-callback] fetch failed', { isAbort, err });
        router.replace(
          isAbort
            ? '/login?error=Tiempo+de+espera+excedido'
            : '/login?error=Error+de+conexion',
        );
      }
    }

    run();
    return () => {
      cancelled = true;
      for (const id of timers) clearTimeout(id);
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FAF9F5' }}>
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#1F2A38' }} />
        <span className="text-sm" style={{ color: '#5E6B7B' }}>Iniciando sesión…</span>
        {showStuck && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-xs" style={{ color: '#8E96A2' }}>
              Esto está tomando más de lo normal.
            </span>
            <a
              href="/login"
              className="text-xs font-semibold underline"
              style={{ color: '#1F2A38' }}
            >
              Volver al login
            </a>
          </div>
        )}
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
