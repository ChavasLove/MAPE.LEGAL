'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  User,
  Send,
  RefreshCw,
  ArrowLeft,
  Trash2,
  Check,
  X,
  Phone,
  MapPin,
  IdCard,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
 * Types — mirror the response shape of GET /api/admin/maria/conversations/[phone]
 * ──────────────────────────────────────────────────────────────────────── */

interface Message {
  id:              string;
  role:            'user' | 'assistant';
  content:         string;
  created_at:      string;
  numero_whatsapp: string;
}

interface ClienteSlim {
  id:                string;
  nombre:            string | null;
  dpi:               string | null;
  municipio:         string | null;
  situacion_tierra:  string | null;
  tipo_mineral:      string | null;
  telefono_whatsapp: string | null;
  created_at:        string;
}

interface OnboardingSlim {
  estado:     string;
  datos:      Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface PendingTx {
  id:                  string;
  estado:              string;
  detalle:             string | null;
  mensaje_original:    string | null;
  respuesta_asistente: string | null;
  created_at:          string;
}

interface ThreadResponse {
  telefono:     string;
  messages:     Message[];
  cliente:      ClienteSlim    | null;
  onboarding:   OnboardingSlim | null;
  transactions: PendingTx[];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tokens — copied verbatim from the rest of /admin so the bundle reuses
 * the exact same shadow + input styles. DO NOT introduce raw hex.
 * ──────────────────────────────────────────────────────────────────────── */

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

const ONBOARDING_LABELS: Record<string, string> = {
  ASK_NAME:     'Pidiendo nombre',
  ASK_ID:       'Pidiendo DPI',
  ASK_LOCATION: 'Pidiendo ubicación',
  ASK_ROLE:     'Pidiendo rol',
  COMPLETE:     'Completo',
};

const TX_LABELS: Record<string, string> = {
  pendiente_confirmacion: 'Pendiente',
  confirmada:             'Confirmada',
  cancelada:              'Cancelada',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers — phone formatting + relative time + admin-prefix detection.
 * Kept inline because they're page-specific and trivial.
 * ──────────────────────────────────────────────────────────────────────── */

function formatPhone(raw: string): string {
  const stripped = raw.replace(/^whatsapp:/i, '').trim();
  const m = /^(\+?504)(\d{4})(\d{4})$/.exec(stripped);
  if (m) return `+504 ${m[2]}-${m[3]}`;
  return stripped;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60)  return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30)     return `hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12)   return `hace ${months} m`;
  return `hace ${Math.floor(months / 12)} a`;
}

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Admin take-over messages start with `[Admin` (single bracket prefix) — see
 *  POST handler in app/api/admin/maria/conversations/[phone]/route.ts. */
function isAdminTakeover(msg: Message): boolean {
  return msg.role === 'assistant' && msg.content.trimStart().startsWith('[Admin');
}

/** Strip the `[Admin · email]` prefix for display so the bubble shows just
 *  the actual content; the badge already conveys provenance. */
function stripAdminPrefix(content: string): string {
  return content.replace(/^\s*\[Admin[^\]]*\]\s*/, '');
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pill — same recipe as the list page (color-mix 14/30 with the token).
 * ──────────────────────────────────────────────────────────────────────── */

type Token = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'moss';
function Pill({ token, children }: { token: Token; children: React.ReactNode }) {
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

/* ──────────────────────────────────────────────────────────────────────────
 * Cliente field completeness — 5 fields per CLAUDE.md María contract:
 * nombre · dpi · municipio · situacion_tierra · tipo_mineral.
 * ──────────────────────────────────────────────────────────────────────── */

function completeness(c: ClienteSlim): { filled: number; total: number; missing: string[] } {
  const fields: Array<[keyof ClienteSlim, string]> = [
    ['nombre',           'Nombre'],
    ['dpi',              'DPI'],
    ['municipio',        'Municipio'],
    ['situacion_tierra', 'Situación de tierra'],
    ['tipo_mineral',     'Tipo de mineral'],
  ];
  const missing: string[] = [];
  let filled = 0;
  for (const [key, label] of fields) {
    const v = c[key];
    if (typeof v === 'string' && v.trim().length > 0) filled += 1;
    else missing.push(label);
  }
  return { filled, total: fields.length, missing };
}

/* ──────────────────────────────────────────────────────────────────────────
 * ConversationThread — full client island for the [phone] route.
 * ──────────────────────────────────────────────────────────────────────── */

export default function ConversationThread({ phone }: { phone: string }) {
  const decoded = decodeURIComponent(phone);
  const formattedPhone = formatPhone(decoded);

  const [data,    setData]    = useState<ThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [composer,  setComposer]  = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendNotice, setSendNotice] = useState('');

  // Track whether the user is composing — pause polling while typing.
  const composingRef = useRef(false);
  useEffect(() => {
    composingRef.current = composer.length > 0;
  }, [composer]);

  // Track whether the user is at the bottom of the thread — only autoscroll
  // when they are, so reading older messages isn't yanked away on refresh.
  const scrollRef       = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  /* Fetch thread — used for initial load, manual refresh, and 5s polling. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/maria/conversations/${encodeURIComponent(decoded)}`,
        { cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Error al cargar conversación');
      }
      setData(json as ThreadResponse);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar conversación');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [decoded]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5s. Skip if document hidden or user composing.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      if (composingRef.current) return;
      load(true);
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  // Auto-scroll behaviour:
  //  • Initial load → jump to bottom once messages arrive.
  //  • Subsequent updates → only scroll if the user is already at bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !data) return;
    if (!initialScrollDoneRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDoneRef.current = true;
      return;
    }
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [data]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stickToBottomRef.current = dist < 80;
  }

