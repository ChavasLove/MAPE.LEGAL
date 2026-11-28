'use client';

// /portal — expediente del titular, SIEMPRE EN LÍNEA y de SOLO LECTURA.
// No hay campos editables ni botones de subida: toda la carga la hace el
// personal en recepción. Consume GET /api/portal/expediente.

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, FileText, Mountain, ShieldCheck } from 'lucide-react';
import type { VistaExpediente } from '@/lib/expediente/vista';
import { RESPALDO_EN_IMPLEMENTACION } from '@/lib/expediente/vista';

const CARD = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 } as const;
const EYEBROW = { color: 'var(--slate)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 } as const;

const ESTADO_PERFIL: Record<string, { texto: string; token: string }> = {
  borrador: { texto: 'En carga por el personal', token: 'var(--slate)' },
  pendiente: { texto: 'Pendiente de revisión', token: 'var(--amber)' },
  aprobado: { texto: 'Aprobado', token: 'var(--green)' },
  rechazado: { texto: 'Con observaciones', token: 'var(--red)' },
  suspendido: { texto: 'Suspendido', token: 'var(--red)' },
};
const LICENCIA_TIPO: Record<string, string> = {
  permiso_minero: 'Permiso minero', licencia_ambiental: 'Licencia ambiental', permiso_municipal: 'Permiso municipal', otro: 'Otro',
};
const LICENCIA_ESTADO: Record<string, { texto: string; token: string }> = {
  en_tramite: { texto: 'En trámite', token: 'var(--amber)' },
  vigente: { texto: 'Vigente', token: 'var(--green)' },
  vencida: { texto: 'Vencida', token: 'var(--red)' },
  suspendida: { texto: 'Suspendida', token: 'var(--red)' },
  no_aplica: { texto: 'No aplica', token: 'var(--slate)' },
};

function Pill({ token, children }: { token: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: token,
      background: `color-mix(in oklch, ${token} 14%, white)`, border: `1px solid color-mix(in oklch, ${token} 30%, white)`,
    }}>{children}</span>
  );
}

