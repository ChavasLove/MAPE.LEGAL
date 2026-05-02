'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Mail, MessageSquare, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, XCircle, FileText,
} from 'lucide-react';
import type { DashExpediente, DashHito, DashDoc, DashFase } from '@/services/dashboardService';

// ─── Badge helpers ────────────────────────────────────────────────────────────

const ESTADO_EXP: Record<string, { bg: string; text: string; label: string }> = {
  activo:     { bg: '#E6F2EC', text: '#2F5D50', label: 'Activo'     },
  alerta:     { bg: '#F5EBDD', text: '#8C6A4A', label: 'Alerta'     },
  bloqueado:  { bg: '#F8E5E4', text: '#A94442', label: 'Bloqueado'  },
  nuevo:      { bg: '#DBEAFE', text: '#3A6EA5', label: 'Nuevo'      },
  completado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Completado' },
};

const DOC_ESTADO: Record<string, { bg: string; text: string; label: string; Icon: typeof CheckCircle2 }> = {
  verificado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Verificado', Icon: CheckCircle2 },
  pendiente:  { bg: '#DBEAFE', text: '#3A6EA5', label: 'En revisión', Icon: Clock       },
  faltante:   { bg: '#F5EBDD', text: '#8C6A4A', label: 'Faltante',   Icon: AlertTriangle},
  rechazado:  { bg: '#F8E5E4', text: '#A94442', label: 'Rechazado',  Icon: XCircle      },
};

const HITO_ESTADO: Record<string, { bg: string; text: string; label: string }> = {
  cobrado:   { bg: '#E6F2EC', text: '#2F5D50', label: 'Cobrado'   },
  pendiente: { bg: '#DBEAFE', text: '#3A6EA5', label: 'Pendiente' },
  bloqueado: { bg: '#F5EBDD', text: '#8C6A4A', label: 'Bloqueado' },
};

const FASE_ESTADO: Record<string, { dot: string; label: string }> = {
  completada: { dot: '#3E7C59', label: 'Completada' },
  activa:     { dot: '#C49A4A', label: 'En curso'   },
  alerta:     { dot: '#A94442', label: 'Alerta'     },
  pendiente:  { dot: '#5E6B7A', label: 'Pendiente'  },
};

type Tab = 'hitos' | 'documentos' | 'fases' | 'legalidad';

// ─── Notify modal ─────────────────────────────────────────────────────────────

