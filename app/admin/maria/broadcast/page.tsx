'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Send, Plus, Trash2, Power, Clock, AlertTriangle, ShieldCheck,
} from 'lucide-react';

type ReportMetric = 'gold' | 'silver' | 'usd_hnl' | 'copper';
type Currency     = 'USD' | 'HNL';
type BroadcastRol = 'minero' | 'comprador' | 'tecnico' | 'admin';

interface MetricConfig {
  metric:      ReportMetric;
  enabled:     boolean;
  currency:    Currency;
  order_index: number;
  updated_at:  string;
  updated_by:  string | null;
}

interface ConfigResponse {
  metrics:        MetricConfig[];
  audience:       BroadcastRol[];
  broadcast_time: string | null;
}

interface Subscriber {
  id:       string;
  telefono: string;
  nombre:   string | null;
  rol:      BroadcastRol;
  activo:   boolean;
  suscrito: boolean;
  created_at: string;
}

interface BroadcastRun {
  id:              string;
  fecha:           string;
  total_enviados:  number;
  total_errores:   number;
  roles_destino:   string[];
  triggered_by:    string;
  error_msg:       string | null;
  aborted_reason:  string | null;
  created_at:      string;
}

const METRIC_LABEL: Record<ReportMetric, string> = {
  gold:    'Oro',
  silver:  'Plata',
  usd_hnl: 'Tipo de cambio (USD→HNL)',
  copper:  'Cobre',
};

const ROLE_LABEL: Record<BroadcastRol, string> = {
  minero:    'Mineros',
  comprador: 'Compradores',
  tecnico:   'Técnicos',
  admin:     'Administradores',
};

