'use client';

// /auth/codigo — acceso por código de un solo uso enviado al correo.
// Paso 1: correo. Paso 2: código. El reenvío respeta la espera que indica el
// servidor. Los mensajes son neutros: no revelan si el correo tiene cuenta.

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, KeyRound, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import TopoBand from '@/components/decor/TopoBand';

const CARD = { background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(31,42,56,0.05)' } as const;
const INPUT = { border: '1px solid var(--border)', color: 'var(--ink)', background: 'var(--bg)' } as const;
const LONGITUD = 6;

/** Solo rutas internas: evita redirecciones a sitios externos. */
function destinoSeguro(valor: string | null): string | null {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) return null;
  return valor;
}

export default function AccesoPorCodigoPage() {
  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  useEffect(() => {
    if (paso === 'codigo') codigoRef.current?.focus();
  }, [paso]);

  async function solicitar(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/auth/otp/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: correo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo solicitar el código.');
        return;
      }
      setAviso(data.mensaje ?? '');
      setEspera(Number(data.esperaReenvioSeg) || 60);
      setCodigo('');
      setPaso('codigo');
    } catch {
      setError('No se pudo solicitar el código. Intente de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/auth/otp/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: correo, codigo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Código inválido o vencido.');
        setCodigo('');
        return;
      }
      const from = destinoSeguro(new URLSearchParams(window.location.search).get('from'));
      // Recarga completa: las cookies recién fijadas viajan con la petición.
      window.location.assign(from ?? data.redirectTo ?? '/dashboard');
    } catch {
      setError('No se pudo verificar el código. Intente de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--bg-soft)' }}>
      <TopoBand variant="light" position="overlay" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/MAPE LEGAL LOGO 1.JPG" alt="MAPE.LEGAL" width={72} height={72} className="rounded-xl mb-6" style={{ objectFit: 'contain' }} priority />
          <h1 className="text-2xl font-semibold text-center" style={{ color: 'var(--ink)' }}>Entrar con código</h1>
          <p className="text-sm mt-2 text-center" style={{ color: 'var(--slate)' }}>
            {paso === 'correo'
              ? 'Escriba su correo y le enviaremos un código de un solo uso.'
              : 'Escriba el código que le llegó por correo.'}
          </p>
        </div>

        <div className="rounded-xl p-6 sm:p-8" style={CARD}>
          {paso === 'correo' ? (
            <form onSubmit={solicitar} className="space-y-5">
              <div>
                <label htmlFor="correo" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>Correo electrónico</label>
                <div className="relative">
                  <Mail size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }} />
                  <input id="correo" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
                    autoComplete="email" className="w-full pl-10 pr-3 py-3 rounded-lg text-sm outline-none" style={INPUT} />
                </div>
              </div>
              {error && <Alerta texto={error} />}
              <Boton cargando={cargando} texto="Enviar código" textoCargando="Enviando…" />
            </form>
          ) : (
            <form onSubmit={verificar} className="space-y-5">
              {aviso && <p className="text-sm" role="status" style={{ color: 'var(--t2)' }}>{aviso}</p>}
              <div>
                <label htmlFor="codigo" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>Código de {LONGITUD} dígitos</label>
                <div className="relative">
                  <KeyRound size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }} />
                  <input id="codigo" ref={codigoRef} type="text" inputMode="numeric" pattern="[0-9]*" required
                    maxLength={LONGITUD} value={codigo} autoComplete="one-time-code"
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, LONGITUD))}
                    className="w-full pl-10 pr-3 py-3 rounded-lg outline-none"
                    style={{ ...INPUT, fontFamily: 'var(--font-mono)', fontSize: 20, letterSpacing: '0.3em' }} />
                </div>
              </div>
              {error && <Alerta texto={error} />}
              <Boton cargando={cargando} texto="Entrar" textoCargando="Verificando…" deshabilitado={codigo.length !== LONGITUD} />
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setPaso('correo'); setError(''); }} className="hover:underline cursor-pointer" style={{ color: 'var(--slate)' }}>
                  Cambiar correo
                </button>
                <button type="button" disabled={espera > 0 || cargando} onClick={() => solicitar()}
                  className="font-semibold hover:underline cursor-pointer" style={{ color: espera > 0 ? 'var(--t3)' : 'var(--ink)' }}>
                  {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--slate)' }}>
          <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>Entrar con contraseña</Link>
          {' · '}
          <Link href="/auth/registro" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>Solicitar acceso</Link>
        </p>
      </div>
    </div>
  );
}

function Alerta({ texto }: { texto: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 text-sm rounded-lg p-3"
      style={{ color: 'var(--red)', background: 'color-mix(in oklch, var(--red) 14%, white)' }}>
      <AlertCircle size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" /> {texto}
    </div>
  );
}

function Boton({ cargando, texto, textoCargando, deshabilitado }: { cargando: boolean; texto: string; textoCargando: string; deshabilitado?: boolean }) {
  return (
    <button type="submit" disabled={cargando || deshabilitado}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold cursor-pointer"
      style={{ background: 'var(--ink)', color: '#fff', opacity: cargando || deshabilitado ? 0.7 : 1 }}>
      {cargando ? <><Loader2 size={18} className="animate-spin" /> {textoCargando}</> : <>{texto} <ChevronRight size={16} /></>}
    </button>
  );
}
