'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Mail, Loader2, AlertCircle, CheckCircle, ChevronLeft, Send,
} from 'lucide-react';
import TopoBand from '@/components/decor/TopoBand';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RecuperarPasswordForm() {
  const router = useRouter();
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const C = {
    primary: '#1F2A44', primaryDark: '#162033',
    text: '#162033', textMuted: '#5E6B7A', textLight: '#A3AAB3',
    success: '#2F5D50', successBg: '#E6F2EC',
    error: '#A94442', errorBg: '#F8E5E4',
    bg: '#F5F6F7', white: '#FFFFFF', border: '#E5E7EB',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!EMAIL_REGEX.test(email)) {
      setError('Ingresa un correo válido.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al enviar el correo.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
        <TopoBand variant="light" position="overlay" />
        <div className="w-full max-w-sm relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center rounded-xl mb-6"
              style={{ width: 72, height: 72, background: C.successBg }}
            >
              <CheckCircle size={36} style={{ color: C.success }} />
            </div>
            <h1 className="text-2xl font-bold text-center" style={{ color: C.text }}>Correo enviado</h1>
            <p className="text-sm mt-2 text-center" style={{ color: C.textMuted }}>{email}</p>
          </div>
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: C.white, border: `1px solid ${C.border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
          >
            <p className="text-sm mb-6" style={{ color: C.textMuted }}>
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
              Revisa tu bandeja de entrada y la carpeta de spam.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold cursor-pointer"
              style={{ background: C.primary }}
              onMouseEnter={e => { e.currentTarget.style.background = C.primaryDark; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.primary; }}
            >
              <ChevronLeft size={16} /> Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
      <TopoBand variant="light" position="overlay" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/images/MAPE LEGAL LOGO 1.JPG"
            alt="MAPE.LEGAL"
            width={72}
            height={72}
            className="rounded-xl mb-6"
            style={{ objectFit: 'contain' }}
            priority
          />
          <h1 className="text-2xl font-bold text-center" style={{ color: C.text }}>Recuperar contraseña</h1>
          <p className="text-sm mt-2 text-center" style={{ color: C.textMuted }}>
            Te enviaremos un enlace para restablecerla
          </p>
        </div>

        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{ background: C.white, border: `1px solid ${C.border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: C.textMuted }}
              >
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.textLight }}>
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border text-sm outline-none transition-all duration-200"
                  style={{ padding: '10px 12px 10px 40px', borderColor: C.border, color: C.text, background: C.white }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(31,42,68,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm"
                style={{ color: C.error, background: C.errorBg, border: `1px solid rgba(169,68,66,0.12)` }}
              >
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold transition-all cursor-pointer"
              style={{ background: C.primary }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = C.primaryDark; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Enviando…</>
                : <><Send size={16} /> Enviar enlace de recuperación</>
              }
            </button>
          </form>
        </div>

        <p className="text-center mt-6">
          <button
            onClick={() => router.push('/login')}
            className="text-xs font-medium transition-colors cursor-pointer hover:underline"
            style={{ color: C.textMuted }}
          >
            <ChevronLeft size={12} className="inline mr-1" />Volver al inicio de sesión
          </button>
        </p>
      </div>
    </div>
  );
}

export default function RecuperarPasswordPage() {
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
      <RecuperarPasswordForm />
    </Suspense>
  );
}