const ALL_ROLES: BroadcastRol[] = ['minero', 'comprador', 'tecnico', 'admin'];

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function BroadcastPage() {
  const [config,      setConfig]      = useState<ConfigResponse | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [runs,        setRuns]        = useState<BroadcastRun[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [sendResult,  setSendResult]  = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState('');
  const [showAddSub,    setShowAddSub]    = useState(false);
  const [newSubPhone,   setNewSubPhone]   = useState('');
  const [newSubRol,     setNewSubRol]     = useState<BroadcastRol>('minero');
  const [newSubName,    setNewSubName]    = useState('');
  const [subError,      setSubError]      = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [cfgRes, subRes, logRes] = await Promise.all([
        fetch('/api/admin/broadcast/config',     { cache: 'no-store' }),
        fetch('/api/admin/broadcast/subscribers',{ cache: 'no-store' }),
        fetch('/api/admin/broadcast/log?limit=20',{ cache: 'no-store' }),
      ]);
      const [cfg, sub, log] = await Promise.all([cfgRes.json(), subRes.json(), logRes.json()]);
      if (!cfgRes.ok) throw new Error(cfg.error ?? 'Error config');
      if (!subRes.ok) throw new Error(sub.error ?? 'Error suscriptores');
      if (!logRes.ok) throw new Error(log.error ?? 'Error log');
      setConfig(cfg);
      setSubscribers(sub.subscribers ?? []);
      setRuns(log.runs ?? []);
      setScheduleDraft(cfg.broadcast_time ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function patchConfig(body: Record<string, unknown>) {
    setError('');
    try {
      const res = await fetch('/api/admin/broadcast/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar');
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    }
  }

  async function toggleMetric(m: MetricConfig) {
    await patchConfig({
      action: m.enabled ? 'disable_metric' : 'enable_metric',
      metric: m.metric,
    });
  }

  async function setMetricCurrency(m: MetricConfig, currency: Currency) {
    await patchConfig({ action: 'set_currency', metric: m.metric, currency });
  }

  async function toggleAudience(rol: BroadcastRol) {
    if (!config) return;
    const next = config.audience.includes(rol)
      ? config.audience.filter(r => r !== rol)
      : [...config.audience, rol];
    await patchConfig({ action: 'set_audience', roles: next });
  }

  async function saveSchedule() {
    if (!/^\d{2}:\d{2}$/.test(scheduleDraft)) {
      setError('Hora inválida — usa formato HH:MM');
      return;
    }
    await patchConfig({ action: 'set_schedule', time: scheduleDraft });
  }

  async function triggerBroadcast() {
    if (!confirm('¿Enviar el broadcast ahora a todos los suscriptores activos?')) return;
    setSending(true);
    setSendResult(null);
    setError('');
    try {
      const res = await fetch('/api/admin/broadcast/trigger', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar');
      setSendResult('Broadcast iniciado. El resultado aparecerá en el historial dentro de unos segundos.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar broadcast');
    } finally {
      setSending(false);
    }
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    setSubError('');
    try {
      const res = await fetch('/api/admin/broadcast/subscribers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          telefono: newSubPhone,
          rol:      newSubRol,
          nombre:   newSubName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al añadir');
      setNewSubPhone(''); setNewSubName(''); setNewSubRol('minero');
      setShowAddSub(false);
      await load();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : 'Error al añadir');
    }
  }

  async function patchSubscriber(s: Subscriber, patch: Partial<Subscriber>) {
    setSubError('');
    try {
      const res = await fetch(`/api/admin/broadcast/subscribers/${s.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo actualizar el suscriptor.');
      }
      await load();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : 'Error al actualizar suscriptor');
    }
  }

  async function deleteSubscriber(s: Subscriber) {
    if (!confirm(`¿Eliminar a ${s.telefono} de la lista?`)) return;
    setSubError('');
    try {
      const res = await fetch(`/api/admin/broadcast/subscribers/${s.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo eliminar el suscriptor.');
      }
      await load();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : 'Error al eliminar suscriptor');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Broadcast diario</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Reporte automático de precios para suscriptores · 8:00 AM Honduras
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 rounded-lg cursor-pointer"
            style={{ color: 'var(--slate)' }}
            aria-label="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={triggerBroadcast}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
            style={{ background: 'var(--moss)', color: '#fff' }}
          >
            <Send size={15} strokeWidth={2} />
            {sending ? 'Enviando…' : 'Enviar ahora'}
          </button>
        </div>
      </div>

      {error && <Banner color="red">{error}</Banner>}
      {sendResult && <Banner color="green">{sendResult}</Banner>}

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando…</p>
      ) : (
        <>
          {/* Métricas */}
          <Card title="Métricas del reporte" subtitle="Activa o desactiva los datos que aparecen en el mensaje diario.">
            <div className="grid sm:grid-cols-2 gap-3">
              {(config?.metrics ?? []).map(m => (
                <div
                  key={m.metric}
                  className="flex items-center justify-between p-4 rounded-lg border"
                  style={{
                    background:  m.enabled ? 'var(--bg)' : 'var(--bg-soft)',
                    borderColor: m.enabled
                      ? 'color-mix(in oklch, var(--moss) 25%, white)'
                      : 'var(--border)',
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {METRIC_LABEL[m.metric]}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                      Actualizado {timeAgo(m.updated_at)}{m.updated_by ? ` · ${m.updated_by}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.metric !== 'usd_hnl' && (
                      <select
                        value={m.currency}
                        onChange={e => setMetricCurrency(m, e.target.value as Currency)}
                        className="px-2 py-1 rounded-lg text-xs outline-none"
                        style={inputStyle}
                      >
                        <option value="USD">USD</option>
                        <option value="HNL">HNL</option>
                      </select>
                    )}
                    <button
                      onClick={() => toggleMetric(m)}
                      className="p-2 rounded-lg cursor-pointer"
                      style={{
                        background: m.enabled
                          ? 'color-mix(in oklch, var(--green) 14%, white)'
                          : 'var(--bg-soft)',
                        color: m.enabled ? 'var(--green)' : 'var(--slate)',
                        border: `1px solid ${m.enabled
                          ? 'color-mix(in oklch, var(--green) 30%, white)'
                          : 'var(--border)'}`,
                      }}
                      aria-label={m.enabled ? 'Desactivar' : 'Activar'}
                    >
                      <Power size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Audiencia */}
          <Card title="Audiencia" subtitle="Roles que reciben el broadcast. Vacío = todos los suscriptores activos.">
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(rol => {
                const isOn = config?.audience.includes(rol) ?? false;
                return (
                  <button
                    key={rol}
                    onClick={() => toggleAudience(rol)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border transition-colors"
                    style={{
                      background:  isOn ? 'var(--ink)' : 'var(--bg)',
                      color:       isOn ? '#fff'      : 'var(--t2)',
                      borderColor: isOn ? 'var(--ink)' : 'var(--border)',
                    }}
                  >
                    {ROLE_LABEL[rol]}
                  </button>
                );
              })}
            </div>
            <div className="text-xs mt-3" style={{ color: 'var(--t3)' }}>
              {config?.audience.length === 0
                ? 'Actualmente: todos los roles activos.'
                : `Actualmente: ${config?.audience.map(r => ROLE_LABEL[r]).join(' · ')}.`}
            </div>
          </Card>

          {/* Horario */}
          <Card
            title="Horario"
            subtitle="Hora documentada del cron diario. La programación real vive en vercel.json — actualiza ese archivo para cambiarla en producción."
          >
            <div className="flex items-center gap-3">
              <Clock size={18} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
              <input
                type="time"
                value={scheduleDraft}
                onChange={e => setScheduleDraft(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              <button
                onClick={saveSchedule}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--ink)', color: '#fff' }}
              >
                Guardar
              </button>
              <span className="text-xs" style={{ color: 'var(--t3)' }}>
                Actual: <code style={{ fontFamily: 'var(--font-mono)' }}>{config?.broadcast_time ?? '—'}</code> Honduras (UTC−6)
              </span>
            </div>
          </Card>

          {/* Suscriptores */}
          <Card
            title="Suscriptores"
            subtitle={`${subscribers.filter(s => s.activo && s.suscrito).length} activos · ${subscribers.length} totales`}
            action={
              <button
                onClick={() => setShowAddSub(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: 'var(--moss)', color: '#fff' }}
              >
                <Plus size={14} strokeWidth={2} /> Añadir
              </button>
            }
          >
            {subError && !showAddSub && (
              <div
                role="alert"
                className="text-xs mb-3 px-3 py-2 rounded-lg border"
                style={{
                  color:       'var(--red)',
                  background:  'color-mix(in oklch, var(--red) 8%, white)',
                  borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
                }}
              >
                {subError}
              </div>
            )}
            {showAddSub && (
              <form onSubmit={addSubscriber} className="grid sm:grid-cols-3 gap-3 p-4 rounded-lg mb-4 border"
                    style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)' }}>
                <input
                  value={newSubPhone}
                  onChange={e => setNewSubPhone(e.target.value)}
                  required
                  placeholder="+504 9999-9999"
                  className="px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <input
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newSubRol}
                    onChange={e => setNewSubRol(e.target.value as BroadcastRol)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                    style={{ background: 'var(--ink)', color: '#fff' }}
                  >
                    Añadir
                  </button>
                </div>
                {subError && <div className="sm:col-span-3 text-xs" style={{ color: 'var(--red)' }}>{subError}</div>}
              </form>
            )}

            <div className="rounded-xl border overflow-hidden"
                 style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ink)' }}>
                    {['Teléfono', 'Nombre', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: '#fff' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--t2)' }}>
                        No hay suscriptores. Añade el primero.
                      </td>
                    </tr>
                  ) : subscribers.map(s => (
                    <tr key={s.id}
                        style={{ borderTop: '1px solid var(--border)' }}
                        className="hover:bg-[color:var(--bg-soft)]">
                      <td className="px-4 py-3" style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{s.telefono}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>{s.nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={s.rol}
                          onChange={e => patchSubscriber(s, { rol: e.target.value as BroadcastRol })}
                          className="px-2 py-1 rounded text-xs outline-none border"
                          style={inputStyle}
                        >
                          {ALL_ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Pill on={s.activo} label={s.activo ? 'Activo' : 'Inactivo'} />
                          <Pill on={s.suscrito} label={s.suscrito ? 'Suscrito' : 'Opt-out'} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => patchSubscriber(s, { activo: !s.activo })}
                            title={s.activo ? 'Desactivar' : 'Activar'}
                            className="p-1.5 rounded-lg cursor-pointer hover:bg-[color:var(--bg-soft)]"
                            style={{ color: s.activo ? 'var(--green)' : 'var(--slate)' }}
                          >
                            <Power size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => deleteSubscriber(s)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg cursor-pointer hover:bg-[color:var(--bg-soft)]"
                            style={{ color: 'var(--red)' }}
                          >
                            <Trash2 size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Historial */}
          <Card title="Historial de envíos">
            <div className="rounded-xl border overflow-hidden"
                 style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ink)' }}>
                    {['Fecha', 'Estado', 'Enviados', 'Errores', 'Roles', 'Disparado por'].map(h => (
                      <th key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: '#fff' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--t2)' }}>
                        Sin envíos registrados.
                      </td>
                    </tr>
                  ) : runs.map(r => {
                    const ok = !r.aborted_reason && r.total_errores === 0;
                    return (
                      <tr key={r.id}
                          style={{ borderTop: '1px solid var(--border)' }}
                          className="hover:bg-[color:var(--bg-soft)]">
                        <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>
                          {new Date(r.created_at).toLocaleString('es-HN')}
                          <div className="text-xs" style={{ color: 'var(--t3)' }}>{timeAgo(r.created_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
                                style={{
                                  background: ok
                                    ? 'color-mix(in oklch, var(--green) 14%, white)'
                                    : 'color-mix(in oklch, var(--red) 14%, white)',
                                  color: ok ? 'var(--green)' : 'var(--red)',
                                  borderColor: ok
                                    ? 'color-mix(in oklch, var(--green) 30%, white)'
                                    : 'color-mix(in oklch, var(--red) 30%, white)',
                                }}>
                            {ok ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />}
                            {ok ? 'OK' : (r.aborted_reason ?? 'Con errores')}
                          </span>
                          {r.error_msg && (
                            <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{r.error_msg}</div>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                          {r.total_enviados}
                        </td>
                        <td className="px-4 py-3" style={{
                          color:      r.total_errores > 0 ? 'var(--red)' : 'var(--t2)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {r.total_errores}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>
                          {(r.roles_destino ?? []).join(', ') || 'Todos'}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--t2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {r.triggered_by}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Card({
  title, subtitle, children, action,
}: {
  title:    string;
  subtitle?: string;
  action?:  React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5 mb-6"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
    >
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Banner({ color, children }: { color: 'red' | 'green'; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3 mb-6 text-sm border"
      style={{
        color:       `var(--${color})`,
        background:  `color-mix(in oklch, var(--${color}) 14%, white)`,
        borderColor: `color-mix(in oklch, var(--${color}) 30%, white)`,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  const token = on ? 'green' : 'slate';
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold border"
      style={{
        background:  `color-mix(in oklch, var(--${token}) 14%, white)`,
        color:       `var(--${token})`,
        borderColor: `color-mix(in oklch, var(--${token}) 30%, white)`,
      }}
    >
      {label}
    </span>
  );
}

