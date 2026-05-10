'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ShieldCheck, AlertTriangle, Terminal } from 'lucide-react';

interface AdminAction {
  id:           string;
  user_phone:   string;
  command_type: string;
  payload:      Record<string, unknown> | null;
  success:      boolean;
  error_msg:    string | null;
  created_at:   string;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const COMMAND_LABEL: Record<string, string> = {
  ENABLE_METRIC:       'Habilitar métrica',
  DISABLE_METRIC:      'Desactivar métrica',
  SET_CURRENCY:        'Cambiar moneda',
  SET_AUDIENCE:        'Cambiar audiencia',
  SET_BROADCAST_TIME:  'Cambiar horario',
  SEND_BROADCAST:      'Enviar broadcast',
};

function formatPhone(p: string): string {
  const cleaned = p.replace(/^whatsapp:/i, '');
  const m = cleaned.match(/^\+?504(\d{4})(\d{4})$/);
  if (m) return `+504 ${m[1]}-${m[2]}`;
  return cleaned;
}

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

export default function AuditoriaPage() {
  const [actions,     setActions]     = useState<AdminAction[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [filterCmd,   setFilterCmd]   = useState<string>('');

  const load = useCallback(async () => {
    setError('');
    try {
      const url = filterCmd
        ? `/api/admin/maria/audit?command_type=${encodeURIComponent(filterCmd)}`
        : '/api/admin/maria/audit';
      const res  = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActions(data.actions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [filterCmd]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const cmdTypes = Array.from(new Set(actions.map(a => a.command_type))).sort();

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Auditoría de comandos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Comandos administrativos ejecutados desde WhatsApp · admin_actions
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

      {/* Filter chips */}
      {cmdTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilterCmd('')}
            className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border"
            style={{
              background:  filterCmd === '' ? 'var(--ink)' : 'var(--bg)',
              color:       filterCmd === '' ? '#fff'       : 'var(--t2)',
              borderColor: filterCmd === '' ? 'var(--ink)' : 'var(--border)',
            }}
          >
            Todos
          </button>
          {cmdTypes.map(c => (
            <button
              key={c}
              onClick={() => setFilterCmd(c)}
              className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border"
              style={{
                background:  filterCmd === c ? 'var(--ink)' : 'var(--bg)',
                color:       filterCmd === c ? '#fff'       : 'var(--t2)',
                borderColor: filterCmd === c ? 'var(--ink)' : 'var(--border)',
              }}
            >
              {COMMAND_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando…</p>
      ) : actions.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
        >
          <Terminal size={28} strokeWidth={1.5} style={{ color: 'var(--slate-lt)' }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: 'var(--t2)' }}>
            Sin comandos administrativos registrados todavía.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map(a => (
            <div
              key={a.id}
              className="rounded-xl border p-4"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: a.success
                        ? 'color-mix(in oklch, var(--green) 14%, white)'
                        : 'color-mix(in oklch, var(--red) 14%, white)',
                      color: a.success ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {a.success
                      ? <ShieldCheck size={16} strokeWidth={1.5} />
                      : <AlertTriangle size={16} strokeWidth={1.5} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {COMMAND_LABEL[a.command_type] ?? a.command_type}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold border"
                        style={{
                          background:  a.success
                            ? 'color-mix(in oklch, var(--green) 14%, white)'
                            : 'color-mix(in oklch, var(--red) 14%, white)',
                          color:       a.success ? 'var(--green)' : 'var(--red)',
                          borderColor: a.success
                            ? 'color-mix(in oklch, var(--green) 30%, white)'
                            : 'color-mix(in oklch, var(--red) 30%, white)',
                        }}
                      >
                        {a.success ? 'OK' : 'Falló'}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--t2)' }}>
                      Por <code style={{ fontFamily: 'var(--font-mono)' }}>{formatPhone(a.user_phone)}</code>
                      {' · '}
                      <span style={{ color: 'var(--t3)' }}>
                        {timeAgo(a.created_at)} ({new Date(a.created_at).toLocaleString('es-HN')})
                      </span>
                    </div>
                    {a.payload && Object.keys(a.payload).length > 0 && (
                      <pre
                        className="mt-2 px-3 py-2 rounded-lg text-xs overflow-x-auto"
                        style={{
                          fontFamily:  'var(--font-mono)',
                          background:  'var(--bg-soft)',
                          border:      '1px solid var(--border)',
                          color:       'var(--t2)',
                        }}
                      >
                        {JSON.stringify(a.payload, null, 2)}
                      </pre>
                    )}
                    {a.error_msg && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--red)' }}>
                        {a.error_msg}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
