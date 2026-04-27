'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/admin';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión');
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F5F6F7' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/images/MAPE LEGAL LOGO 1.JPG"
            alt="Corporación Hondureña Tenka"
            width={120}
            height={48}
            className="h-12 w-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-center" style={{ color: '#162033' }}>
            Panel de administración
          </h1>
          <p className="text-sm mt-1 font-sans" style={{ color: '#5E6B7A' }}>
            MAPE.LEGAL · Corporación Hondureña Tenka
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border p-8 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans" style={{ color: '#5E6B7A' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm font-sans outline-none focus:ring-2 transition"
                style={{ borderColor: '#E5E7EB', color: '#162033', focusRingColor: '#1F2A44' } as React.CSSProperties}
                placeholder="admin@cht.hn"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans" style={{ color: '#5E6B7A' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm font-sans outline-none focus:ring-2 transition"
                style={{ borderColor: '#E5E7EB', color: '#162033' } as React.CSSProperties}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold font-sans transition-colors disabled:opacity-60 cursor-pointer"
              style={{ background: '#1F2A44' }}
            >
              {loading ? 'Verificando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 font-sans" style={{ color: '#A3AAB3' }}>
          Acceso restringido · Solo administradores autorizados
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
