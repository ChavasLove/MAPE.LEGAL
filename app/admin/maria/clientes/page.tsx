'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { RefreshCw, Trash2, ArrowRight } from 'lucide-react';

/**
 * /admin/maria/clientes
 *
 * Live view of every phone number María has touched on WhatsApp:
 *   - cliente : completed registration (clientes table)
 *   - lead    : in-progress onboarding (onboarding_states)
 *   - visitor : conversation only, no profile yet
 *
 * Auto-refresh every 10s (paused while the user types in the search box).
 * All UI tokens come from DESIGN.md §1 Color Manual v1.0.
 */

type Source = 'cliente' | 'lead' | 'visitor';
type OnboardingEstado =
  | 'ASK_NAME' | 'ASK_ID' | 'ASK_LOCATION' | 'ASK_ROLE' | 'COMPLETE';

interface Row {
  source:            Source;
  cliente_id:        string | null;
  telefono:          string;
  nombre:            string | null;
  dpi:               string | null;
  municipio:         string | null;
  situacion_tierra:  string | null;
  tipo_mineral:      string | null;
  completeness:      number;
  completeness_max:  number;
  onboarding_estado: OnboardingEstado | null;
  last_message_at:   string | null;
  created_at:        string | null;
  updated_at:        string | null;
}

