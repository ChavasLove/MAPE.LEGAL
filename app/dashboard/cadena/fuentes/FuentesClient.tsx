'use client';

// Client island de /dashboard/cadena/fuentes — lista + alta de fuente con
// previsualización de elegibilidad (evaluarElegibilidadFuente, regla pura).
// Para roles de CHT los selectores de productor y mina usan las APIs admin;
// el comercializador no puede llamarlas y escribe los identificadores a mano.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Plus, X } from 'lucide-react';
import { ESTADOS_CLPI, type FuenteComercializador, type Organizacion, type EstadoClpi } from '@/lib/cadena/types';
import { evaluarElegibilidadFuente, type ResultadoElegibilidad } from '@/lib/cadena/reglas';
import {
  CARD, EYEBROW, INPUT, MONO_INPUT, MONO, TH, TD, TD_WRAP, BTN_PRIMARY, BTN_GHOST,
  Field, Notice, ErrorBox, MigracionPendiente, TableWrap, EmptyRow, Pill,
  apiFetch, postJson, ApiError, fmtDate, fmtDateTime, shortId, orgNombre, CLPI_LABEL, MOTIVO_ELEGIBILIDAD_LABEL,
} from '@/components/cadena/shared';

interface Props { role: string }
type FuenteRow = FuenteComercializador & { elegibilidad?: ResultadoElegibilidad };
interface ClienteOpt { id: string; nombre: string | null; municipio: string | null }
interface MinaOpt { id: string; nombre: string | null; codigo: string | null; cliente_id: string | null }

const STAFF: ReadonlyArray<string> = ['admin', 'abogado', 'tecnico_ambiental'];
const PUEDE_CREAR: ReadonlyArray<string> = ['comercializador', 'admin'];

interface FormState {
  organizacion_id: string; cliente_id: string; mina_id: string;
  permiso_municipal_numero: string; permiso_vigente_hasta: string;
  dentro_area_inhgeomin: '' | 'si' | 'no'; declaracion_mercurio_cero: '' | 'si' | 'no';
  clpi_estado: EstadoClpi;
}
const EMPTY: FormState = {
  organizacion_id: '', cliente_id: '', mina_id: '', permiso_municipal_numero: '', permiso_vigente_hasta: '',
  dentro_area_inhgeomin: '', declaracion_mercurio_cero: '', clpi_estado: 'pendiente',
};

