'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  RefreshCw, MessageSquare, UserPlus, Coins, Radio, ShieldCheck, AlertTriangle,
  Clock, ArrowRight,
} from 'lucide-react';

interface Stats {
  conversations_today_count: number;
  unique_phones_today:       number;
  onboarding_funnel:         Record<string, number>;
  leads_in_onboarding:       number;
  pending_transactions:      number;
  last_broadcast: null | {
    fecha:           string;
    total_enviados:  number;
    total_errores:   number;
    aborted_reason:  string | null;
    error_msg:       string | null;
    triggered_by:    string;
    created_at:      string;
  };
  last_admin_command: null | {
    user_phone:   string;
    command_type: string;
    success:      boolean;
    error_msg:    string | null;
    created_at:   string;
  };
  subscribers: {
    total:   number;
    active:  number;
    by_role: Record<string, number>;
  };
  clientes_total: number;
  prices_today: null | {
    fecha:       string;
    oro:         number | null;
    plata:       number | null;
    usd_hnl:     number | null;
    fetched_at:  string | null;
  };
  whatsapp_token_health: {
    ok:          boolean;
    isAuthError: boolean;
    error?:      string;
    displayPhoneNumber?: string;
    verifiedName?: string;
  };
  timestamp: string;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

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

export default function MariaControlPanelPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch('/api/admin/maria/stats', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStats(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar estadísticas');
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const tokenHealthy   = stats?.whatsapp_token_health.ok === true;
  const tokenAuthErr   = stats?.whatsapp_token_health.isAuthError === true;
  const lastBroadcast  = stats?.last_broadcast ?? null;
  const broadcastErr   = !!lastBroadcast?.aborted_reason || (lastBroadcast?.total_errores ?? 0) > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <div
            className="mb-1"
            style={{
              color:           'var(--slate)',
              fontFamily:      'var(--font-mono)',
              fontSize:        11,
              letterSpacing:   '0.18em',
              textTransform:   'uppercase',
              fontWeight:      600,
            }}
          >
            Master Control Panel
          </div>
          <h1 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>
            María · Asistente virtual
          </h1>
          <p className="text-sm" style={{ color: 'var(--slate)' }}>
            Sincronización en vivo con WhatsApp · Actualizado {stats ? timeAgo(stats.timestamp) : '…'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              background:  tokenHealthy
                ? 'color-mix(in oklch, var(--green) 14%, white)'
                : 'color-mix(in oklch, var(--red) 14%, white)',
              color:       tokenHealthy ? 'var(--green)' : 'var(--red)',
              borderColor: tokenHealthy
                ? 'color-mix(in oklch, var(--green) 30%, white)'
                : 'color-mix(in oklch, var(--red) 30%, white)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: tokenHealthy ? 'var(--green)' : 'var(--red)' }}
            />
            {tokenHealthy
              ? 'WhatsApp activo'
              : tokenAuthErr ? 'Token expirado' : 'WhatsApp con error'}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            style={{ color: 'var(--slate)' }}
            aria-label="Recargar"
          >
            <RefreshCw
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              style={loading ? { opacity: 0.5 } : undefined}
            />
          </button>
        </div>
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

      {/* KPI tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiTile
          token="blue"
          icon={<MessageSquare size={20} strokeWidth={1.5} />}
          label="Conversaciones hoy"
          value={stats?.conversations_today_count ?? 0}
          sub={`${stats?.unique_phones_today ?? 0} números únicos`}
          href="/admin/maria/conversaciones"
        />
        <KpiTile
          token="amber"
          icon={<UserPlus size={20} strokeWidth={1.5} />}
          label="Leads en captura"
          value={stats?.leads_in_onboarding ?? 0}
          sub={`${stats?.clientes_total ?? 0} clientes registrados`}
          href="/admin/maria/clientes"
        />
        <KpiTile
          token="earth"
          icon={<Coins size={20} strokeWidth={1.5} />}
          label="Transacciones pendientes"
          value={stats?.pending_transactions ?? 0}
          sub="Esperando confirmación"
          href="/admin/maria/transacciones"
        />
        <KpiTile
          token="green"
          icon={<Radio size={20} strokeWidth={1.5} />}
          label="Suscriptores broadcast"
          value={stats?.subscribers.active ?? 0}
          sub={`${stats?.subscribers.total ?? 0} totales`}
          href="/admin/maria/broadcast"
        />
      </div>

      {/* Two-column status */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Onboarding funnel */}
        <Card title="Funnel de onboarding">
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: 'ASK_NAME',     label: 'Nombre' },
              { key: 'ASK_ID',       label: 'DPI' },
              { key: 'ASK_LOCATION', label: 'Ubicación' },
              { key: 'ASK_ROLE',     label: 'Rol' },
              { key: 'COMPLETE',     label: 'Completo' },
            ].map(s => {
              const count = stats?.onboarding_funnel?.[s.key] ?? 0;
              const isComplete = s.key === 'COMPLETE';
              return (
                <div
                  key={s.key}
                  className="rounded-lg p-3 text-center"
                  style={{
                    background: isComplete
                      ? 'color-mix(in oklch, var(--green) 12%, white)'
                      : 'color-mix(in oklch, var(--amber) 10%, white)',
                    border: `1px solid ${isComplete
                      ? 'color-mix(in oklch, var(--green) 25%, white)'
                      : 'color-mix(in oklch, var(--amber) 25%, white)'}`,
                  }}
                >
                  <div
                    className="text-2xl"
                    style={{
                      color:      isComplete ? 'var(--green)' : 'var(--amber)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                    }}
                  >
                    {count}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>{s.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs" style={{ color: 'var(--t3)' }}>
            Estado de cada conversación de captura. Reinicia cualquier flujo desde la
            página de <Link href="/admin/maria/clientes" className="underline" style={{ color: 'var(--moss)' }}>Clientes</Link>.
          </div>
        </Card>

        {/* Suscriptores */}
        <Card title="Suscriptores por rol">
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'minero',     label: 'Mineros',    token: 'earth' },
              { key: 'comprador',  label: 'Compradores', token: 'blue' },
              { key: 'tecnico',    label: 'Técnicos',   token: 'green' },
              { key: 'admin',      label: 'Admin',      token: 'red' },
            ].map(r => {
              const count = stats?.subscribers.by_role?.[r.key] ?? 0;
              return (
                <div
                  key={r.key}
                  className="rounded-lg p-3 text-center"
                  style={{
                    background: `color-mix(in oklch, var(--${r.token}) 10%, white)`,
                    border:     `1px solid color-mix(in oklch, var(--${r.token}) 25%, white)`,
                  }}
                >
                  <div
                    className="text-2xl"
                    style={{
                      color:      `var(--${r.token})`,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                    }}
                  >
                    {count}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>{r.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs" style={{ color: 'var(--t3)' }}>
              Activos suscritos al broadcast diario.
            </div>
            <Link
              href="/admin/maria/broadcast"
              className="text-xs font-semibold inline-flex items-center gap-1"
              style={{ color: 'var(--moss)' }}
            >
              Gestionar audiencia <ArrowRight size={12} strokeWidth={2} />
            </Link>
          </div>
        </Card>
      </div>

      {/* Last broadcast + last admin command + prices */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Último broadcast">
          {!lastBroadcast ? (
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Sin registro todavía.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    background: broadcastErr
                      ? 'color-mix(in oklch, var(--red) 14%, white)'
                      : 'color-mix(in oklch, var(--green) 14%, white)',
                    color: broadcastErr ? 'var(--red)' : 'var(--green)',
                    borderColor: broadcastErr
                      ? 'color-mix(in oklch, var(--red) 30%, white)'
                      : 'color-mix(in oklch, var(--green) 30%, white)',
                  }}
                >
                  {broadcastErr ? <AlertTriangle size={11} /> : <ShieldCheck size={11} />}
                  {broadcastErr ? 'Con errores' : 'Exitoso'}
                </span>
                <span className="text-xs" style={{ color: 'var(--t3)' }}>
                  <Clock size={11} strokeWidth={1.5} className="inline mr-1" />
                  {timeAgo(lastBroadcast.created_at)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--slate)' }}>Enviados</div>
                  <div style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>
                    {lastBroadcast.total_enviados}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--slate)' }}>Errores</div>
                  <div style={{
                    color:      lastBroadcast.total_errores > 0 ? 'var(--red)' : 'var(--ink)',
                    fontFamily: 'var(--font-display)',
                    fontSize:   22,
                    fontWeight: 600,
                  }}>
                    {lastBroadcast.total_errores}
                  </div>
                </div>
              </div>
              {lastBroadcast.aborted_reason && (
                <div className="text-xs mt-3 p-2 rounded-lg border" style={{
                  background:  'color-mix(in oklch, var(--red) 8%, white)',
                  borderColor: 'color-mix(in oklch, var(--red) 25%, white)',
                  color:       'var(--red)',
                }}>
                  Abortado: {lastBroadcast.aborted_reason}
                  {lastBroadcast.error_msg && <div className="mt-1 opacity-80">{lastBroadcast.error_msg}</div>}
                </div>
              )}
              <div className="text-xs mt-3" style={{ color: 'var(--t3)' }}>
                Disparado por: <code style={{ fontFamily: 'var(--font-mono)' }}>{lastBroadcast.triggered_by}</code>
              </div>
            </>
          )}
        </Card>

        <Card title="Último comando admin">
          {!stats?.last_admin_command ? (
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Sin comandos recientes desde WhatsApp.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    background: stats.last_admin_command.success
                      ? 'color-mix(in oklch, var(--green) 14%, white)'
                      : 'color-mix(in oklch, var(--red) 14%, white)',
                    color: stats.last_admin_command.success ? 'var(--green)' : 'var(--red)',
                    borderColor: stats.last_admin_command.success
                      ? 'color-mix(in oklch, var(--green) 30%, white)'
                      : 'color-mix(in oklch, var(--red) 30%, white)',
                  }}
                >
                  {stats.last_admin_command.success ? 'Ejecutado' : 'Falló'}
                </span>
                <span className="text-xs" style={{ color: 'var(--t3)' }}>
                  {timeAgo(stats.last_admin_command.created_at)}
                </span>
              </div>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                {stats.last_admin_command.command_type}
              </div>
              <div className="text-xs" style={{ color: 'var(--t2)' }}>
                Por <code style={{ fontFamily: 'var(--font-mono)' }}>{stats.last_admin_command.user_phone}</code>
              </div>
              {stats.last_admin_command.error_msg && (
                <div className="text-xs mt-2" style={{ color: 'var(--red)' }}>
                  {stats.last_admin_command.error_msg}
                </div>
              )}
              <Link
                href="/admin/maria/auditoria"
                className="text-xs font-semibold inline-flex items-center gap-1 mt-3"
                style={{ color: 'var(--moss)' }}
              >
                Ver auditoría completa <ArrowRight size={12} strokeWidth={2} />
              </Link>
            </>
          )}
        </Card>

        <Card title="Precios del día">
          {!stats?.prices_today ? (
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Sin precios cargados todavía.</p>
          ) : (
            <>
              <div className="space-y-1.5 text-sm">
                <PriceRow label="Oro (LBMA)"      value={stats.prices_today.oro}     suffix="USD/oz" />
                <PriceRow label="Plata"           value={stats.prices_today.plata}   suffix="USD/oz" />
                <PriceRow label="Tipo de cambio" value={stats.prices_today.usd_hnl} suffix="L/USD" />
              </div>
              <div className="text-xs mt-3" style={{ color: 'var(--t3)' }}>
                Fecha: {stats.prices_today.fecha} ·{' '}
                {stats.prices_today.fetched_at
                  ? `obtenido ${timeAgo(stats.prices_today.fetched_at)}`
                  : 'sin marca de tiempo'}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <Card title="Acciones rápidas">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction href="/admin/maria/conversaciones" icon={<MessageSquare size={16} strokeWidth={1.5} />} label="Ver conversaciones" />
          <QuickAction href="/admin/maria/clientes"        icon={<UserPlus size={16} strokeWidth={1.5} />}      label="Clientes y leads" />
          <QuickAction href="/admin/maria/transacciones"   icon={<Coins size={16} strokeWidth={1.5} />}         label="Transacciones" />
          <QuickAction href="/admin/maria/broadcast"       icon={<Radio size={16} strokeWidth={1.5} />}         label="Broadcast diario" />
        </div>
      </Card>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>{title}</h2>
      {children}
    </div>
  );
}

function KpiTile({
  token, icon, label, value, sub, href,
}: {
  token: 'blue' | 'amber' | 'earth' | 'green';
  icon:  React.ReactNode;
  label: string;
  value: number;
  sub:   string;
  href:  string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-5 flex flex-col gap-3 transition-colors"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: `color-mix(in oklch, var(--${token}) 12%, white)`,
            color:      `var(--${token})`,
          }}
        >
          {icon}
        </div>
        <ArrowRight size={14} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
      </div>
      <div>
        <div
          style={{
            color:      `var(--${token})`,
            fontFamily: 'var(--font-display)',
            fontSize:   28,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div className="text-sm font-semibold mt-1" style={{ color: 'var(--ink)' }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{sub}</div>
      </div>
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-colors hover:opacity-90"
      style={{
        background:  'var(--bg-soft)',
        borderColor: 'var(--border)',
        color:       'var(--ink)',
      }}
    >
      <span className="flex items-center gap-2">
        <span style={{ color: 'var(--moss)' }}>{icon}</span>
        {label}
      </span>
      <ArrowRight size={14} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
    </Link>
  );
}

function PriceRow({ label, value, suffix }: { label: string; value: number | null; suffix: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--slate)' }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {value != null && value > 0
          ? `${value.toLocaleString('es-HN', { maximumFractionDigits: 2 })} ${suffix}`
          : '—'}
      </span>
    </div>
  );
}
