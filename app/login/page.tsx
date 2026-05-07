'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import TopoBand from '@/components/decor/TopoBand';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get('from') ?? null;
  const confirmed    = searchParams.get('confirmed') === '1';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setErrorCode(null);
    setResendState('idle');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión');
        setErrorCode(data.code ?? null);
        return;
      }
      router.push(from ?? data.redirectTo);
      router.refresh();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Ingresa tu correo antes de solicitar el reenvío.');
      return;
    }
    setResendState('sending');
    try {
      await fetch('/api/auth/resend-confirmation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      setResendState('sent');
    } catch {
      setResendState('idle');
      setError('No se pudo reenviar el correo. Intenta de nuevo en unos minutos.');
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
            Acceso al sistema
          </h1>
          <p className="text-sm mt-1 font-sans text-center" style={{ color: '#5E6B7A' }}>
            MAPE.LEGAL · Corporación Hondureña Tenka
          </p>
        </div>

        {confirmed && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-sm font-sans"
            style={{ background: '#E6F2EC', color: '#2F5D50' }}
          >
            Correo confirmado — inicia sesión.
          </div>
        )}

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
                style={{ borderColor: '#E5E7EB', color: '#162033' }}
                placeholder="usuario@cht.hn"
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
                style={{ borderColor: '#E5E7EB', color: '#162033' }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="space-y-2">
                <p className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>
                  {error}
                </p>
                {errorCode === 'EMAIL_NOT_CONFIRMED' && resendState !== 'sent' && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === 'sending'}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold font-sans transition-opacity disabled:opacity-60 cursor-pointer"
                    style={{ background: 'transparent', color: '#1F2A44', border: '1px solid #1F2A44' }}
                  >
                    {resendState === 'sending' ? 'Enviando...' : 'Reenviar correo de confirmación'}
                  </button>
                )}
                {resendState === 'sent' && (
                  <p className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#2F5D50', background: '#E6F2EC' }}>
                    Te enviamos un nuevo enlace. Revisa tu bandeja de entrada.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold font-sans transition-opacity disabled:opacity-60 cursor-pointer"
              style={{ background: '#1F2A44' }}
            >
              {loading ? 'Verificando...' : 'Iniciar sesión'}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