interface ApiResponse {
  rows:   Row[];
  funnel: { ASK_NAME: number; ASK_ID: number; ASK_LOCATION: number; ASK_ROLE: number; COMPLETE: number };
  counts: { total: number; cliente: number; lead: number; visitor: number };
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

// Field labels for the missing-fields summary
const FIELD_LABEL: Record<string, string> = {
  nombre:           'nombre',
  dpi:              'DPI',
  municipio:        'municipio',
  situacion_tierra: 'situación de tierra',
  tipo_mineral:     'mineral',
};

// Source pill — semantic mapping to status tokens
const SOURCE_TOKEN: Record<Source, string> = {
  cliente: 'green',
  lead:    'amber',
  visitor: 'blue',
};
const SOURCE_LABEL: Record<Source, string> = {
  cliente: 'Cliente',
  lead:    'Lead',
  visitor: 'Visitante',
};

const ONBOARDING_LABEL: Record<OnboardingEstado, string> = {
  ASK_NAME:     'Nombre',
  ASK_ID:       'DPI',
  ASK_LOCATION: 'Ubicación',
  ASK_ROLE:     'Rol',
  COMPLETE:     'Completo',
};

function pillStyle(token: string): React.CSSProperties {
  return {
    background:  `color-mix(in oklch, var(--${token}) 14%, white)`,
    color:       `var(--${token})`,
    borderColor: `color-mix(in oklch, var(--${token}) 30%, white)`,
  };
}

function tileStyle(token: string): React.CSSProperties {
  return {
    background:  `color-mix(in oklch, var(--${token}) 12%, white)`,
    borderColor: `color-mix(in oklch, var(--${token}) 30%, white)`,
  };
}

// Format Honduran phone: "+504 9737-3139". Falls back to raw if it doesn't fit.
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('504')) {
    const local = digits.slice(3);
    return `+504 ${local.slice(0, 4)}-${local.slice(4)}`;
  }
  if (digits.length === 8) {
    return `+504 ${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return raw;
}

// Spanish relative time: "hace 5 min", "hace 2 h", "hace 1 d"
function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 0)        return 'ahora';
  const sec = Math.floor(diff / 1000);
  if (sec < 60)        return 'hace un momento';
  const min = Math.floor(sec / 60);
  if (min < 60)        return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24)         return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30)        return `hace ${day} d`;
  const mo = Math.floor(day / 30);
  if (mo < 12)         return `hace ${mo} mes${mo === 1 ? '' : 'es'}`;
  const yr = Math.floor(day / 365);
  return `hace ${yr} año${yr === 1 ? '' : 's'}`;
}

// Build "3/5 · Falta DPI, mineral" copy
function missingSummary(row: Row): string {
  const fields: Array<keyof Row> = ['nombre', 'dpi', 'municipio', 'situacion_tierra', 'tipo_mineral'];
  const missing = fields.filter(f => !row[f]).map(f => FIELD_LABEL[f as string]);
  const ratio = `${row.completeness}/${row.completeness_max}`;
  if (missing.length === 0) return `${ratio} · Perfil completo`;
  return `${ratio} · Falta ${missing.join(', ')}`;
}

const SOURCE_FILTERS: Array<{ key: 'all' | Source; label: string }> = [
  { key: 'all',     label: 'Todos'      },
  { key: 'cliente', label: 'Clientes'   },
  { key: 'lead',    label: 'Leads'      },
  { key: 'visitor', label: 'Visitantes' },
];

const FUNNEL_ORDER: Array<{ key: keyof ApiResponse['funnel']; label: string; token: string }> = [
  { key: 'ASK_NAME',     label: 'Nombre',    token: 'amber' },
  { key: 'ASK_ID',       label: 'DPI',       token: 'amber' },
  { key: 'ASK_LOCATION', label: 'Ubicación', token: 'amber' },
  { key: 'ASK_ROLE',     label: 'Rol',       token: 'amber' },
  { key: 'COMPLETE',     label: 'Completo',  token: 'green' },
];

export default function MariaClientesPage() {
  const [data,        setData]        = useState<ApiResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [debounced,   setDebounced]   = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | Source>('all');
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/maria/clientes', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? 'Error al cargar datos');
      setData(payload as ApiResponse);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Debounce search input by 300ms; mark "typing" to pause auto-refresh
  useEffect(() => {
    isTypingRef.current = true;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDebounced(search.trim().toLowerCase());
      isTypingRef.current = false;
    }, 300);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [search]);

  // Auto-refresh every 10s — paused while user is typing AND when the tab is
  // backgrounded (document.hidden). Without the hidden guard the page kept
  // pulling 500 clientes + 2000 conversation rows every 10s in background
  // tabs, generating gratuitous Supabase egress.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      if (!isTypingRef.current) load(true);
    }, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const filteredRows = useMemo<Row[]>(() => {
    if (!data) return [];
    return data.rows.filter((r: Row) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!debounced) return true;
      const haystack = [
        r.telefono,
        r.nombre ?? '',
        r.municipio ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(debounced);
    });
  }, [data, debounced, sourceFilter]);

  async function handleResetOnboarding(row: Row) {
    if (!confirm(`¿Reiniciar el onboarding de ${formatPhone(row.telefono)}? Se perderán los datos parciales y María iniciará la captura desde cero.`)) {
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/maria/onboarding/${encodeURIComponent(row.telefono)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo reiniciar');
      }
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reiniciar onboarding');
    }
  }

  const counts = data?.counts ?? { total: 0, cliente: 0, lead: 0, visitor: 0 };
  const funnel = data?.funnel ?? { ASK_NAME: 0, ASK_ID: 0, ASK_LOCATION: 0, ASK_ROLE: 0, COMPLETE: 0 };
  const funnelMax = Math.max(1, ...FUNNEL_ORDER.map(f => funnel[f.key]));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Clientes y leads de María</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Datos que María recopila desde WhatsApp · Sincronizado cada 10 segundos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={pillStyle('moss')}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: 'var(--moss-2)' }}
              aria-hidden
            />
            En vivo · 10s
          </span>
          <button
            onClick={() => load()}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--slate)', background: 'transparent' }}
            title="Recargar"
            aria-label="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
        </div>
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
          role="alert"
        >
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { token: 'green', value: counts.cliente, title: 'Clientes',           sub: 'Registrados completos'      },
          { token: 'amber', value: counts.lead,    title: 'Leads en onboarding', sub: 'En captura activa'          },
          { token: 'blue',  value: counts.visitor, title: 'Visitantes',          sub: 'Conversaron sin registrarse' },
          { token: 'slate', value: counts.total,   title: 'Total',              sub: 'Personas únicas'            },
        ].map(card => (
          <div
            key={card.title}
            className="rounded-xl border p-5"
            style={{ ...tileStyle(card.token), boxShadow: SHADOW_SM }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--slate)' }}
            >
              {card.title}
            </div>
            <div
              style={{
                color:      'var(--earth)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize:   '2.5rem',
                lineHeight: 1.05,
              }}
            >
              {card.value}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Funnel strip */}
      <div
        className="rounded-xl border p-5 mb-6"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            Funnel de captura
          </h2>
          <span className="text-xs" style={{ color: 'var(--t3)' }}>
            Estados de onboarding activos
          </span>
        </div>
        <div className="flex items-stretch gap-2">
          {FUNNEL_ORDER.map(seg => {
            const count = funnel[seg.key];
            const grow  = Math.max(1, count) / funnelMax;
            return (
              <div
                key={seg.key}
                className="rounded-lg border px-3 py-3 flex flex-col justify-between"
                style={{
                  ...pillStyle(seg.token),
                  borderRadius: 8,
                  flexGrow:     grow,
                  minWidth:     120,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize:   '1.75rem',
                    lineHeight: 1,
                  }}
                >
                  {count}
                </div>
                <div
                  className="text-xs uppercase tracking-wider mt-2"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                >
                  {seg.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters / search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por teléfono, nombre o municipio…"
          className="w-full lg:max-w-md px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {SOURCE_FILTERS.map(f => {
            const active = sourceFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setSourceFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer"
                style={
                  active
                    ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }
                    : { background: 'var(--bg-soft)', color: 'var(--t2)', borderColor: 'var(--border)' }
                }
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', boxShadow: SHADOW_SM }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--ink)' }}>
              {['Teléfono', 'Tipo', 'Datos recopilados', 'Onboarding', 'Última actividad', 'Acciones'].map(h => (
                <th
                  key={h}
                  scope="col"
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
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--t2)', background: 'var(--bg)' }}
                >
                  Cargando datos de María…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center"
                  style={{ color: 'var(--t2)', background: 'var(--bg)' }}
                >
                  {data && data.rows.length > 0
                    ? 'Ningún registro coincide con los filtros aplicados.'
                    : 'María todavía no ha recopilado datos de clientes. Cuando un número escriba a WhatsApp, aparecerá aquí.'}
                </td>
              </tr>
            ) : (
              filteredRows.map(row => {
                const fields: Array<keyof Row> = ['nombre', 'dpi', 'municipio', 'situacion_tierra', 'tipo_mineral'];
                return (
                  <tr
                    key={`${row.source}-${row.telefono}`}
                    style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}
                    className="hover:bg-[color:var(--bg-soft)] align-top"
                  >
                    {/* Teléfono */}
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                        {formatPhone(row.telefono)}
                      </div>
                      <Link
                        href={`/admin/maria/conversaciones/${encodeURIComponent(row.telefono)}`}
                        className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                        style={{ color: 'var(--moss)' }}
                      >
                        Abrir conversación
                        <ArrowRight size={12} strokeWidth={1.5} />
                      </Link>
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                        style={pillStyle(SOURCE_TOKEN[row.source])}
                      >
                        {SOURCE_LABEL[row.source]}
                      </span>
                    </td>

                    {/* Datos recopilados */}
                    <td className="px-4 py-3" style={{ minWidth: 220 }}>
                      <div className="flex items-center gap-1 mb-1.5">
                        {fields.map(f => {
                          const filled = Boolean(row[f]);
                          return (
                            <div
                              key={f as string}
                              title={`${FIELD_LABEL[f as string]}: ${filled ? 'capturado' : 'pendiente'}`}
                              style={{
                                width:        24,
                                height:       6,
                                borderRadius: 3,
                                background:   filled ? 'var(--green)' : 'var(--border)',
                              }}
                            />
                          );
                        })}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--t3)' }}>
                        {missingSummary(row)}
                      </div>
                    </td>

                    {/* Onboarding */}
                    <td className="px-4 py-3">
                      {row.onboarding_estado ? (
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                          style={pillStyle(row.onboarding_estado === 'COMPLETE' ? 'green' : 'amber')}
                        >
                          {ONBOARDING_LABEL[row.onboarding_estado]}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--t3)' }}>—</span>
                      )}
                    </td>

                    {/* Última actividad */}
                    <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>
                      {relativeTime(row.last_message_at)}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.onboarding_estado && row.onboarding_estado !== 'COMPLETE' && (
                          <button
                            onClick={() => handleResetOnboarding(row)}
                            title="Reiniciar onboarding"
                            className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer hover:underline"
                            style={{ color: 'var(--red)' }}
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                            Reiniciar
                          </button>
                        )}
                        {row.cliente_id && (
                          <Link
                            href="/dashboard/clientes"
                            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                            style={{ color: 'var(--moss)' }}
                          >
                            Ver expedientes
                            <ArrowRight size={12} strokeWidth={1.5} />
                          </Link>
                        )}
                        {!row.cliente_id && (!row.onboarding_estado || row.onboarding_estado === 'COMPLETE') && (
                          <span style={{ color: 'var(--t3)' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: 'var(--t3)' }}>
        Esta vista combina <strong style={{ color: 'var(--ink)' }}>clientes registrados</strong>,{' '}
        <strong style={{ color: 'var(--ink)' }}>leads en onboarding</strong> y{' '}
        <strong style={{ color: 'var(--ink)' }}>visitantes</strong> que conversaron con María sin completar registro.
        El listado se ordena por la actividad más reciente.
      </p>
    </div>
  );
}
