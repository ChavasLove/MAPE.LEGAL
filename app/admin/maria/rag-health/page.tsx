'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Play, Zap, AlertTriangle, CheckCircle2, XCircle, Activity,
} from 'lucide-react';

// ── Types mirror the JSON shape of /api/admin/maria/rag-health ──────────────
type EnvStatus  = 'ok' | 'missing' | 'placeholder';
type ProbeState = 'ok' | 'error' | 'skipped';

interface HealthResponse {
  timestamp:     string;
  ok:            boolean;
  model:         string;
  expected_dims: number;
  env: {
    OPENAI_API_KEY:            EnvStatus;
    NEXT_PUBLIC_SUPABASE_URL:  EnvStatus;
    SUPABASE_SERVICE_ROLE_KEY: EnvStatus;
  };
  rows: {
    total:             number | null;
    with_embedding:    number | null;
    without_embedding: number | null;
    sample_dim:        number | null;
    error:             string | null;
  };
  rpc: {
    match_maria_knowledge:      { state: ProbeState; error: string | null };
    search_maria_knowledge_fts: { state: ProbeState; error: string | null };
  };
  openai: { state: ProbeState; dims: number | null; error: string | null };
  hint:   string;
}

interface BackfillResponse {
  ok:               boolean;
  model:            string;
  total_candidates: number;
  done:             number;
  failed:           number;
  failures:         Array<{ id: number; reason: string }>;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

export default function RagHealthPage() {
  const [health,    setHealth]    = useState<HealthResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [running,   setRunning]   = useState<'canary' | 'full' | 'force' | null>(null);
  const [lastRun,   setLastRun]   = useState<BackfillResponse | null>(null);
  const [runError,  setRunError]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/maria/rag-health', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function runBackfill(mode: 'canary' | 'full' | 'force') {
    if (mode === 'force' && !confirm('Re-embebir TODAS las filas (incluso las que ya tienen embedding)? Costo OpenAI proporcional al número de filas.')) return;
    setRunning(mode);
    setRunError(null);
    setLastRun(null);
    try {
      const body =
        mode === 'canary' ? { limit: 5 } :
        mode === 'force'  ? { force: true } :
                            {};
      const res = await fetch('/api/admin/maria/embeddings-backfill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunError(data.error ?? `HTTP ${res.status}`);
      } else {
        setLastRun(data);
      }
      // Refresh status panel either way — even a partial run changes counts.
      await load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Error al ejecutar');
    } finally {
      setRunning(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>RAG / Embeddings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Estado del pipeline semántico de María · backfill manual
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

      {error && <Banner color="red">{error}</Banner>}

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando…</p>
      ) : health ? (
        <>
          {/* Overall status banner */}
          <div
            className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3"
            style={{
              background:  `color-mix(in oklch, var(--${health.ok ? 'green' : 'amber'}) 14%, white)`,
              border:      `1px solid color-mix(in oklch, var(--${health.ok ? 'green' : 'amber'}) 30%, white)`,
              color:       `var(--${health.ok ? 'green' : 'amber'})`,
            }}
          >
            {health.ok
              ? <CheckCircle2 size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              : <AlertTriangle size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />}
            <div className="text-sm">
              <div className="font-semibold">{health.ok ? 'RAG operativo' : 'RAG requiere atención'}</div>
              <div className="mt-1 opacity-90">{health.hint}</div>
              <div className="mt-1 text-xs opacity-70 font-mono">
                {new Date(health.timestamp).toLocaleString('es-HN')} · modelo {health.model} · {health.expected_dims} dims
              </div>
            </div>
          </div>

          {/* Probes grid */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <Card title="Variables de entorno">
              <Row label="OPENAI_API_KEY"            status={envToProbe(health.env.OPENAI_API_KEY)}            note={health.env.OPENAI_API_KEY}            />
              <Row label="NEXT_PUBLIC_SUPABASE_URL"  status={envToProbe(health.env.NEXT_PUBLIC_SUPABASE_URL)}  note={health.env.NEXT_PUBLIC_SUPABASE_URL}  />
              <Row label="SUPABASE_SERVICE_ROLE_KEY" status={envToProbe(health.env.SUPABASE_SERVICE_ROLE_KEY)} note={health.env.SUPABASE_SERVICE_ROLE_KEY} />
            </Card>

            <Card title="Filas en maria_knowledge">
              <KV label="Total"                value={health.rows.total} />
              <KV label="Con embedding"        value={health.rows.with_embedding} />
              <KV label="Sin embedding"        value={health.rows.without_embedding} />
              <KV label="Sample dim"           value={health.rows.sample_dim} expected={health.expected_dims} />
              {health.rows.error && (
                <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>{health.rows.error}</p>
              )}
            </Card>

            <Card title="Funciones RPC">
              <Row label="match_maria_knowledge"      status={health.rpc.match_maria_knowledge.state}      note={health.rpc.match_maria_knowledge.error      ?? '—'} />
              <Row label="search_maria_knowledge_fts" status={health.rpc.search_maria_knowledge_fts.state} note={health.rpc.search_maria_knowledge_fts.error ?? '—'} />
            </Card>

            <Card title="OpenAI">
              <Row label={`Probe (${health.model})`} status={health.openai.state} note={health.openai.error ?? (health.openai.dims ? `${health.openai.dims} dims` : '—')} />
            </Card>
          </div>

          {/* Backfill actions */}
          <Card
            title="Backfill de embeddings"
            subtitle="Llena la columna embedding usando OpenAI. Idempotente — el modo normal sólo procesa filas con embedding NULL."
          >
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => runBackfill('canary')}
                disabled={running !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
                style={{ background: 'var(--moss)', color: '#fff' }}
              >
                <Play size={14} strokeWidth={2} />
                {running === 'canary' ? 'Ejecutando…' : 'Canario (5 filas)'}
              </button>
              <button
                onClick={() => runBackfill('full')}
                disabled={running !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
                style={{ background: 'var(--ink)', color: '#fff' }}
              >
                <Activity size={14} strokeWidth={2} />
                {running === 'full' ? 'Ejecutando…' : 'Completar (todas las pendientes)'}
              </button>
              <button
                onClick={() => runBackfill('force')}
                disabled={running !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
                style={{
                  background:  'color-mix(in oklch, var(--red) 14%, white)',
                  color:       'var(--red)',
                  border:      '1px solid color-mix(in oklch, var(--red) 30%, white)',
                }}
              >
                <Zap size={14} strokeWidth={2} />
                {running === 'force' ? 'Ejecutando…' : 'Forzar re-embed total'}
              </button>
            </div>

            {runError && <Banner color="red">{runError}</Banner>}

            {lastRun && (
              <div
                className="rounded-lg border p-4 text-sm"
                style={{
                  background:  lastRun.ok
                    ? 'color-mix(in oklch, var(--green) 8%, white)'
                    : 'color-mix(in oklch, var(--amber) 8%, white)',
                  borderColor: lastRun.ok
                    ? 'color-mix(in oklch, var(--green) 30%, white)'
                    : 'color-mix(in oklch, var(--amber) 30%, white)',
                  color: 'var(--ink)',
                }}
              >
                <div className="flex items-center gap-2 mb-2 font-semibold">
                  {lastRun.ok
                    ? <CheckCircle2 size={16} strokeWidth={1.5} style={{ color: 'var(--green)' }} />
                    : <AlertTriangle size={16} strokeWidth={1.5} style={{ color: 'var(--amber)' }} />}
                  Resultado del backfill
                </div>
                <div className="grid sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div><span style={{ color: 'var(--t3)' }}>Candidatos</span><div className="text-base" style={{ color: 'var(--ink)' }}>{lastRun.total_candidates}</div></div>
                  <div><span style={{ color: 'var(--t3)' }}>Escritas</span><div className="text-base" style={{ color: 'var(--green)' }}>{lastRun.done}</div></div>
                  <div><span style={{ color: 'var(--t3)' }}>Fallidas</span><div className="text-base" style={{ color: lastRun.failed > 0 ? 'var(--red)' : 'var(--slate)' }}>{lastRun.failed}</div></div>
                  <div><span style={{ color: 'var(--t3)' }}>Modelo</span><div className="text-base" style={{ color: 'var(--slate)' }}>{lastRun.model}</div></div>
                </div>
                {lastRun.failures.length > 0 && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--t2)' }}>
                      Primeras {Math.min(20, lastRun.failures.length)} causas:
                    </div>
                    <ul className="text-xs font-mono space-y-1" style={{ color: 'var(--t2)' }}>
                      {lastRun.failures.map(f => (
                        <li key={f.id}>
                          <span style={{ color: 'var(--t3)' }}>#{f.id}</span> · {f.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          <p className="text-xs mt-4" style={{ color: 'var(--t3)' }}>
            Tip: en Vercel → Logs, filtra por <span className="font-mono">[rag]</span> para ver qué ruta (semantic / fts / none) usa María en cada turno.
          </p>
        </>
      ) : null}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Card({
  title, subtitle, children,
}: {
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5 mb-0"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{title}</h2>
      {subtitle && <p className="text-xs mb-3" style={{ color: 'var(--t3)' }}>{subtitle}</p>}
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

function Row({
  label, status, note,
}: {
  label:  string;
  status: ProbeState;
  note?:  string;
}) {
  const token =
    status === 'ok'      ? 'green' :
    status === 'skipped' ? 'slate' :
                            'red';
  const Icon =
    status === 'ok' ? CheckCircle2 :
    status === 'skipped' ? Activity :
                            XCircle;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={14} strokeWidth={1.5} style={{ color: `var(--${token})` }} />
        <span style={{ color: 'var(--t2)' }} className="font-mono truncate">{label}</span>
      </div>
      <span
        className="text-xs ml-3 truncate"
        style={{ color: status === 'ok' ? 'var(--slate)' : `var(--${token})` }}
      >
        {note ?? status}
      </span>
    </div>
  );
}

function KV({
  label, value, expected,
}: {
  label:     string;
  value:     number | null;
  expected?: number;
}) {
  const mismatched = expected != null && value != null && value !== expected;
  const color =
    value == null      ? 'var(--t3)' :
    mismatched         ? 'var(--red)' :
                         'var(--ink)';
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span style={{ color: 'var(--t2)' }} className="font-mono">{label}</span>
      <span className="font-mono" style={{ color }}>
        {value ?? '—'}
        {mismatched && <span className="text-xs ml-1" style={{ color: 'var(--red)' }}>(esperado {expected})</span>}
      </span>
    </div>
  );
}

function envToProbe(s: EnvStatus): ProbeState {
  return s === 'ok' ? 'ok' : 'error';
}
