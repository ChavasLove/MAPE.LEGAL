'use client';

// MARÍA — landing page chat widget.
//
// A bottom-right floating pill that expands into a chat panel. History lives
// in sessionStorage (key: `maria-web-history`) and is sent to
// /api/maria/chat on every turn. The seed welcome message is display-only
// and never sent to the API (otherwise María would learn to greet herself).
//
// María always responds in Spanish — the `lang` prop drives chrome labels
// only (open button, placeholder, send button, errors).

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';

type Role = 'user' | 'assistant';
interface Message {
  role: Role;
  content: string;
  // Server-issued HMAC over the assistant content. Required for the server
  // to accept the message back on subsequent turns — without it the server
  // would treat it as a forged/injected assistant turn (BAD_SIG 400).
  sig?: string;
}

const STORAGE_KEY = 'maria-web-history';
// Aligned with the server-side MAX_MESSAGES=30 cap. Stored history is the
// payload sent on the next turn (plus 1 fresh user message), so keep room.
// If this drifts above 30 the user gets a server 400 with no in-app remedy
// because sessionStorage survives reload.
const MAX_STORED_MESSAGES = 28;
const SEND_TIMEOUT_MS = 30_000;

// Hard-coded welcome message (display-only — never sent to /api/maria/chat).
// Capability list per user request: visitors see what María can do up front.
const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: `¡Hola! Soy María, asistente de Corporación Hondureña Tenka.

Te ayudo con consultas sobre minería formal en Honduras. Puedo:

• Cotizar formalización minera, titulación de tierra y contrato de sociedad minera.
• Consultar el precio del oro y la plata del día (LBMA + tipo de cambio + precio de compra de CHT).
• Explicar pasos del Manual Operativo, requisitos ambientales (Ley 104-93, SLAS-2) y el Reglamento Minero (Acuerdo 042-2013).
• Buscar concesiones en el registro público INHGEOMIN (587 registros).
• Conectarte con el equipo CHT por WhatsApp o correo.

¿En qué te ayudo hoy?`,
};

const SHADOW_FLOAT = '0 10px 30px rgba(31,42,56,0.12)';
const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

function loadStored(): Message[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((m): m is Message => {
        if (!m || typeof m !== 'object') return false;
        const role = (m as Message).role;
        const content = (m as Message).content;
        // Strict role narrowing — a poisoned sessionStorage entry with
        // role='system' or role=42 would otherwise hydrate, persist, and
        // get POSTed to the route, which rejects with 400 BAD_BODY and
        // locks the user out of the chat until they manually clear
        // storage.
        return (role === 'user' || role === 'assistant') && typeof content === 'string';
      })
      .map((m): Message => {
        // Preserve `sig` on assistant turns — the server requires it on the
        // next turn. Drop any spurious `sig` from user turns (defensive).
        const base: Message = { role: m.role, content: m.content };
        if (m.role === 'assistant' && typeof (m as Message).sig === 'string') {
          base.sig = (m as Message).sig;
        }
        return base;
      })
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return null;
  }
}

function persistStored(messages: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    );
  } catch {
    /* sessionStorage full or unavailable — non-fatal */
  }
}

interface MariaWidgetProps {
  lang: 'es' | 'en';
}