export default function FuentesClient({ role }: Props) {
  const [fuentes, setFuentes] = useState<FuenteRow[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [minas, setMinas] = useState<MinaOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<ResultadoElegibilidad | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const esStaff = STAFF.includes(role);
  const puedeCrear = PUEDE_CREAR.includes(role);

  const load = useCallback((signal?: AbortSignal) => {
    return Promise.all([
      apiFetch<{ fuentes: FuenteRow[] }>('/api/cadena/fuentes', { signal }),
      apiFetch<{ organizaciones: Organizacion[] }>('/api/cadena/organizaciones', { signal }).catch(() => ({ organizaciones: [] as Organizacion[] })),
    ])
      .then(([f, o]) => {
        setFuentes(Array.isArray(f.fuentes) ? f.fuentes : []);
        setOrgs(Array.isArray(o.organizaciones) ? o.organizaciones : []);
        setLoadError(null); setMigracionPendiente(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.migracionPendiente) { setMigracionPendiente(true); return; }
        setLoadError((e as Error).message || 'No se pudieron cargar las fuentes.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    if (!formOpen || !esStaff) return;
    const ctrl = new AbortController();
    Promise.all([
      fetch('/api/admin/clientes', { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/minas', { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, m]) => {
        setClientes(Array.isArray(c) ? c : []);
        setMinas(Array.isArray(m) ? m : []);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') console.error('[cadena/fuentes] listas admin:', e);
      });
    return () => ctrl.abort();
  }, [formOpen, esStaff]);

  const refresh = () => { setLoading(true); void load(); };
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const orgsComercializador = orgs.filter((o) => o.tipo === 'comercializador' && o.activo);

  const preview = useMemo(() => evaluarElegibilidadFuente({
    permiso_vigente_hasta: form.permiso_vigente_hasta || null,
    dentro_area_inhgeomin: form.dentro_area_inhgeomin === '' ? null : form.dentro_area_inhgeomin === 'si',
    declaracion_mercurio_cero: form.declaracion_mercurio_cero === '' ? null : form.declaracion_mercurio_cero === 'si',
    clpi_estado: form.clpi_estado,
  }), [form]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setSubmitError(null); setSubmitOk(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const orgId = form.organizacion_id || (orgsComercializador.length === 1 ? orgsComercializador[0].id : '');
      const body: Record<string, unknown> = {
        cliente_id: form.cliente_id.trim(),
        mina_id: form.mina_id.trim() || null,
        permiso_municipal_numero: form.permiso_municipal_numero.trim() || null,
        permiso_vigente_hasta: form.permiso_vigente_hasta || null,
        dentro_area_inhgeomin: form.dentro_area_inhgeomin === '' ? null : form.dentro_area_inhgeomin === 'si',
        declaracion_mercurio_cero: form.declaracion_mercurio_cero === '' ? null : form.declaracion_mercurio_cero === 'si',
        clpi_estado: form.clpi_estado,
        documentos: {},
      };
      if (orgId) body.organizacion_id = orgId;
      const res = await postJson<{ fuente: FuenteComercializador; elegibilidad?: ResultadoElegibilidad }>('/api/cadena/fuentes', body, ctrl.signal);
      setSubmitOk(res.elegibilidad ?? preview);
      setForm(EMPTY);
      setFormOpen(false);
      await load();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setSubmitError((err as Error).message || 'No se pudo registrar la fuente.');
    } finally {
      setBusy(false);
    }
  };

  const minasDelCliente = form.cliente_id ? minas.filter((m) => !m.cliente_id || m.cliente_id === form.cliente_id) : minas;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={EYEBROW}>Cadena de custodia · Fuentes</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)' }}>Fuentes</h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, maxWidth: 760 }}>
            Una fuente es el origen declarado de un lote: productor, mina y permiso municipal. Sin permiso municipal
            vigente o fuera de un área delimitada por INHGEOMIN el lote se bloquea (Art. 90 LGM — [VERIFICAR LEGAL
            MINERO]). Sin documento de consulta previa cuando era exigible, el origen no es elegible.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={refresh} style={BTN_GHOST} disabled={loading} aria-label="Recargar">
            <RefreshCw size={16} strokeWidth={1.5} /> Recargar
          </button>
          {puedeCrear && (
            <button type="button" onClick={() => { setSubmitError(null); setSubmitOk(null); setFormOpen((o) => !o); }} style={BTN_PRIMARY}>
              {formOpen ? <X size={16} strokeWidth={1.5} /> : <Plus size={16} strokeWidth={1.5} />}
              {formOpen ? 'Cerrar formulario' : 'Registrar fuente'}
            </button>
          )}
        </div>
      </header>

      {migracionPendiente && <MigracionPendiente />}
      <ErrorBox error={loadError} />
      {submitOk && (
        <Notice tone={submitOk.elegible ? 'green' : 'amber'}>
          <strong>Fuente registrada.</strong> <Elegibilidad e={submitOk} />
        </Notice>
      )}

      {puedeCrear && formOpen && (
        <form onSubmit={submit} style={{ ...CARD, borderColor: 'var(--border-2)', display: 'grid', gap: 16 }}>
          <div>
            <div style={EYEBROW}>Alta de fuente</div>
            <h2 style={{ fontSize: 20, margin: '6px 0 4px', color: 'var(--ink)' }}>Registrar fuente</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {orgsComercializador.length > 1 && (
              <Field label="Comercializador *">
                <select required style={INPUT} value={form.organizacion_id} onChange={set('organizacion_id')}>
                  <option value="">— Seleccione —</option>
                  {orgsComercializador.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </Field>
            )}
            {esStaff ? (
              <Field label="Productor (cliente) *">
                <select required style={INPUT} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Seleccione —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre ?? shortId(c.id)}{c.municipio ? ` · ${c.municipio}` : ''}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Identificador del productor (cliente_id) *" help="Identificador que le entregó CHT para este productor. Las listas de productores no están disponibles para su rol.">
                <input required style={MONO_INPUT} value={form.cliente_id} onChange={set('cliente_id')} maxLength={64} />
              </Field>
            )}
            {esStaff ? (
              <Field label="Mina">
                <select style={INPUT} value={form.mina_id} onChange={set('mina_id')}>
                  <option value="">— Sin mina vinculada —</option>
                  {minasDelCliente.map((m) => <option key={m.id} value={m.id}>{m.nombre ?? shortId(m.id)}{m.codigo ? ` · ${m.codigo}` : ''}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Identificador de la mina (mina_id)" help="Opcional. Identificador entregado por CHT.">
                <input style={MONO_INPUT} value={form.mina_id} onChange={set('mina_id')} maxLength={64} />
              </Field>
            )}
            <Field label="Permiso municipal — número">
              <input style={MONO_INPUT} value={form.permiso_municipal_numero} onChange={set('permiso_municipal_numero')} maxLength={64} />
            </Field>
            <Field label="Permiso municipal — vigente hasta" help="Sin fecha o vencido, el lote se bloquea.">
              <input type="date" style={MONO_INPUT} value={form.permiso_vigente_hasta} onChange={set('permiso_vigente_hasta')} />
            </Field>
            <Field label="Dentro de un área delimitada por INHGEOMIN">
              <select style={INPUT} value={form.dentro_area_inhgeomin} onChange={set('dentro_area_inhgeomin')}>
                <option value="">— Sin declarar —</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Declaración de mercurio cero" help="No bloquea; genera alerta si falta.">
              <select style={INPUT} value={form.declaracion_mercurio_cero} onChange={set('declaracion_mercurio_cero')}>
                <option value="">— Sin declarar —</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Consulta previa (CLPI) *" help="Documentado = consta acta. Pendiente = exigible sin documento: el origen no es elegible.">
              <select required style={INPUT} value={form.clpi_estado} onChange={set('clpi_estado')}>
                {ESTADOS_CLPI.map((c) => <option key={c} value={c}>{CLPI_LABEL[c]}</option>)}
              </select>
            </Field>
          </div>

          <Notice tone={preview.elegible ? (preview.alertas.length ? 'amber' : 'green') : 'red'}>
            <strong>Previsualización de elegibilidad:</strong> <Elegibilidad e={preview} />
          </Notice>

          <ErrorBox error={submitError} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={BTN_PRIMARY} disabled={busy}>{busy ? 'Registrando…' : 'Registrar fuente'}</button>
            <button type="button" style={BTN_GHOST} onClick={() => setFormOpen(false)} disabled={busy}>Cancelar</button>
          </div>
        </form>
      )}

      <section style={CARD}>
        <div style={{ ...EYEBROW, marginBottom: 12 }}>{loading ? 'Cargando…' : `${fuentes.length} fuentes`}</div>
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" style={TH}>Productor</th>
              <th scope="col" style={TH}>Mina</th>
              <th scope="col" style={TH}>Comercializador</th>
              <th scope="col" style={TH}>Permiso municipal</th>
              <th scope="col" style={TH}>Vigente hasta</th>
              <th scope="col" style={TH}>Área INHGEOMIN</th>
              <th scope="col" style={TH}>Mercurio cero</th>
              <th scope="col" style={TH}>CLPI</th>
              <th scope="col" style={TH}>Elegibilidad</th>
              <th scope="col" style={TH}>Registrada</th>
            </tr>
          </thead>
          <tbody>
            {!loading && fuentes.length === 0 && <EmptyRow cols={10}>{migracionPendiente ? 'Pendiente de migración.' : 'Sin fuentes registradas.'}</EmptyRow>}
            {fuentes.map((f) => {
              const el = f.elegibilidad ?? evaluarElegibilidadFuente(f);
              return (
                <tr key={f.id}>
                  <td style={{ ...TD, ...MONO }} title={f.cliente_id}>{shortId(f.cliente_id)}</td>
                  <td style={{ ...TD, ...MONO }} title={f.mina_id ?? undefined}>{shortId(f.mina_id)}</td>
                  <td style={TD_WRAP}>{orgNombre(orgs, f.organizacion_id)}</td>
                  <td style={{ ...TD, ...MONO }}>{f.permiso_municipal_numero ?? '—'}</td>
                  <td style={TD}>{fmtDate(f.permiso_vigente_hasta)}</td>
                  <td style={TD}>{siNo(f.dentro_area_inhgeomin)}</td>
                  <td style={TD}>{siNo(f.declaracion_mercurio_cero)}</td>
                  <td style={TD}>{CLPI_LABEL[f.clpi_estado] ?? f.clpi_estado}</td>
                  <td style={TD_WRAP}>
                    {el.elegible
                      ? <Pill token={el.alertas.length ? 'var(--amber)' : 'var(--green)'}>{el.alertas.length ? 'Elegible con alerta' : 'Elegible'}</Pill>
                      : <Pill token="var(--red)">No elegible</Pill>}
                    {!el.elegible && (
                      <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                        {el.bloqueos.map((b) => MOTIVO_ELEGIBILIDAD_LABEL[b] ?? b).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={TD}>{fmtDateTime(f.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </section>
    </div>
  );
}

function siNo(v: boolean | null): string {
  return v === null || v === undefined ? '—' : v ? 'Sí' : 'No';
}

function Elegibilidad({ e }: { e: ResultadoElegibilidad }) {
  if (e.elegible && e.alertas.length === 0) return <span>fuente elegible, sin alertas.</span>;
  return (
    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
      {e.bloqueos.map((b) => <li key={b} style={{ color: 'var(--red)' }}>{MOTIVO_ELEGIBILIDAD_LABEL[b] ?? b} — bloquea el lote</li>)}
      {e.alertas.map((a) => <li key={a} style={{ color: 'var(--amber)' }}>{MOTIVO_ELEGIBILIDAD_LABEL[a] ?? a}</li>)}
    </ul>
  );
}
