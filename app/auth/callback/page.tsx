'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Client-side OAuth callback. Supabase redirects here after Google auth with
// the session in the URL fragment (`#access_token=...&refresh_token=...`),
// which is the implicit-flow shape returned when /authorize is hit without
// PKCE parameters. Servers can't read URL fragments, so this page extracts
// them client-side and posts them to /api/auth/oauth-session, which validates
// the JWT, looks up the role, and sets our cookie set.
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
        router.push(data.redirectTo ?? '/dashboard');
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F6F7' }}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin" style={{ color: '#1F2A44' }} />
        <span className="text-sm" style={{ color: '#5E6B7A' }}>Iniciando sesión…</span>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F6F7' }}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: '#1F2A44' }} />
            <span className="text-sm" style={{ color: '#5E6B7A' }}>Cargando…</span>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
