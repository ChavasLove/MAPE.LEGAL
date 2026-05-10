'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, User, RefreshCw, ArrowRight, MessageCircle, Phone } from 'lucide-react';

interface Conversation {
  telefono:           string;
  last_message_at:    string;
  last_role:          'user' | 'assistant';
  last_preview:       string;
  message_count:      number;
  cliente_id:         string | null;
  cliente_nombre:     string | null;
  cliente_municipio:  string | null;
  onboarding_estado:  string | null;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

const ONBOARDING_LABELS: Record<string, string> = {
  ASK_NAME:     'Nombre',
  ASK_ID:       'DPI',
  ASK_LOCATION: 'Ubicación',
  ASK_ROLE:     'Rol',
  COMPLETE:     'Completo',
};

/**
 * Honduras-style mobile (504 + 8 digits) gets formatted as "+504 XXXX-XXXX".
 * Anything else passes through unchanged. The `whatsapp:` prefix is stripped
 * because that's a transport detail of Twilio/Meta, not the user identity.
 */
function formatPhone(raw: string): string {
  const stripped = raw.replace(/^whatsapp:/i, '').trim();
  const m = /^(\+?504)(\d{4})(\d{4})$/.exec(stripped);
  if (m) return `+504 ${m[2]}-${m[3]}`;
  return stripped;
}

/** Spanish relative-time helper. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60)        return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)        return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)          return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30)           return `hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12)         return `hace ${months} m`;
  return `hace ${Math.floor(months / 12)} a`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

interface PillProps {
  token: 'green' | 'amber' | 'red' | 'blue' | 'slate';
  children: React.ReactNode;
}

function Pill({ token, children }: PillProps) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap"
      style={{
        background:  `color-mix(in oklch, var(--${token}) 14%, white)`,
        color:       `var(--${token})`,
        borderColor: `color-mix(in oklch, var(--${token}) 30%, white)`,
      }}
    >
      {children}
    </span>
  );
}

export default function ConversacionesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [search,        setSearch]        = useState('');
  const [debounced,     setDebounced]     = useState('');
  const isTypingRef = useRef(false);

  // Debounce search input — 300ms delay before triggering a fetch.
  useEffect(() => {
    isTypingRef.current = true;
    const t = setTimeout(() => {
      isTypingRef.current = false;
      setDebounced(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (q: string) => {
    try {
      const url = q ? `/api/admin/maria/conversations?search=${encodeURIComponent(q)}` : '/api/admin/maria/conversations';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Error al cargar conversaciones');
      }
      setConversations(((data as { conversations?: Conversation[] }).conversations) ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(debounced);
  }, [debounced, load]);

  // Auto-refresh every 5s. Skip if document is hidden or user is typing.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      if (isTypingRef.current) return;
      load(debounced);
    }, 5000);
    return () => clearInterval(id);
  }, [debounced, load]);

  // Stat strip counts.
  const total = conversations.length;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayCount = conversations.filter(c => new Date(c.last_message_at).getTime() >= startOfDay.getTime()).length;
  const withClienteCount = conversations.filter(c => c.cliente_id).length;
  const onboardingCount = conversations.filter(c => c.onboarding_estado && c.onboarding_estado !== 'COMPLETE').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Conversaciones de María</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Mensajes en vivo de WhatsApp · Sincronizado cada 5 segundos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              background:  `color-mix(in oklch, var(--moss) 14%, white)`,
              color:       'var(--moss)',
              borderColor: `color-mix(in oklch, var(--moss) 30%, white)`,
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--moss-2)' }}
            />
            En vivo · 5s
          </span>
          <button
            onClick={() => load(debounced)}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--slate)', background: 'transparent' }}
            title="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por teléfono, nombre o contenido…"
          className="w-full max-w-xl px-3 py-2 rounded-lg text-sm outline-none focus:border-[color:var(--ink)]"
          style={inputStyle}
        />
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"        value={total} />
        <StatCard label="Hoy"          value={todayCount} />
        <StatCard label="Con cliente"  value={withClienteCount} />
        <StatCard label="En onboarding" value={onboardingCount} />
      </div>

      {/* Error banner */}
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

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', boxShadow: SHADOW_SM }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--ink)' }}>
              {['Teléfono', 'Cliente', 'Estado', 'Último mensaje', 'Hace', 'Acciones'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#fff' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center"
                  style={{ color: 'var(--t2)', background: 'var(--bg)' }}
                >
                  Cargando conversaciones…
                </td>
              </tr>
            ) : conversations.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center"
                  style={{ background: 'var(--bg)' }}
                >
                  <div className="inline-flex flex-col items-center gap-2">
                    <MessageCircle size={28} strokeWidth={1.5} style={{ color: 'var(--slate-lt)' }} />
                    <p style={{ color: 'var(--t2)' }}>
                      No hay conversaciones aún. María verá los mensajes entrantes desde WhatsApp y aparecerán aquí.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              conversations.map(c => {
                const formatted = formatPhone(c.telefono);
                const isUserLast = c.last_role === 'user';
                return (
                  <tr
                    key={c.telefono}
                    style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}
                    className="hover:bg-[color:var(--bg-soft)]"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                        <Phone size={14} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
                        <span className="font-medium">{formatted}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                        {c.message_count} {c.message_count === 1 ? 'mensaje' : 'mensajes'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {c.cliente_nombre ? (
                        <div>
                          <div style={{ color: 'var(--ink)' }} className="font-medium">{c.cliente_nombre}</div>
                          {c.cliente_municipio && (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                              {c.cliente_municipio}
                            </div>
                          )}
                        </div>
                      ) : c.onboarding_estado ? (
                        <span style={{ color: 'var(--slate)' }}>
                          Lead (Onboarding: {ONBOARDING_LABELS[c.onboarding_estado] ?? c.onboarding_estado})
                        </span>
                      ) : (
                        <span style={{ color: 'var(--slate)' }}>Visitante</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {c.onboarding_estado === 'COMPLETE' ? (
                        <Pill token="green">Completo</Pill>
                      ) : c.onboarding_estado ? (
                        <Pill token="amber">{ONBOARDING_LABELS[c.onboarding_estado] ?? c.onboarding_estado}</Pill>
                      ) : c.cliente_id ? (
                        <Pill token="green">Cliente</Pill>
                      ) : (
                        <Pill token="blue">Visitante</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top max-w-md">
                      <div className="flex items-start gap-2">
                        {isUserLast ? (
                          <User size={14} strokeWidth={1.5} style={{ color: 'var(--slate)', flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <Bot size={14} strokeWidth={1.5} style={{ color: 'var(--moss)', flexShrink: 0, marginTop: 2 }} />
                        )}
                        <span style={{ color: 'var(--t2)' }} className="leading-snug">
                          {truncate(c.last_preview, 60)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap" style={{ color: 'var(--t3)' }}>
                      {relativeTime(c.last_message_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/admin/maria/conversaciones/${encodeURIComponent(c.telefono)}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold cursor-pointer hover:underline"
                        style={{ color: 'var(--moss)' }}
                      >
                        Abrir
                        <ArrowRight size={14} strokeWidth={2} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        background:  'var(--bg)',
        borderColor: 'var(--border)',
        boxShadow:   SHADOW_SM,
      }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--slate)' }}
      >
        {label}
      </div>
      <div
        className="text-3xl mt-1"
        style={{ color: 'var(--earth)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
      >
        {value}
      </div>
    </div>
  );
}