  /* Take-over — POST to the same endpoint, then refresh. */
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = composer.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError('');
    setSendNotice('');
    try {
      const res = await fetch(
        `/api/admin/maria/conversations/${encodeURIComponent(decoded)}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content }),
          cache:   'no-store',
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'No se pudo enviar el mensaje');
      }
      if ((json as { logged?: boolean }).logged === false) {
        setSendNotice('El mensaje se envió por WhatsApp pero no se registró en el historial. Refresca para verificar.');
      }
      setComposer('');
      stickToBottomRef.current = true; // after sending, jump to bottom
      await load(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  /* Onboarding actions */
  async function handleResetOnboarding() {
    if (!confirm('¿Reiniciar el onboarding de este número? Se borrará el progreso actual y María volverá a preguntar desde el inicio.')) return;
    try {
      const res = await fetch(
        `/api/admin/maria/onboarding/${encodeURIComponent(decoded)}`,
        { method: 'DELETE', cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'No se pudo reiniciar el onboarding');
      }
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reiniciar el onboarding');
    }
  }

  /* Transaction actions */
  async function patchTransaction(id: string, estado: 'confirmada' | 'cancelada') {
    try {
      const res = await fetch(
        `/api/admin/maria/transactions/${encodeURIComponent(id)}`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ estado }),
          cache:   'no-store',
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'No se pudo actualizar la transacción');
      }
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la transacción');
    }
  }

  const messages    = data?.messages    ?? [];
  const cliente     = data?.cliente     ?? null;
  const onboarding  = data?.onboarding  ?? null;
  const transactions = data?.transactions ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      {/* LEFT — chat thread */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Sticky thread header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 border rounded-xl mb-4"
          style={{
            background:  'var(--bg)',
            borderColor: 'var(--border)',
            boxShadow:   SHADOW_SM,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/admin/maria/conversaciones"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline cursor-pointer"
              style={{ color: 'var(--moss)' }}
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Volver
            </Link>
            <span
              className="hidden sm:inline-block w-px h-5"
              style={{ background: 'var(--border)' }}
            />
            <div className="flex items-center gap-2 min-w-0">
              <Phone size={14} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
              <span className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {formattedPhone}
              </span>
              {cliente?.nombre && (
                <span className="text-sm truncate" style={{ color: 'var(--t3)' }}>
                  · {cliente.nombre}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              onClick={() => load()}
              className="p-2 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--slate)', background: 'transparent' }}
              title="Recargar"
              type="button"
            >
              <RefreshCw size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Errors */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-sm border"
            style={{
              color:       'var(--red)',
              background:  'color-mix(in oklch, var(--red) 14%, white)',
              borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
            }}
          >
            {error}
          </div>
        )}

        {/* Message scroll area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto rounded-xl border p-5 space-y-4"
          style={{
            background:  'var(--bg-soft)',
            borderColor: 'var(--border)',
            boxShadow:   SHADOW_SM,
            minHeight:   320,
            maxHeight:   'calc(100vh - 18rem)',
          }}
        >
          {loading && messages.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: 'var(--t2)' }}>
              Cargando conversación…
            </p>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--slate-lt)' }} />
              <p className="text-sm" style={{ color: 'var(--t2)' }}>
                Aún no hay mensajes con este número.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              const isAdmin = isAdminTakeover(m);
              const display = isAdmin ? stripAdminPrefix(m.content) : m.content;

              const bubbleStyle: React.CSSProperties = isUser
                ? {
                    background:  'var(--bg)',
                    border:      '1px solid var(--border)',
                    color:       'var(--ink)',
                  }
                : isAdmin
                ? {
                    background:  'color-mix(in oklch, var(--blue) 12%, white)',
                    border:      '1px solid color-mix(in oklch, var(--blue) 28%, white)',
                    color:       'var(--ink)',
                  }
                : {
                    background:  'color-mix(in oklch, var(--moss) 10%, white)',
                    border:      '1px solid color-mix(in oklch, var(--moss) 25%, white)',
                    color:       'var(--ink)',
                  };

              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="flex flex-col" style={{ maxWidth: '70%' }}>
                    <div
                      className="flex items-center gap-2 mb-1 text-xs"
                      style={{ color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}
                    >
                      {isUser ? (
                        <>
                          <User size={12} strokeWidth={1.5} />
                          <span>Cliente</span>
                        </>
                      ) : isAdmin ? (
                        <>
                          <span
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider"
                            style={{
                              background:  'color-mix(in oklch, var(--blue) 14%, white)',
                              color:       'var(--blue)',
                              borderColor: 'color-mix(in oklch, var(--blue) 30%, white)',
                            }}
                          >
                            Admin
                          </span>
                        </>
                      ) : (
                        <>
                          <Bot size={12} strokeWidth={1.5} />
                          <span>María</span>
                        </>
                      )}
                    </div>
                    <div
                      className="px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap break-words"
                      style={bubbleStyle}
                    >
                      {display}
                    </div>
                    <div
                      className={`mt-1 text-xs ${isUser ? 'text-left' : 'text-right'}`}
                      style={{ color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}
                    >
                      {timeOfDay(m.created_at)} · {relativeTime(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="mt-4 rounded-xl border p-3"
          style={{
            background:  'var(--bg)',
            borderColor: 'var(--border)',
            boxShadow:   SHADOW_SM,
          }}
        >
          {(sendError || sendNotice) && (
            <div
              className="mb-2 px-3 py-2 rounded-lg text-xs border"
              style={
                sendError
                  ? {
                      color:       'var(--red)',
                      background:  'color-mix(in oklch, var(--red) 14%, white)',
                      borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
                    }
                  : {
                      color:       'var(--amber)',
                      background:  'color-mix(in oklch, var(--amber) 14%, white)',
                      borderColor: 'color-mix(in oklch, var(--amber) 30%, white)',
                    }
              }
            >
              {sendError || sendNotice}
            </div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Escribe un mensaje en nombre de María. Se enviará por WhatsApp y se marcará como respuesta de Admin."
              rows={3}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none resize-y focus:border-[color:var(--ink)]"
              style={{ ...inputStyle, minHeight: 72, fontFamily: 'var(--font-body)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || composer.trim().length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--ink)', color: '#fff' }}
            >
              <Send size={16} strokeWidth={2} />
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--t3)' }}>
            Cmd/Ctrl + Enter para enviar. El mensaje queda registrado como respuesta de Admin en el hilo.
          </p>
        </form>
      </section>

      {/* RIGHT — context panel */}
      <aside className="w-full lg:w-80 shrink-0 space-y-4">
        {/* Cliente card */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background:  'var(--bg)',
            borderColor: 'var(--border)',
            boxShadow:   SHADOW_SM,
          }}
        >
          <div
            className="px-5 py-3 border-b"
            style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: '#fff', fontFamily: 'var(--font-body)' }}>
              Cliente
            </h2>
          </div>
          <div className="px-5 py-4">
            {cliente ? (
              <div className="space-y-3">
                <ClienteRow icon={<User size={14} strokeWidth={1.5} />} label="Nombre" value={cliente.nombre} />
                <ClienteRow icon={<IdCard size={14} strokeWidth={1.5} />} label="DPI" value={cliente.dpi} mono />
                <ClienteRow icon={<MapPin size={14} strokeWidth={1.5} />} label="Municipio" value={cliente.municipio} />
                <ClienteRow icon={<MapPin size={14} strokeWidth={1.5} />} label="Situación de tierra" value={cliente.situacion_tierra} />
                <ClienteRow icon={<MapPin size={14} strokeWidth={1.5} />} label="Tipo de mineral" value={cliente.tipo_mineral} />

                {/* Completeness bar */}
                <CompletenessBar cliente={cliente} />
              </div>
            ) : (
              <div
                className="rounded-lg px-3 py-3 text-xs border"
                style={{
                  color:       'var(--blue)',
                  background:  'color-mix(in oklch, var(--blue) 12%, white)',
                  borderColor: 'color-mix(in oklch, var(--blue) 28%, white)',
                }}
              >
                Aún no es cliente registrado. María recopilará los datos por WhatsApp.
              </div>
            )}
          </div>
        </div>

        {/* Onboarding card */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background:  'var(--bg)',
            borderColor: 'var(--border)',
            boxShadow:   SHADOW_SM,
          }}
        >
          <div
            className="px-5 py-3 border-b"
            style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: '#fff', fontFamily: 'var(--font-body)' }}>
              Onboarding
            </h2>
          </div>
          <div className="px-5 py-4">
            {onboarding ? (
              <div className="space-y-3">
                <div>
                  {onboarding.estado === 'COMPLETE' ? (
                    <Pill token="green">Completo</Pill>
                  ) : (
                    <Pill token="amber">{ONBOARDING_LABELS[onboarding.estado] ?? onboarding.estado}</Pill>
                  )}
                </div>

                <div>
                  <div
                    className="text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--slate)' }}
                  >
                    Datos capturados
                  </div>
                  <pre
                    className="rounded-lg px-3 py-2 text-xs overflow-x-auto"
                    style={{
                      background:  'var(--bg-soft)',
                      border:      '1px solid var(--border)',
                      color:       'var(--t1)',
                      fontFamily:  'var(--font-mono)',
                    }}
                  >
{onboarding.datos && Object.keys(onboarding.datos).length > 0
  ? JSON.stringify(onboarding.datos, null, 2)
  : '{ }'}
                  </pre>
                </div>

                <div className="text-xs" style={{ color: 'var(--t3)' }}>
                  Actualizado {relativeTime(onboarding.updated_at)}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSendNotice('Para reenviar la pregunta actual, escribe el mensaje desde el composer.')}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer"
                    style={{ color: 'var(--t2)', background: 'transparent', borderColor: 'var(--border)' }}
                  >
                    Reenviar pregunta actual
                  </button>
                  <button
                    type="button"
                    onClick={handleResetOnboarding}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                    style={{
                      color:       'var(--red)',
                      background:  'color-mix(in oklch, var(--red) 14%, white)',
                      border:      '1px solid color-mix(in oklch, var(--red) 30%, white)',
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                    Reiniciar onboarding
                  </button>
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--t3)' }}>—</span>
            )}
          </div>
        </div>

        {/* Transactions card */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background:  'var(--bg)',
            borderColor: 'var(--border)',
            boxShadow:   SHADOW_SM,
          }}
        >
          <div
            className="px-5 py-3 border-b"
            style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: '#fff', fontFamily: 'var(--font-body)' }}>
              Transacciones recientes
            </h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {transactions.length === 0 ? (
              <span style={{ color: 'var(--t3)' }}>Sin transacciones registradas.</span>
            ) : (
              transactions.map((tx) => {
                const isPending = tx.estado === 'pendiente_confirmacion';
                const token: Token =
                  tx.estado === 'confirmada'
                    ? 'green'
                    : tx.estado === 'cancelada'
                    ? 'red'
                    : 'amber';
                return (
                  <div
                    key={tx.id}
                    className="rounded-lg border px-3 py-3"
                    style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Pill token={token}>{TX_LABELS[tx.estado] ?? tx.estado}</Pill>
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--t3)' }}>
                        {relativeTime(tx.created_at)}
                      </span>
                    </div>
                    {tx.detalle && (
                      <p
                        className="text-sm mb-1.5 line-clamp-3"
                        style={{ color: 'var(--ink)' }}
                      >
                        {tx.detalle}
                      </p>
                    )}
                    {tx.mensaje_original && (
                      <p
                        className="text-xs italic line-clamp-2"
                        style={{ color: 'var(--t3)' }}
                      >
                        “{tx.mensaje_original}”
                      </p>
                    )}
                    {isPending && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => patchTransaction(tx.id, 'confirmada')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                          style={{ background: 'var(--moss)', color: '#fff' }}
                        >
                          <Check size={12} strokeWidth={2} />
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => patchTransaction(tx.id, 'cancelada')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                          style={{
                            color:       'var(--red)',
                            background:  'color-mix(in oklch, var(--red) 14%, white)',
                            borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
                          }}
                        >
                          <X size={12} strokeWidth={2} />
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────────────────── */

function ClienteRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon:  React.ReactNode;
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span style={{ color: 'var(--slate)', marginTop: 2 }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--slate)' }}
        >
          {label}
        </div>
        <div
          className="text-sm break-words"
          style={{
            color: value ? 'var(--ink)' : 'var(--t3)',
            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          }}
        >
          {value && value.trim().length > 0 ? value : '—'}
        </div>
      </div>
    </div>
  );
}

function CompletenessBar({ cliente }: { cliente: ClienteSlim }) {
  const { filled, total, missing } = completeness(cliente);
  const pct = Math.round((filled / total) * 100);
  const isComplete = filled === total;
  return (
    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--slate)' }}
        >
          Perfil completo
        </span>
        <span
          className="text-xs font-semibold"
          style={{
            color: isComplete ? 'var(--green)' : 'var(--earth)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {filled}/{total}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}
      >
        <div
          className="h-full transition-all"
          style={{
            width:      `${pct}%`,
            background: isComplete ? 'var(--green)' : 'var(--moss)',
          }}
        />
      </div>
      {missing.length > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--t3)' }}>
          Falta: <span style={{ color: 'var(--t2)' }}>{missing.join(', ')}</span>
        </p>
      )}
    </div>
  );
}
