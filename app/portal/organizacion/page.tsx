'use client';

// /portal/organizacion — pertenencia del titular a organizaciones. SOLO LECTURA:
// no hay campos editables. Las altas y bajas las hace el personal.

import { useEffect, useState } from 'react';
import { Loader2, Building2 } from 'lucide-react';

interface Org {
  id: string; tipo: string; nombre: string; es_representante: boolean;
  miembros: Array<{ id: string; rol: string; estado: string; es_usted: boolean; desde: string }>;
  lotes: Array<{ id: string; codigo: string; estado: string }>;
}

const CARD = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 } as const;
const TIPO: Record<string, string> = { cooperativa: 'Cooperativa', municipio: 'Municipio', laboratorio: 'Laboratorio', centro_acopio: 'Centro de acopio', comercializador: 'Comercializador', planta: 'Planta de beneficio participante', auditor: 'Auditor externo', otro: 'Otra organización' };
const ESTADO: Record<string, string> = { pendiente: 'Pendiente de verificación', activa: 'Activa', baja: 'De baja' };
const ROL: Record<string, string> = { miembro: 'Miembro', representante: 'Representante', contacto: 'Contacto' };

export default function PortalOrganizacionPage() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'preparacion' | 'error'>('cargando');

  useEffect(() => {
    let vivo = true;
    fetch('/api/portal/organizacion', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (res.status === 503) return setEstado('preparacion');
        if (!res.ok) return setEstado('error');
        setOrgs(data.organizaciones as Org[]);
        setEstado('listo');
      })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, []);

  if (estado === 'cargando') return <div className="flex items-center gap-3 py-16 justify-center" style={{ color: 'var(--slate)' }}><Loader2 size={20} className="animate-spin" /> Cargando…</div>;
  if (estado === 'error') return <p role="alert" className="text-sm" style={{ color: 'var(--red)' }}>No se pudo cargar la información. Intente de nuevo.</p>;
  if (estado === 'preparacion') return <div style={CARD}><p className="text-sm" style={{ color: 'var(--t2)' }}>Esta sección estará disponible en cuanto el equipo termine de habilitarla.</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <p style={{ color: 'var(--slate)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>Solo lectura</p>
        <h1 className="mt-1" style={{ color: 'var(--ink)', fontSize: 24, fontWeight: 600 }}>Mi organización</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--t2)', maxWidth: 640 }}>
          Aquí ve a qué organizaciones pertenece. Las altas y las bajas las registra el personal; si algo no coincide, avise en recepción.
        </p>
      </div>
      {orgs && orgs.length === 0 && <div style={CARD}><p className="text-sm" style={{ color: 'var(--t3)' }}>No figura como integrante de ninguna organización.</p></div>}
      {orgs?.map((o) => (
        <section key={o.id} style={CARD} aria-label={o.nombre}>
          <h2 className="flex items-center gap-2" style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 600 }}><Building2 size={20} strokeWidth={1.5} /> {o.nombre}</h2>
          <p className="text-sm" style={{ color: 'var(--slate)' }}>{TIPO[o.tipo] ?? o.tipo}</p>
          <ul className="mt-4 space-y-1">
            {o.miembros.map((m) => (
              <li key={m.id} className="text-sm" style={{ color: 'var(--t2)' }}>
                {m.es_usted ? <strong style={{ color: 'var(--ink)' }}>Usted</strong> : 'Integrante'} · {ROL[m.rol] ?? m.rol} · {ESTADO[m.estado] ?? m.estado}
              </li>
            ))}
          </ul>
          {o.es_representante && (
            <>
              <p className="mt-4 text-sm" style={{ color: 'var(--ink)', fontWeight: 600 }}>Lotes de integrantes que dieron su consentimiento</p>
              {o.lotes.length === 0 ? <p className="text-sm" style={{ color: 'var(--t3)' }}>Ninguno por ahora.</p> : (
                <ul className="mt-1 space-y-1">
                  {o.lotes.map((l) => <li key={l.id} className="text-sm" style={{ color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{l.codigo} · {l.estado}</li>)}
                </ul>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
