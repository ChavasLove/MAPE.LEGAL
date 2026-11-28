'use client';

// /auth/registro — SOLICITUD DE ACCESO (antes: creación de cuenta).
// Solo correo y nombre de contacto. No crea cuenta ni perfil: el alta la hace
// el personal. Ningún dato de trazabilidad se autodeclara aquí.

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, User, Loader2, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import TopoBand from '@/components/decor/TopoBand';

const CARD = { background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(31,42,56,0.05)' } as const;
const INPUT = { border: '1px solid var(--border)', color: 'var(--ink)', background: 'var(--bg)' } as const;

export default function SolicitudAccesoPage() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/auth/solicitud-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, nombre }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar la solicitud.');
        return;
      }
      setEnviado(true);
    } catch {
      setError('No se pudo enviar la solicitud. Intente de nuevo.');
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
          <h1 className="text-2xl font-semibold text-center" style={{ color: 'var(--ink)' }}>Solicitar acceso</h1>
          <p className="text-sm mt-2 text-center" style={{ color: 'var(--slate)' }}>
            El equipo revisa cada solicitud y crea el acceso. Usted no necesita llenar ningún dato de su operación.
          </p>
        </div>

        <div className="rounded-xl p-6 sm:p-8" style={CARD}>
          {enviado ? (
            <div className="text-center" role="status">
              <CheckCircle size={36} strokeWidth={1.5} style={{ color: 'var(--green)', margin: '0 auto 12px' }} />
              <p className="text-sm mb-6" style={{ color: 'var(--t2)' }}>
                Solicitud recibida. Le escribiremos al correo indicado. Cuando su acceso esté listo,
                entrará con un código que le llegará por correo.
              </p>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
                Ir al acceso <ChevronRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-5">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>Nombre de contacto</label>
                <div className="relative">
                  <User size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }} />
                  <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120}
                    autoComplete="name" className="w-full pl-10 pr-3 py-3 rounded-lg text-sm outline-none" style={INPUT} />
                </div>
              </div>
              <div>
                <label htmlFor="correo" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>Correo electrónico</label>
                <div className="relative">
                  <Mail size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }} />
                  <input id="correo" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
                    autoComplete="email" className="w-full pl-10 pr-3 py-3 rounded-lg text-sm outline-none" style={INPUT} />
                </div>
              </div>
              {error && (
                <div role="alert" className="flex items-start gap-2 text-sm rounded-lg p-3"
                  style={{ color: 'var(--red)', background: 'color-mix(in oklch, var(--red) 14%, white)' }}>
                  <AlertCircle size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              <button type="submit" disabled={cargando}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--ink)', color: '#fff', opacity: cargando ? 0.7 : 1 }}>
                {cargando ? <><Loader2 size={18} className="animate-spin" /> Enviando…</> : <>Enviar solicitud <ChevronRight size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--slate)' }}>
          ¿Ya tiene acceso?{' '}
          <Link href="/auth/codigo" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>Entrar con código</Link>
        </p>
        <p className="text-center text-xs mt-4" style={{ color: 'var(--t3)' }}>
          Consulte el{' '}
          <Link href="/aviso-legal" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>aviso legal</Link>{' '}
          de la plataforma MAPE.LEGAL, de la que es titular Corporación Hondureña Tenka, S.A.
        </p>
      </div>
    </div>
  );
}