function NotifyModal({
  exp,
  onClose,
}: {
  exp: DashExpediente;
  onClose: () => void;
}) {
  const [tipo,    setTipo]    = useState<'email' | 'whatsapp'>('email');
  const [to,      setTo]      = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState('');

  async function send() {
    if (!to || !mensaje) return;
    setSending(true);
    setErr('');
    try {
      const endpoint = tipo === 'email' ? '/api/email/send' : '/api/whatsapp/send';
      const body = tipo === 'email'
        ? { to, subject: `Expediente ${exp.id}`, html: `<p>${mensaje.replace(/\n/g, '<br>')}</p>`, expediente_id: exp.id }
        : { to, body: mensaje, expediente_id: exp.id };

      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ background: '#1F2A44' }}>
        <h3 className="text-base font-semibold text-white font-sans mb-4">
          Enviar notificación — {exp.id}
        </h3>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#3E7C59' }} />
            <p className="text-sm font-sans text-white">Notificación enviada</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 rounded-lg text-sm font-semibold font-sans text-white cursor-pointer" style={{ background: '#162033' }}>Cerrar</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['email', 'whatsapp'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans transition-colors cursor-pointer"
                  style={tipo === t
                    ? { background: '#162033', color: 'white', border: '1px solid rgba(94,107,122,0.6)' }
                    : { background: 'transparent', color: '#A3AAB3', border: '1px solid rgba(94,107,122,0.3)' }}
                >
                  {t === 'email' ? <Mail size={15} strokeWidth={1.5} /> : <MessageSquare size={15} strokeWidth={1.5} />}
                  {t === 'email' ? 'Email' : 'WhatsApp'}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
                {tipo === 'email' ? 'Correo destinatario' : 'Número (con código de país)'}
              </label>
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder={tipo === 'email' ? 'cliente@email.com' : '50499990000'}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>Mensaje</label>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none resize-none"
                style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                placeholder={`Estimado cliente, su expediente ${exp.id}...`}
              />
            </div>
            {err && <p className="text-xs font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>{err}</p>}
            <div className="flex gap-3">
              <button
                onClick={send}
                disabled={sending || !to || !mensaje}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold font-sans text-white disabled:opacity-50 cursor-pointer"
                style={{ background: '#2F5D50' }}
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm font-medium font-sans hover:bg-white/10 transition-colors cursor-pointer"
                style={{ color: '#A3AAB3' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExpedienteDetailPage() {
  const params = useParams<{ id: string }>();
  const id     = params.id;

  const [exp,        setExp]        = useState<DashExpediente | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<Tab>('hitos');
  const [showNotify, setShowNotify] = useState(false);
  const [advancing,  setAdvancing]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/expedientes/${encodeURIComponent(id)}`);
      const data = await res.json();
      setExp(data.error ? null : data);
    } catch { setExp(null); }
    finally { setLoading(false); }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleAdvance() {
    if (!exp) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/expedientes/${encodeURIComponent(id)}/transition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (res.ok) await load();
    } finally { setAdvancing(false); }
  }

  async function updateDocEstado(docId: string, estado: string) {
    await fetch(`/api/documentos/${docId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    await load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-sm font-sans" style={{ color: '#A3AAB3' }}>Cargando expediente...</span>
    </div>
  );

  if (!exp) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-sm font-sans" style={{ color: '#A3AAB3' }}>Expediente no encontrado.</p>
      <Link href="/dashboard/expedientes" className="text-sm font-semibold font-sans hover:underline" style={{ color: '#3A6EA5' }}>
        ← Volver a expedientes
      </Link>
    </div>
  );

  const estatusBadge = ESTADO_EXP[exp.estado] ?? ESTADO_EXP.activo;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'hitos',     label: 'Hitos de pago'    },
    { key: 'documentos',label: 'Documentos'       },
    { key: 'fases',     label: 'Progreso por fase'},
    { key: 'legalidad', label: 'Índice de legalidad'},
  ];

  return (
    <div>
      {showNotify && <NotifyModal exp={exp} onClose={() => setShowNotify(false)} />}

      {/* Back + header */}
      <div className="mb-6">
        <Link
          href="/dashboard/expedientes"
          className="inline-flex items-center gap-1.5 text-sm font-sans mb-4 hover:underline"
          style={{ color: '#A3AAB3' }}
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Expedientes
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{exp.id}</h1>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold font-sans"
                style={{ background: estatusBadge.bg, color: estatusBadge.text }}
              >
                {estatusBadge.label}
              </span>
            </div>
            <p className="text-base font-sans" style={{ color: '#A3AAB3' }}>
              {exp.cliente} · {exp.tipo} · {exp.municipio}
            </p>
            <p className="text-xs font-sans mt-1" style={{ color: '#5E6B7A' }}>
              Inicio: {exp.inicio} · Cierre estimado: {exp.cierreEst}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotify(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans border transition-colors cursor-pointer"
              style={{ borderColor: 'rgba(94,107,122,0.4)', color: '#A3AAB3', background: 'transparent' }}
            >
              <Mail size={15} strokeWidth={1.5} />
              Notificar
            </button>
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans text-white disabled:opacity-50 cursor-pointer"
              style={{ background: '#2F5D50' }}
            >
              <ChevronRight size={15} strokeWidth={2} />
              {advancing ? 'Avanzando...' : 'Avanzar fase'}
            </button>
          </div>
        </div>
      </div>

      {/* Assignee + legalidad summary */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border p-4" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider font-sans mb-2" style={{ color: '#A3AAB3' }}>Abogado CHT</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-sans" style={{ background: '#DBEAFE', color: '#3A6EA5' }}>
              {exp.abogado.initials}
            </div>
            <span className="text-sm text-white font-sans">{exp.abogado.nombre}</span>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider font-sans mb-2" style={{ color: '#A3AAB3' }}>Técnico Ambiental</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-sans" style={{ background: '#E6F2EC', color: '#2F5D50' }}>
              {exp.psa.initials}
            </div>
            <span className="text-sm text-white font-sans">{exp.psa.nombre}</span>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider font-sans mb-2" style={{ color: '#A3AAB3' }}>Índice de legalidad</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(94,107,122,0.3)' }}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${exp.legalidad}%`, background: '#3E7C59' }} />
            </div>
            <span className="text-xl font-bold text-white font-sans">{exp.legalidad}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium font-sans transition-colors cursor-pointer -mb-px"
            style={tab === t.key
              ? { color: 'white', borderBottom: '2px solid #3A6EA5' }
              : { color: '#A3AAB3', borderBottom: '2px solid transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Hitos de pago ───────────────────────────────────────────────────── */}
      {tab === 'hitos' && (
        <div className="space-y-3">
          {exp.hitos.map((h: DashHito) => {
            const bs = HITO_ESTADO[h.estado] ?? HITO_ESTADO.pendiente;
            return (
              <div
                key={h.id}
                className="rounded-xl border p-5 flex flex-wrap items-center gap-4"
                style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-sans shrink-0"
                  style={{ background: bs.bg, color: bs.text }}>
                  {h.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white font-sans">{h.trigger}</div>
                  {h.ref && <div className="text-xs font-sans mt-0.5" style={{ color: '#A3AAB3' }}>Ref: {h.ref}</div>}
                  {h.fecha && <div className="text-xs font-sans" style={{ color: '#A3AAB3' }}>Fecha: {h.fecha}</div>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white font-sans">
                    L. {h.monto.toLocaleString('es-HN')}
                  </div>
                  <div className="text-xs font-sans" style={{ color: '#A3AAB3' }}>{h.pct}% del total</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold font-sans shrink-0"
                  style={{ background: bs.bg, color: bs.text }}>
                  {bs.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Documentos ──────────────────────────────────────────────────────── */}
      {tab === 'documentos' && (
        <div className="space-y-3">
          {exp.documentos.map((d: DashDoc) => {
            const ds = DOC_ESTADO[d.estado] ?? DOC_ESTADO.faltante;
            const { Icon } = ds;
            return (
              <div
                key={d.id}
                className="rounded-xl border p-5 flex flex-wrap items-center gap-4"
                style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
              >
                <FileText size={20} strokeWidth={1.5} style={{ color: '#A3AAB3' }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white font-sans">{d.nombre}</div>
                  <div className="text-xs font-sans mt-0.5" style={{ color: '#A3AAB3' }}>{d.info}</div>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-sans"
                  style={{ background: ds.bg, color: ds.text }}>
                  <Icon size={12} strokeWidth={2} />
                  {ds.label}
                </span>
                {d.estado !== 'verificado' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateDocEstado(d.id, 'verificado')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold font-sans cursor-pointer"
                      style={{ background: '#E6F2EC', color: '#2F5D50' }}
                    >
                      Verificar
                    </button>
                    <button
                      onClick={() => updateDocEstado(d.id, 'rechazado')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold font-sans cursor-pointer"
                      style={{ background: '#F8E5E4', color: '#A94442' }}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Fases ───────────────────────────────────────────────────────────── */}
      {tab === 'fases' && (
        <div className="space-y-3">
          {exp.fases.map((f: DashFase) => {
            const fs = FASE_ESTADO[f.estado] ?? FASE_ESTADO.pendiente;
            const pct = f.totalPasos > 0 ? Math.round((f.pasos / f.totalPasos) * 100) : 0;
            return (
              <div
                key={f.nombre}
                className="rounded-xl border p-5"
                style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: fs.dot }} />
                    <div>
                      <div className="text-sm font-semibold text-white font-sans">{f.nombre}</div>
                      {f.responsable && (
                        <div className="text-xs font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
                          Responsable: {f.responsable}
                          {f.vence ? ` · Vence: ${f.vence}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-1.5 rounded-full" style={{ background: 'rgba(94,107,122,0.3)' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: fs.dot }} />
                    </div>
                    <span className="text-xs font-sans" style={{ color: '#A3AAB3' }}>
                      {f.pasos}/{f.totalPasos}
                    </span>
                  </div>
                </div>
                {f.subpasos.length > 0 && (
                  <ul className="space-y-1.5 pl-5">
                    {f.subpasos.map(sp => (
                      <li key={sp.nombre} className="flex items-center gap-2 text-xs font-sans" style={{ color: '#A3AAB3' }}>
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: sp.estado === 'completado' ? '#3E7C59' : sp.estado === 'activo' ? '#C49A4A' : '#5E6B7A' }}
                        />
                        {sp.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Índice de legalidad ──────────────────────────────────────────────── */}
      {tab === 'legalidad' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exp.legalidadItems.map(item => {
            const ok = item.estado === 'ok' || item.estado === 'verificado';
            const alert = item.estado === 'alerta';
            const bg   = ok ? '#E6F2EC' : alert ? '#F5EBDD' : '#1F2A44';
            const clr  = ok ? '#2F5D50' : alert ? '#8C6A4A' : '#A3AAB3';
            const brd  = ok ? '#3E7C59' : alert ? '#C49A4A' : 'rgba(94,107,122,0.3)';
            return (
              <div
                key={item.nombre}
                className="rounded-xl border p-5 flex items-center gap-4"
                style={{ background: bg, borderColor: brd }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: ok ? '#3E7C59' : alert ? '#C49A4A' : 'rgba(94,107,122,0.3)' }}
                >
                  {ok ? (
                    <CheckCircle2 size={20} strokeWidth={2} style={{ color: 'white' }} />
                  ) : alert ? (
                    <AlertTriangle size={20} strokeWidth={2} style={{ color: 'white' }} />
                  ) : (
                    <Clock size={20} strokeWidth={1.5} style={{ color: '#A3AAB3' }} />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold font-sans" style={{ color: ok || alert ? '#162033' : 'white' }}>
                    {item.nombre}
                  </div>
                  <div className="text-xs font-sans mt-0.5" style={{ color: clr }}>
                    {ok ? 'Cumplido' : alert ? 'Requiere atención' : 'Pendiente'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
