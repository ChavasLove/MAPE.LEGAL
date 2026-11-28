'use client';

// /auth/invitacion?token=… — aceptar una invitación a una organización.
// Requiere sesión (se entra con código al correo). Aceptar deja la pertenencia
// PENDIENTE de verificación; no pide llenar datos ni concede permisos de carga.

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import TopoBand from '@/components/decor/TopoBand';

type Estado = { fase: 'lista' | 'enviando' | 'aceptada' | 'sin_sesion' | 'error'; mensaje?: string };

export default function InvitacionPage() {
  const [token, setToken] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: 'lista' });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    // El token sale de la barra de direcciones en cuanto se lee.
    window.history.replaceState(null, '', '/auth/invitacion');
    const id = window.setTimeout(() => setToken(t ?? ''), 0);
    return () => window.clearTimeout(id);
  }, []);

  async function aceptar() {
    setEstado({ fase: 'enviando' });
    try {
      const res = await fetch('/api/organizaciones/invitaciones/aceptar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return setEstado({ fase: 'sin_sesion' });
      if (!res.ok) return setEstado({ fase: 'error', mensaje: data.error ?? 'No se pudo aceptar la invitación.' });
      setEstado({ fase: 'aceptada', mensaje: data.mensaje });
    } catch {
      setEstado({ fase: 'error', mensaje: 'No se pudo aceptar la invitación. Intente de nuevo.' });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--bg-soft)' }}>
      <TopoBand variant="light" position="overlay" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/MAPE LEGAL LOGO 1.JPG" alt="MAPE.LEGAL" width={72} height={72} className="rounded-xl mb-6" style={{ objectFit: 'contain' }} priority />
          <h1 className="text-2xl font-semibold text-center" style={{ color: 'var(--ink)' }}>Invitación a una organización</h1>
        </div>
        <div className="rounded-xl p-6 sm:p-8 text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(31,42,56,0.05)' }}>
          {token === null && <Loader2 size={24} className="animate-spin" style={{ color: 'var(--slate)', margin: '0 auto' }} />}
          {token === '' && <p className="text-sm" role="alert" style={{ color: 'var(--red)' }}>El enlace no trae una invitación. Abra el enlace completo del correo.</p>}
          {token && estado.fase === 'lista' && (
            <>
              <p className="text-sm mb-6" style={{ color: 'var(--t2)' }}>
                Al aceptar, su pertenencia queda pendiente hasta que el equipo la verifique. Podrá consultar información; no tendrá que llenar datos.
              </p>
              <button type="button" onClick={aceptar} className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: 'var(--ink)', color: '#fff' }}>Aceptar invitación</button>
            </>
          )}
          {estado.fase === 'enviando' && <Loader2 size={24} className="animate-spin" style={{ color: 'var(--slate)', margin: '0 auto' }} />}
          {estado.fase === 'aceptada' && (
            <div role="status">
              <CheckCircle size={36} strokeWidth={1.5} style={{ color: 'var(--green)', margin: '0 auto 12px' }} />
              <p className="text-sm" style={{ color: 'var(--t2)' }}>{estado.mensaje}</p>
            </div>
          )}
          {estado.fase === 'sin_sesion' && (
            <div role="alert">
              <p className="text-sm mb-4" style={{ color: 'var(--t2)' }}>Entre primero con el correo al que llegó la invitación y vuelva a abrir el enlace.</p>
              <Link href="/auth/codigo" className="font-semibold hover:underline text-sm" style={{ color: 'var(--ink)' }}>Entrar con código</Link>
            </div>
          )}
          {estado.fase === 'error' && (
            <div role="alert" className="flex items-start gap-2 text-sm text-left rounded-lg p-3" style={{ color: 'var(--red)', background: 'color-mix(in oklch, var(--red) 14%, white)' }}>
              <AlertCircle size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" /> {estado.mensaje}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
