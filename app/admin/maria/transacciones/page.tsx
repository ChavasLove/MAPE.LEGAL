'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { RefreshCw, Check, X, Coins, MessageSquare } from 'lucide-react';

type Estado = 'pendiente_confirmacion' | 'confirmada' | 'cancelada';

interface Transaction {
  id:                  string;
  numero_whatsapp:     string;
  estado:              Estado;
  detalle:             Record<string, unknown> | null;
  mensaje_original:    string | null;
  respuesta_asistente: string | null;
  created_at:          string;
  updated_at:          string;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const ESTADO_LABEL: Record<Estado, string> = {
  pendiente_confirmacion: 'Pendiente',
  confirmada:             'Confirmada',
  cancelada:              'Cancelada',
};

const ESTADO_TOKEN: Record<Estado, string> = {
  pendiente_confirmacion: 'amber',
  confirmada:             'green',
  cancelada:              'slate',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function formatPhone(p: string): string {
  const cleaned = p.replace(/^whatsapp:/i, '');
  const m = cleaned.match(/^\+?504(\d{4})(\d{4})$/);
  if (m) return `+504 ${m[1]}-${m[2]}`;
  return cleaned;
}

function detalleSummary(d: Transaction['detalle']): string {
  if (!d || typeof d !== 'object') return '—';
  const parts: string[] = [];
  const obj = d as Record<string, unknown>;
  if (typeof obj.servicio === 'string') parts.push(obj.servicio);
  if (typeof obj.tipo === 'string') parts.push(obj.tipo);
  if (typeof obj.municipio === 'string') parts.push(`en ${obj.municipio}`);
  if (typeof obj.manzanas === 'number') parts.push(`${obj.manzanas} mz`);
  if (typeof obj.monto === 'number') parts.push(`L ${obj.monto.toLocaleString('es-HN')}`);
  return parts.join(' · ') || JSON.stringify(d).slice(0, 80);
}

export default function TransaccionesPage() {
  const [filter,   setFilter]   = useState<Estado | 'todos'>('pendiente_confirmacion');
  const [items,    setItems]    = useState<Transaction[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [working,  setWorking]  = useState<string | null>(null);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setError('');
    try {
      const qs = filter === 'todos' ? '' : `?estado=${filter}`;
      const res  = await fetch(`/api/admin/maria/transactions${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setItems(data.transactions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function changeEstado(tx: Transaction, estado: Estado) {
    if (estado === 'cancelada' && !confirm(`¿Cancelar la transacción ${tx.id.slice(0, 8)}?`)) return;
    setWorking(tx.id);
    try {
      const res  = await fetch(`/api/admin/maria/transactions/${tx.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Transacciones de María</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Solicitudes de servicio creadas por WhatsApp · Sincronizado cada 10 segundos
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg cursor-pointer"
          style={{ color: 'var(--slate)' }}
          aria-label="Recargar"
        >
          <RefreshCw size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([
          { v: 'pendiente_confirmacion', label: 'Pendientes' },
          { v: 'confirmada',             label: 'Confirmadas' },
          { v: 'cancelada',              label: 'Canceladas' },
          { v: 'todos',                  label: 'Todas' },
        ] as const).map(c => {
          const active = filter === c.v;
          return (
            <button
              key={c.v}
              onClick={() => setFilter(c.v)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border"
              style={{
                background:  active ? 'var(--ink)'  : 'var(--bg)',
                color:       active ? '#fff'        : 'var(--t2)',
                borderColor: active ? 'var(--ink)'  : 'var(--border)',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-6 text-sm border"
          style={{
            color:       'var(--red)',
            background:  'color-mix(in oklch, var(--red) 14%, white)',
            borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando…</p>
      ) : items.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
        >
          <Coins size={28} strokeWidth={1.5} style={{ color: 'var(--slate-lt)' }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: 'var(--t2)' }}>
            {filter === 'pendiente_confirmacion'
              ? 'No hay transacciones pendientes de confirmar.'
              : 'No hay transacciones en este estado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(tx => {
            const token   = ESTADO_TOKEN[tx.estado];
            const isPend  = tx.estado === 'pendiente_confirmacion';
            const phone   = tx.numero_whatsapp.replace(/^whatsapp:/i, '');
            return (
              <div
                key={tx.id}
                className="rounded-xl border p-5"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: `color-mix(in oklch, var(--${token}) 14%, white)`,
                        color:      `var(--${token})`,
                      }}
                    >
                      <Coins size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold border"
                          style={{
                            background:  `color-mix(in oklch, var(--${token}) 14%, white)`,
                            color:       `var(--${token})`,
                            borderColor: `color-mix(in oklch, var(--${token}) 30%, white)`,
                          }}
                        >
                          {ESTADO_LABEL[tx.estado]}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--t3)' }}>
                          {timeAgo(tx.created_at)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
                        {detalleSummary(tx.detalle)}
                      </div>
                      <Link
                        href={`/admin/maria/conversaciones/${encodeURIComponent(phone)}`}
                        className="text-xs inline-flex items-center gap-1"
                        style={{ color: 'var(--moss)', fontFamily: 'var(--font-mono)' }}
                      >
                        <MessageSquare size={11} strokeWidth={1.5} />
                        {formatPhone(phone)}
                      </Link>
                    </div>
                  </div>

                  {isPend && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeEstado(tx, 'confirmada')}
                        disabled={working === tx.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
                        style={{ background: 'var(--green)', color: '#fff' }}
                      >
                        <Check size={14} strokeWidth={2} /> Confirmar
                      </button>
                      <button
                        onClick={() => changeEstado(tx, 'cancelada')}
                        disabled={working === tx.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer border"
                        style={{
                          background:  'var(--bg)',
                          color:       'var(--red)',
                          borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
                        }}
                      >
                        <X size={14} strokeWidth={2} /> Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {(tx.mensaje_original || tx.respuesta_asistente) && (
                  <div className="mt-4 pt-4 border-t grid sm:grid-cols-2 gap-4" style={{ borderColor: 'var(--border)' }}>
                    {tx.mensaje_original && (
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--slate)' }}>
                          Mensaje original
                        </div>
                        <p className="text-sm italic" style={{ color: 'var(--t2)' }}>
                          &quot;{tx.mensaje_original}&quot;
                        </p>
                      </div>
                    )}
                    {tx.respuesta_asistente && (
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--slate)' }}>
                          Respuesta de María
                        </div>
                        <p className="text-sm" style={{ color: 'var(--t2)' }}>
                          {tx.respuesta_asistente}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
