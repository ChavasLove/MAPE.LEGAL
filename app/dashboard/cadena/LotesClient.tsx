'use client';

// Client island de /dashboard/cadena — lista de lotes + alta de lote
// (comercializador/admin). Tokens del Color Manual v1.0 únicamente.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Plus, X } from 'lucide-react';
import type { Lote, Organizacion, FuenteComercializador } from '@/lib/cadena/types';
import type { ResultadoElegibilidad } from '@/lib/cadena/reglas';
import {
  CARD, EYEBROW, INPUT, MONO_INPUT, MONO, TH, TD, TD_WRAP, BTN_PRIMARY, BTN_GHOST,
  Field, Notice, ErrorBox, MigracionPendiente, TableWrap, EmptyRow, EstadoLotePill,
  apiFetch, postJson, ApiError, fmtDateTime, shortId, orgNombre, MOTIVO_ELEGIBILIDAD_LABEL,
} from '@/components/cadena/shared';

interface Props { role: string }

type FuenteRow = FuenteComercializador & { elegibilidad?: ResultadoElegibilidad };

const PUEDE_CREAR: ReadonlyArray<string> = ['comercializador', 'admin'];

export default function LotesClient({ role }: Props) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);
  const [filtro, setFiltro] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [fuentes, setFuentes] = useState<FuenteRow[]>([]);
  const [form, setForm] = useState({ fuente_id: '', planta_org_id: '', codigo: '' });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<{ codigo: string; id: string; elegibilidad: ResultadoElegibilidad | null } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const puedeCrear = PUEDE_CREAR.includes(role);

  const load = useCallback((signal?: AbortSignal) => {
    return Promise.all([
      apiFetch<{ lotes: Lote[] }>('/api/cadena/lotes', { signal }),
      apiFetch<{ organizaciones: Organizacion[] }>('/api/cadena/organizaciones', { signal }).catch(() => ({ organizaciones: [] as Organizacion[] })),
    ])
      .then(([l, o]) => {
        setLotes(Array.isArray(l.lotes) ? l.lotes : []);
        setOrgs(Array.isArray(o.organizaciones) ? o.organizaciones : []);
        setLoadError(null);
        setMigracionPendiente(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.migracionPendiente) { setMigracionPendiente(true); return; }
        setLoadError((e as Error).message || 'No se pudo cargar la lista de lotes.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    if (!formOpen) return;
    const ctrl = new AbortController();
    apiFetch<{ fuentes: FuenteRow[] }>('/api/cadena/fuentes', { signal: ctrl.signal })
      .then((d) => setFuentes(Array.isArray(d.fuentes) ? d.fuentes : []))
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setSubmitError((e as Error).message || 'No se pudieron cargar las fuentes.');
      });
    return () => ctrl.abort();
  }, [formOpen]);

  const refresh = () => { setLoading(true); void load(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setSubmitError(null); setSubmitOk(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const body: Record<string, unknown> = { fuente_id: form.fuente_id };
      if (form.codigo.trim()) body.codigo = form.codigo.trim();
      if (form.planta_org_id) body.planta_org_id = form.planta_org_id;
      const res = await postJson<{ lote: Lote; elegibilidad?: ResultadoElegibilidad }>('/api/cadena/lotes', body, ctrl.signal);
      setSubmitOk({ codigo: res.lote?.codigo ?? '—', id: res.lote?.id ?? '', elegibilidad: res.elegibilidad ?? null });
      setForm({ fuente_id: '', planta_org_id: '', codigo: '' });
      setFormOpen(false);
      await load();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setSubmitError((err as Error).message || 'No se pudo crear el lote.');
    } finally {
      setBusy(false);
    }
  };

  const plantas = orgs.filter((o) => o.tipo === 'planta' && o.activo);
  const visibles = filtro ? lotes.filter((l) => l.estado === filtro) : lotes;
  const fuenteSel = fuentes.find((f) => f.id === form.fuente_id);

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={EYEBROW}>Cadena de custodia · Lotes</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)' }}>Lotes</h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, maxWidth: 760 }}>
            Cada lote encadena sus eventos por hash desde el origen en mina hasta el refinado. Un lote se bloquea
            cuando su fuente deja de ser elegible o cuando se registra un pago sin referencia bancaria. El registro es
            evidencia de debida diligencia privada; no constituye acto de autoridad ni promesa de pago.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={refresh} style={BTN_GHOST} disabled={loading} aria-label="Recargar">
            <RefreshCw size={16} strokeWidth={1.5} /> Recargar
          </button>
          {puedeCrear && (
            <button type="button" onClick={() => { setSubmitError(null); setSubmitOk(null); setFormOpen((o) => !o); }} style={BTN_PRIMARY}>
              {formOpen ? <X size={16} strokeWidth={1.5} /> : <Plus size={16} strokeWidth={1.5} />}
              {formOpen ? 'Cerrar formulario' : 'Nuevo lote'}
            </button>
          )}
        </div>
      </header>

      {migracionPendiente && <MigracionPendiente />}
      <ErrorBox error={loadError} />

      {submitOk && (
        <Notice tone={submitOk.elegibilidad && !submitOk.elegibilidad.elegible ? 'amber' : 'green'}>
          <div>
            Lote <strong style={MONO}>{submitOk.codigo}</strong> creado.{' '}
            {submitOk.id && <Link href={`/dashboard/cadena/${submitOk.id}`} style={{ color: 'var(--moss)', textDecoration: 'underline' }}>Abrir detalle</Link>}
          </div>
          {submitOk.elegibilidad && <ElegibilidadResumen e={submitOk.elegibilidad} />}
        </Notice>
      )}

      {puedeCrear && formOpen && (
        <form onSubmit={submit} style={{ ...CARD, borderColor: 'var(--border-2)', display: 'grid', gap: 16 }}>
          <div>
            <div style={EYEBROW}>Alta de lote</div>
            <h2 style={{ fontSize: 20, margin: '6px 0 4px', color: 'var(--ink)' }}>Nuevo lote</h2>
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
              El lote nace vinculado a una fuente registrada. Si la fuente no es elegible, el lote se crea bloqueado
              y el motivo queda asentado.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Field label="Fuente *" help="Fuentes registradas por su organización. Si no aparece, regístrela primero en Fuentes.">
              <select required style={INPUT} value={form.fuente_id} onChange={(e) => setForm((f) => ({ ...f, fuente_id: e.target.value }))}>
                <option value="">— Seleccione —</option>
                {fuentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {`Productor ${shortId(f.cliente_id)} · permiso ${f.permiso_municipal_numero ?? 'sin nº'}${f.elegibilidad && !f.elegibilidad.elegible ? ' · NO ELEGIBLE' : ''}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Planta de beneficio participante" help="Opcional al crear; puede asignarse después.">
              <select style={INPUT} value={form.planta_org_id} onChange={(e) => setForm((f) => ({ ...f, planta_org_id: e.target.value }))}>
                <option value="">— Sin asignar —</option>
                {plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Código del lote" help="Opcional: si se omite, el sistema asigna uno.">
              <input style={MONO_INPUT} value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} maxLength={64} />
            </Field>
          </div>
          {fuenteSel?.elegibilidad && !fuenteSel.elegibilidad.elegible && (
            <Notice tone="amber" role="alert">
              <strong>Fuente no elegible.</strong> El lote se creará bloqueado.
              <ElegibilidadResumen e={fuenteSel.elegibilidad} />
            </Notice>
          )}
          <ErrorBox error={submitError} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={BTN_PRIMARY} disabled={busy || !form.fuente_id}>{busy ? 'Creando…' : 'Crear lote'}</button>
            <button type="button" style={BTN_GHOST} onClick={() => setFormOpen(false)} disabled={busy}>Cancelar</button>
          </div>
        </form>
      )}

      <section style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={EYEBROW}>{loading ? 'Cargando…' : `${visibles.length} de ${lotes.length} lotes`}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)' }}>
            Estado
            <select style={{ ...INPUT, width: 'auto', padding: '6px 10px' }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option value="abierto">Abierto</option>
              <option value="bloqueado">Bloqueado</option>
              <option value="conciliado">Conciliado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </label>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" style={TH}>Código</th>
              <th scope="col" style={TH}>Productor</th>
              <th scope="col" style={TH}>Comercializador</th>
              <th scope="col" style={TH}>Planta</th>
              <th scope="col" style={TH}>Estado</th>
              <th scope="col" style={TH}>Motivo de bloqueo</th>
              <th scope="col" style={TH}>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {!loading && visibles.length === 0 && (
              <EmptyRow cols={7}>{migracionPendiente ? 'Pendiente de migración.' : 'Sin lotes para mostrar.'}</EmptyRow>
            )}
            {visibles.map((l) => (
              <tr key={l.id}>
                <td style={{ ...TD, ...MONO }}>
                  <Link href={`/dashboard/cadena/${l.id}`} style={{ color: 'var(--moss)', textDecoration: 'underline', fontWeight: 600 }}>
                    {l.codigo}
                  </Link>
                </td>
                <td style={{ ...TD, ...MONO }} title={l.cliente_id}>{shortId(l.cliente_id)}</td>
                <td style={TD_WRAP}>{orgNombre(orgs, l.comercializador_org_id)}</td>
                <td style={TD_WRAP}>{orgNombre(orgs, l.planta_org_id)}</td>
                <td style={TD}><EstadoLotePill estado={l.estado} /></td>
                <td style={{ ...TD_WRAP, color: l.bloqueo_motivo ? 'var(--red)' : 'var(--t3)' }}>{l.bloqueo_motivo ?? '—'}</td>
                <td style={TD}>{fmtDateTime(l.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </section>
    </div>
  );
}

function ElegibilidadResumen({ e }: { e: ResultadoElegibilidad }) {
  if (e.elegible && e.alertas.length === 0) return <div style={{ marginTop: 4 }}>Fuente elegible, sin alertas.</div>;
  return (
    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
      {e.bloqueos.map((b) => <li key={b} style={{ color: 'var(--red)' }}>{MOTIVO_ELEGIBILIDAD_LABEL[b] ?? b} — bloquea el lote</li>)}
      {e.alertas.map((a) => <li key={a} style={{ color: 'var(--amber)' }}>{MOTIVO_ELEGIBILIDAD_LABEL[a] ?? a}</li>)}
    </ul>
  );
}
