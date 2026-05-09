'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Mail, Lock, Eye, EyeOff, Loader2,
  ShieldCheck, FileCheck, MapPin,
  AlertCircle, CheckCircle, Send,
  ChevronRight,
} from 'lucide-react';
import TopoBand from '@/components/decor/TopoBand';

// Google's official "G" multi-colour logo. Shipped inline because lucide-react
// doesn't ship a brand-accurate Google mark.
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.1c-1.5 4.2-5.5 7.2-10.1 7.2A11 11 0 1 1 24 13a10.9 10.9 0 0 1 7.7 3l5.1-5.1A18 18 0 1 0 24 42c9.9 0 18-7.2 18-18 0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 5.9 4.3A11 11 0 0 1 24 13a10.9 10.9 0 0 1 7.7 3l5.1-5.1A18 18 0 0 0 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 42a18 18 0 0 0 12.1-4.7l-5.6-4.7A11 11 0 0 1 14 27.1l-5.9 4.5A18 18 0 0 0 24 42z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.1a10.9 10.9 0 0 1-3.7 5.1l5.6 4.7c-.4.4 6-4.4 6-13.4 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

// Restricts the post-login redirect to same-origin paths. Without this, an
// attacker can craft `mape.legal/login?from=https://evil.com` (or
// `?from=//evil.com`) and the form will navigate the authenticated user to a
// phishing site after a successful login.
function safeFrom(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = safeFrom(searchParams.get('from'));
  const confirmed    = searchParams.get('confirmed') === '1';
  const urlError     = searchParams.get('error');

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Surface URL-borne errors (e.g. from the OAuth callback) once on mount via
  // a lazy initializer — using useEffect for this would trigger a cascading
  // render and trip react-hooks/set-state-in-effect.
  const [error, setError] = useState(() =>
    urlError ? decodeURIComponent(urlError) : ''
  );
  const [errorCode,    setErrorCode]    = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [resendState,  setResendState]  = useState<'idle' | 'sending' | 'sent'>('idle');

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
    } catch (err) {
      console.error('[login] error:', err);
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

  function handleGoogleLogin() {
    const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal';
    if (!url) {
      setError('Inicio de sesión con Google no está configurado.');
      return;
    }
    // /auth/callback handles both shapes Supabase can return:
    //   - `?code=...` (authorization code flow — modern default) → forwarded
    //     to /api/auth/callback for the server-side exchange
    //   - `#access_token=...` (implicit flow — legacy) → tokens are read
    //     client-side and posted to /api/auth/oauth-session
    const redirectUri = `${siteUrl}/auth/callback`;
    const scopes      = encodeURIComponent('openid email profile');
    const oauthUrl =
      `${url}/auth/v1/authorize?provider=google` +
      `&redirect_to=${encodeURIComponent(redirectUri)}` +
      `&scopes=${scopes}`;
    window.location.href = oauthUrl;
  }

  const C = {
    primary: '#1F2A44', primaryDark: '#162033', accent: '#C8A44D',
    text: '#162033', textMuted: '#5E6B7A', textLight: '#A3AAB3',
    success: '#2F5D50', successBg: '#E6F2EC',
    error: '#A94442', errorBg: '#F8E5E4',
    bg: '#F5F6F7', white: '#FFFFFF', border: '#E5E7EB',
  };

  return (
    <div className="min-h-screen w-full flex" style={{ background: C.bg }}>
      {/* ═══════════════ LEFT PANEL — brand ═══════════════ */}
      <div
        className="hidden lg:flex lg:w-[55%] xl:w-1/2 relative flex-col justify-between overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${C.primaryDark} 0%, ${C.primary} 100%)` }}
      >
        <TopoBand variant="dark" position="overlay" />
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,164,77,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            bottom: '-15%', left: '-10%', width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(47,93,80,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 px-12 xl:px-16 pt-12">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <Image
                src="/images/MAPE LEGAL LOGO 1.JPG"
                alt="MAPE.LEGAL"
                width={32}
                height={32}
                className="rounded"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <span className="text-lg font-bold tracking-wide" style={{ color: 'rgba(255,255,255,0.95)' }}>
              MAPE.LEGAL
            </span>
          </div>
        </div>

        <div className="relative z-10 px-12 xl:px-16 flex-1 flex flex-col justify-center">
          <div className="max-w-md">
            <div className="mb-6" style={{ width: 48, height: 3, borderRadius: 2, background: C.accent }} />
            <h2
              className="text-3xl xl:text-4xl font-bold leading-tight mb-4"
              style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}
            >
              Gestión legal minera<br />
              <span style={{ color: C.accent }}>con trazabilidad total</span>
            </h2>
            <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 420 }}>
              Controla cada fase de tus concesiones, licencias y expedientes desde un solo panel seguro.
            </p>
            <div className="flex flex-col gap-4">
              <TrustItem icon={<ShieldCheck size={18} />} label="Datos cifrados en tránsito y en reposo" />
              <TrustItem icon={<FileCheck size={18} />} label="Registro completo de auditoría" />
              <TrustItem icon={<MapPin size={18} />} label="Gestión georreferenciada de concesiones" />
            </div>
          </div>
        </div>

        <div className="relative z-10 px-12 xl:px-16 pb-10">
          <div
            className="flex items-center gap-6 text-xs"
            style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace' }}
          >
            <span>15°56′N · 85°08′W</span>
            <span
              style={{
                width: 3, height: 3, borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)', display: 'inline-block',
              }}
            />
            <span>IRIONA, COLÓN, HONDURAS</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ RIGHT PANEL — form ═══════════════ */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 relative">
        <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <TopoBand variant="light" position="overlay" />
        </div>

        <div className="w-full max-w-[420px] relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center rounded-xl mb-6"
              style={{ width: 72, height: 72, background: C.white, border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            >
              <Image
                src="/images/MAPE LEGAL LOGO 1.JPG"
                alt="MAPE.LEGAL"
                width={52}
                height={52}
                className="rounded"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-center" style={{ color: C.text, letterSpacing: '-0.02em' }}>
              Acceso al sistema
            </h1>
            <p className="text-sm mt-2 text-center" style={{ color: C.textMuted }}>
              MAPE.LEGAL · Corporación Hondureña Tenka
            </p>
          </div>

          {confirmed && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3.5 mb-5 text-sm"
              style={{ background: C.successBg, color: C.success, border: `1px solid rgba(47,93,80,0.15)` }}
              role="status"
              aria-live="polite"
            >
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>Correo confirmado — ya puedes iniciar sesión.</span>
            </div>
          )}

          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03)',
            }}
          >
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer mb-5"
              style={{ background: C.white, color: C.text, border: `1px solid ${C.border}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.textMuted; e.currentTarget.style.background = C.bg; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}
            >
              <GoogleIcon size={18} />
              Continuar con Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px" style={{ background: C.border }} />
              <span className="text-xs font-medium" style={{ color: C.textLight }}>o con correo</span>
              <div className="flex-1 h-px" style={{ background: C.border }} />
            </div>

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
                    name="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    placeholder="usuario@cht.hn"
                    className="w-full rounded-lg border text-sm outline-none transition-all duration-200"
                    style={{ padding: '10px 12px 10px 40px', borderColor: C.border, color: C.text, background: C.white }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(31,42,68,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: C.textMuted }}
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => router.push('/auth/recuperar-password')}
                    className="text-xs transition-colors cursor-pointer hover:underline"
                    style={{ color: C.textMuted }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.textLight }}>
                    <Lock size={18} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border text-sm outline-none transition-all duration-200"
                    style={{ padding: '10px 44px 10px 40px', borderColor: C.border, color: C.text, background: C.white }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(31,42,68,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: C.textLight }}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="space-y-3">
                  <div
                    className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm"
                    style={{ color: C.error, background: C.errorBg, border: `1px solid rgba(169,68,66,0.12)` }}
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                  {errorCode === 'EMAIL_NOT_CONFIRMED' && resendState !== 'sent' && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendState === 'sending'}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                      style={{ background: 'transparent', color: C.primary, border: `1px solid ${C.primary}` }}
                      onMouseEnter={e => { if (resendState !== 'sending') { e.currentTarget.style.background = C.primary; e.currentTarget.style.color = C.white; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.primary; }}
                    >
                      {resendState === 'sending'
                        ? <><Loader2 size={16} className="animate-spin" /> Enviando…</>
                        : <><Send size={16} /> Reenviar correo de confirmación</>
                      }
                    </button>
                  )}
                  {resendState === 'sent' && (
                    <div
                      className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm"
                      style={{ color: C.success, background: C.successBg, border: `1px solid rgba(47,93,80,0.12)` }}
                      role="status"
                      aria-live="polite"
                    >
                      <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>Te enviamos un nuevo enlace. Revisa tu bandeja de entrada.</span>
                    </div>
                  )}
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
                  ? <><Loader2 size={18} className="animate-spin" /> Verificando credenciales…</>
                  : <>Iniciar sesión <ChevronRight size={16} /></>
                }
              </button>
            </form>

            <div className="mt-5 pt-5 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
              <p className="text-sm" style={{ color: C.textMuted }}>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => router.push('/auth/registro')}
                  className="font-semibold cursor-pointer hover:underline"
                  style={{ color: C.primary }}
                >
                  Crear cuenta
                </button>
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.success }} />
              <span className="text-xs font-medium" style={{ color: C.textMuted }}>Sistema operativo</span>
            </div>
            <p className="text-center text-xs" style={{ color: C.textLight }}>
              Acceso restringido · Solo personal autorizado de CHT
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{
          width: 36, height: 36,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#C8A44D',
        }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