export default function MariaWidget({ lang }: MariaWidgetProps) {
  const t = useCallback(
    (es: string, en: string) => (lang === 'es' ? es : en),
    [lang],
  );

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottomRef = useRef(true);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  // Tracked so we can abort in-flight requests when the component unmounts
  // (user navigates away mid-request). Without this, the 30 s timer fires
  // ctrl.abort() on an unmounted instance and the catch block setStates leak.
  const activeCtrlRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      activeCtrlRef.current?.abort();
    };
  }, []);

  // Hydrate from sessionStorage on mount (sessionStorage is browser-only).
  // Same hydrate-on-mount pattern as app/page.tsx:29 — react-hooks/set-state-in-effect
  // flags it but the alternative (Suspense + readsync) is overkill for a one-shot
  // restore. Tracked as a benign warning across the codebase per CLAUDE.md.
  useEffect(() => {
    const stored = loadStored();
    if (stored && stored.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(stored);
    }
    setHydrated(true);
  }, []);

  // Persist after each change.
  useEffect(() => {
    if (!hydrated) return;
    // Don't persist the welcome-only seed — that's recreated on next mount
    // automatically. Only persist once there's a real exchange.
    if (messages.length <= 1 && messages[0]?.role === 'assistant') return;
    persistStored(messages);
  }, [messages, hydrated]);

  // Auto-scroll to bottom on new message *if* the user was near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  // When opening, snap to bottom and focus the composer.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    // Focus after a tick so the textarea exists in the DOM.
    const id = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape closes; restore focus to the FAB. The FAB is conditional on `!open`,
  // so it's not in the DOM when Escape fires. Defer focus to the next animation
  // frame so React commits the FAB back first.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        requestAnimationFrame(() => fabRef.current?.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stickToBottomRef.current = dist < 80;
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;

    const userMsg: Message = { role: 'user', content };
    // Build the API payload: drop the welcome seed so María doesn't learn
    // to greet herself. The seed is recognisable as the FIRST message AND
    // an assistant message — once the user has spoken, the welcome stays
    // visible in the UI but is filtered out of the wire payload.
    const apiHistory = messages.filter(
      (m, i) => !(i === 0 && m.role === 'assistant' && m.content === WELCOME_MESSAGE.content),
    );
    // Echo each assistant turn's server-issued `sig` back; the server
    // rejects assistant turns without a valid signature (BAD_SIG).
    const apiMessages = [...apiHistory, userMsg].map((m) =>
      m.role === 'assistant' && m.sig
        ? { role: m.role, content: m.content, sig: m.sig }
        : { role: m.role, content: m.content },
    );

    // Optimistic UI update.
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);
    stickToBottomRef.current = true;

    const ctrl = new AbortController();
    activeCtrlRef.current = ctrl;
    const timeoutId = window.setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);

    let rollback = false;

    try {
      const res = await fetch('/api/maria/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        cache: 'no-store',
        signal: ctrl.signal,
      });
      window.clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      const json = (await res.json().catch(() => ({}))) as {
        reply?: string;
        sig?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        rollback = true;
        if (res.status === 429) {
          setError(
            t(
              'Estás escribiendo muy rápido. Intentá en un momento.',
              'You are sending messages too fast. Try again in a moment.',
            ),
          );
        } else if (json.code === 'BAD_SIG') {
          // Stored history has assistant turns the server can't authenticate
          // (typical after a deploy that rotated the signing secret, or if
          // sessionStorage was tampered with). Reset to a fresh conversation
          // so the user's next send works without a manual reload.
          setMessages([WELCOME_MESSAGE]);
          try {
            window.sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setError(
            t(
              'Iniciamos una conversación nueva. Probá enviar tu mensaje otra vez.',
              'We started a fresh conversation. Try sending your message again.',
            ),
          );
        } else {
          setError(
            json.error ??
              t(
                'No pude responder ahora mismo. Probá de nuevo en unos minutos.',
                'I could not reply right now. Try again in a few minutes.',
              ),
          );
        }
        return;
      }

      const reply = json.reply?.trim();
      if (!reply) {
        rollback = true;
        setError(
          t(
            'Respuesta vacía. Probá de nuevo.',
            'Empty reply. Please try again.',
          ),
        );
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, sig: json.sig }]);
    } catch (e) {
      window.clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      rollback = true;
      if ((e as Error).name === 'AbortError') {
        setError(
          t(
            'La respuesta tardó demasiado. Probá de nuevo.',
            'The response took too long. Please try again.',
          ),
        );
      } else {
        setError(
          t(
            'No pude conectar con el servidor. Revisá tu conexión.',
            'Could not connect to the server. Check your connection.',
          ),
        );
      }
    } finally {
      activeCtrlRef.current = null;
      if (!mountedRef.current) return;
      // Roll back the optimistic user message on any error so retries don't
      // pile onto failed turns. Also restore the input so the user can edit
      // and resend without retyping — fixing the case where a 429/timeout
      // would otherwise concatenate with the next attempt server-side.
      if (rollback) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last && last.role === 'user' && last.content === content
            ? prev.slice(0, -1)
            : prev;
        });
        setInput(content);
      }
      setSending(false);
      // Refocus composer for the next message.
      window.setTimeout(() => {
        if (mountedRef.current) textareaRef.current?.focus();
      }, 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts newline. Cmd/Ctrl+Enter also sends.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* FAB — bottom-right, pill-shaped per DESIGN.md (no rounded-full on action buttons). */}
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('Abrir chat con María', 'Open chat with María')}
          className="maria-fab"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 90,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 8,
            background: 'var(--ink)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: SHADOW_FLOAT,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'color-mix(in oklch, var(--ink) 88%, white)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)';
          }}
        >
          <MessageCircle size={18} strokeWidth={1.5} />
          <span>{t('Pregúntale a María', 'Ask María')}</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label={t('Chat con María', 'Chat with María')}
          className="maria-panel"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 100,
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 96px))',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: SHADOW_FLOAT,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in oklch, var(--moss) 14%, white)',
                  color: 'var(--moss)',
                  border: '1px solid color-mix(in oklch, var(--moss) 30%, white)',
                  flexShrink: 0,
                }}
              >
                <Bot size={18} strokeWidth={1.5} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    fontSize: 15,
                    lineHeight: 1.2,
                  }}
                >
                  {t('María', 'María')}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    color: 'var(--slate)',
                    textTransform: 'uppercase',
                    lineHeight: 1.2,
                    marginTop: 2,
                  }}
                >
                  {t('Asistente · CHT', 'Assistant · CHT')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('Cerrar chat', 'Close chat')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'transparent',
                color: 'var(--slate)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-soft)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </header>

          {/* Message log */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--bg-soft)',
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--ink)',
                    background:
                      m.role === 'user'
                        ? 'var(--bg)'
                        : 'color-mix(in oklch, var(--moss) 10%, white)',
                    border:
                      m.role === 'user'
                        ? '1px solid var(--border)'
                        : '1px solid color-mix(in oklch, var(--moss) 25%, white)',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--slate)',
                    background: 'color-mix(in oklch, var(--moss) 8%, white)',
                    border: '1px solid color-mix(in oklch, var(--moss) 20%, white)',
                  }}
                >
                  {t('María está escribiendo…', 'María is typing…')}
                </div>
              </div>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--red)',
                  background: 'color-mix(in oklch, var(--red) 12%, white)',
                  border: '1px solid color-mix(in oklch, var(--red) 28%, white)',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Composer */}
          <div
            style={{
              padding: 12,
              borderTop: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 8,
                boxShadow: SHADOW_SM,
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('Escribí tu pregunta…', 'Type your question…')}
                rows={2}
                disabled={sending}
                aria-label={t('Mensaje para María', 'Message to María')}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  background: 'transparent',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  padding: '4px 6px',
                  minHeight: 40,
                  maxHeight: 120,
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                aria-label={t('Enviar', 'Send')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: input.trim() && !sending ? 'var(--ink)' : 'var(--t3)',
                  color: '#fff',
                  border: 'none',
                  cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                <Send size={16} strokeWidth={2} />
              </button>
            </div>
            <p
              style={{
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.04em',
                color: 'var(--t3)',
                lineHeight: 1.4,
              }}
            >
              {t(
                'María responde en español. Para trámites formales: WhatsApp +504 9737 3139 · gerencia@mape.legal',
                'María replies in Spanish. For formal requests: WhatsApp +504 9737 3139 · gerencia@mape.legal',
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
