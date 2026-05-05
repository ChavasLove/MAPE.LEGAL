'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import TopoBand from '@/components/decor/TopoBand';

// Force dynamic rendering — this page reads URL fragment + env vars at runtime
// and must not be prerendered at build time (createClient throws without env).
export const dynamic = 'force-dynamic';

function EstablecerPasswordForm() {
  const router = useRouter();

  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Lazy-init the initial error if env vars are missing — keeps the effect
  // free of synchronous setState (avoids react-hooks/set-state-in-effect).
  // NEXT_PUBLIC_* vars are inlined at build time, so this is a render-time
  // check that doesn't depend on runtime conditions.
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState(() =>
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? ''
      : 'Configuración del cliente incompleta. Comunícate con el administrador.'
  );
  const [loading,  setLoading]  = useState(false);
  const [ready,    setReady]    = useState(false);

  // Instantiate the Supabase client + ingest the URL-fragment session AFTER
  // mount. Doing this in useState would run during SSR/prerender and crash
  // when env vars aren't injected.
  useEffect(() => {
    const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    let cancelled = false;
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, detectSessionInUrl: true, flowType: 'implicit' },
    });
    supabaseRef.current = client;

    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setError('Enlace expirado o inválido. Pide una nueva invitación al administrador.');
      } else {
        setEmail(data.session.user.email ?? '');
        setReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    const client = supabaseRef.current;
    if (!client) {
      setError('Cliente no inicializado. Recarga la página.');
      return;
    }

    setLoading(true);
    try {
      const { error: updErr } = await client.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message ?? 'No se pudo establecer la contraseña.');
        return;
      }

      // Hand off to the app's login route so it sets our cookies + applies the
      // role guard. The user just set this password, so credentials match.
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Contraseña configurada, pero el inicio de sesión falló. Intenta en /login.');
        return;
      }
      router.push(data.redirectTo ?? '/dashboard');
      router.refresh();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: '#F5F6F7' }}>
      <TopoBand variant="light" position="overlay" />
      <div className="w-full max-w-sm relative z-10">

        <div className="flex flex-col items-center mb-8">
          <Image
            src="/images/MAPE LEGAL LOGO 1.JPG"
            alt="MAPE.LEGAL"
            width={120}
            height={48}
            className="h-12 w-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-center" style={{ color: '#162033' }}>
            Configura tu contraseña
          </h1>
          <p className="text-sm mt-1 font-sans text-center" style={{ color: '#5E6B7A' }}>
            {email ? email : 'MAPE.LEGAL · Corporación Hondureña Tenka'}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-8 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans" style={{ color: '#5E6B7A' }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={!ready}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm font-sans outline-none focus:ring-2 transition disabled:opacity-50"
                style={{ borderColor: '#E5E7EB', color: '#162033' }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans" style={{ color: '#5E6B7A' }}>
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                disabled={!ready}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm font-sans outline-none focus:ring-2 transition disabled:opacity-50"
                style={{ borderColor: '#E5E7EB', color: '#162033' }}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !ready}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold font-sans transition-opacity disabled:opacity-60 cursor-pointer"
              style={{ background: '#1F2A44' }}
            >
              {loading ? 'Configurando...' : 'Establecer contraseña e iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 font-sans" style={{ color: '#A3AAB3' }}>
          Acceso restringido · Solo personal autorizado
        </p>
      </div>
    </div>
  );
}

export default function EstablecerPasswordPage() {
  return (
    <Suspense>
      <EstablecerPasswordForm />
    </Suspense>
  );
}