const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function PortalPage() {
  const [vista, setVista] = useState<VistaExpediente | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin_titular' | 'preparacion' | 'error'>('cargando');

  useEffect(() => {
    let vivo = true;
    fetch('/api/portal/expediente', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (res.status === 503) return setEstado('preparacion');
        if (!res.ok) return setEstado('error');
        if (!data.expediente) return setEstado('sin_titular');
        setVista(data.expediente as VistaExpediente);
        setEstado('listo');
      })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, []);

  if (estado === 'cargando') {
    return <div className="flex items-center gap-3 py-16 justify-center" style={{ color: 'var(--slate)' }}><Loader2 size={20} className="animate-spin" /> Cargando su expediente…</div>;
  }
  if (estado === 'error') {
    return <div role="alert" className="flex items-start gap-2 text-sm rounded-lg p-4" style={{ color: 'var(--red)', background: 'color-mix(in oklch, var(--red) 14%, white)' }}><AlertCircle size={18} strokeWidth={1.5} /> No se pudo cargar el expediente. Intente de nuevo.</div>;
  }
  if (estado === 'preparacion') {
    return <div style={CARD}><p style={EYEBROW}>En implementación</p><p className="mt-2 text-sm" style={{ color: 'var(--t2)' }}>La consulta del expediente estará disponible en cuanto el equipo termine de habilitar esta sección.</p></div>;
  }
  if (estado === 'sin_titular' || !vista) {
    return <div style={CARD}><p className="text-sm" style={{ color: 'var(--t2)' }}>Su cuenta todavía no está vinculada a un expediente. El personal de recepción hace el alta; usted no necesita llenar ningún dato.</p></div>;
  }

  const perfil = vista.perfil ? ESTADO_PERFIL[vista.perfil.estado] ?? { texto: vista.perfil.estado, token: 'var(--slate)' } : null;

  return (
    <div className="space-y-6">
      <div>
        <p style={EYEBROW}>Solo lectura</p>
        <h1 className="mt-1" style={{ color: 'var(--ink)', fontSize: 24, fontWeight: 600 }}>Mi expediente</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--t2)', maxWidth: 640 }}>
          Aquí ve lo que el personal registró a partir de sus documentos. Si algo no coincide, avise en recepción o escriba a gerencia@mape.legal: la corrección la hace el personal y queda registrada.
        </p>
      </div>

      <section style={CARD} aria-labelledby="h-perfil">
        <h2 id="h-perfil" className="flex items-center gap-2" style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 600 }}><ShieldCheck size={20} strokeWidth={1.5} /> Perfil</h2>
        {perfil && vista.perfil ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--t2)' }}>
            <Pill token={perfil.token}>{perfil.texto}</Pill>{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>versión {vista.perfil.version} · actualizado {fecha(vista.perfil.actualizado)}</span>
          </p>
        ) : <p className="mt-3 text-sm" style={{ color: 'var(--t3)' }}>Su perfil todavía no ha sido cargado por el personal.</p>}
      </section>

      <section style={CARD} aria-labelledby="h-minas">
        <h2 id="h-minas" className="flex items-center gap-2" style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 600 }}><Mountain size={20} strokeWidth={1.5} /> Minas y licencias</h2>
        {vista.minas.length === 0 && <p className="mt-3 text-sm" style={{ color: 'var(--t3)' }}>No hay minas registradas a su nombre.</p>}
        {vista.minas.map((m) => (
          <div key={m.id} className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--ink)', fontWeight: 600 }}>{m.nombre ?? 'Mina'} {m.codigo && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>{m.codigo}</span>}</p>
            <p className="text-sm" style={{ color: 'var(--slate)' }}>{[m.municipio, m.departamento].filter(Boolean).join(' · ') || '—'}</p>
            {m.licencias.length === 0 ? <p className="mt-2 text-sm" style={{ color: 'var(--t3)' }}>Sin licencias registradas para esta mina.</p> : (
              <ul className="mt-2 space-y-2">
                {m.licencias.map((l, i) => {
                  const e = LICENCIA_ESTADO[l.estado] ?? { texto: l.estado, token: 'var(--slate)' };
                  return (
                    <li key={i} className="text-sm flex flex-wrap items-center gap-2" style={{ color: 'var(--t2)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{LICENCIA_TIPO[l.tipo] ?? l.tipo}</span>
                      {l.numero && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{l.numero}</span>}
                      <Pill token={e.token}>{e.texto}</Pill>
                      {(l.vigente_desde || l.vigente_hasta) && <span style={{ color: 'var(--t3)' }}>{fecha(l.vigente_desde)} → {fecha(l.vigente_hasta)}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section style={CARD} aria-labelledby="h-tramites">
        <h2 id="h-tramites" className="flex items-center gap-2" style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 600 }}><FileText size={20} strokeWidth={1.5} /> Trámites y documentos</h2>
        {vista.tramites.length === 0 && <p className="mt-3 text-sm" style={{ color: 'var(--t3)' }}>No hay trámites registrados.</p>}
        {vista.tramites.map((t) => (
          <div key={t.id} className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--ink)', fontWeight: 600 }}>{t.numero ?? 'Trámite'} <span className="text-sm" style={{ color: 'var(--slate)', fontWeight: 400 }}>{t.tipo ?? ''}</span></p>
            <p className="text-sm" style={{ color: 'var(--slate)' }}>
              Estado: {t.estado ?? '—'}{t.fase !== null ? ` · fase ${t.fase}` : ''}{t.paso ? ` · paso ${t.paso}` : ''} · inicio {fecha(t.inicio)}
            </p>
            {t.documentos.length === 0 ? <p className="mt-2 text-sm" style={{ color: 'var(--t3)' }}>Sin documentos en este trámite.</p> : (
              <ul className="mt-2 space-y-1">
                {t.documentos.map((d) => (
                  <li key={d.id} className="text-sm flex flex-wrap items-center gap-2" style={{ color: 'var(--t2)' }}>
                    <span>{d.nombre ?? 'Documento'}</span>
                    {d.estado && <span style={{ color: 'var(--t3)' }}>· {d.estado}</span>}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>
                      {d.respaldo.estado === 'respaldado' ? `Respaldo digital v${d.respaldo.version}` : RESPALDO_EN_IMPLEMENTACION}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
