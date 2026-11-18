'use client';

// Client island de /dashboard/cadena/consentimientos — lista + alta + revocación.
// El texto del consentimiento es documento legal: [REVISAR CAPITÁN LEGAL].

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Plus, X } from 'lucide-react';
import { ALCANCES_CONSENTIMIENTO, type Consentimiento, type Organizacion, type AlcanceConsentimiento } from '@/lib/cadena/types';
import {
  CARD, EYEBROW, INPUT, MONO_INPUT, MONO, TH, TD, TD_WRAP, BTN_PRIMARY, BTN_GHOST, BTN_SMALL,
  Field, Notice, ErrorBox, MigracionPendiente, TableWrap, EmptyRow, Pill,
  apiFetch, postJson, ApiError, fmtDate, fmtDateTime, shortId, shortHash, orgNombre, ALCANCE_LABEL, TIPO_ORG_LABEL,
} from '@/components/cadena/shared';

interface Props { role: string; canWrite: boolean }
interface ClienteOpt { id: string; nombre: string | null; municipio: string | null }

const STAFF: ReadonlyArray<string> = ['admin', 'abogado', 'tecnico_ambiental'];

interface FormState {
  cliente_id: string; otorgado_a_org_id: string; documento_path: string; hash_sha256: string; fecha_firma: string;
  alcance: Record<AlcanceConsentimiento, boolean>;
}
const EMPTY: FormState = {
  cliente_id: '', otorgado_a_org_id: '', documento_path: '', hash_sha256: '', fecha_firma: '',
  alcance: { expediente: true, documentos: false, lotes: false },
};

export default function ConsentimientosClient({ role, canWrite }: Props) {
  const [rows, setRows] = useState<Consentimiento[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const [revocando, setRevocando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [constancia, setConstancia] = useState('');
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const esStaff = STAFF.includes(role);

  const load = useCallback((signal?: AbortSignal) => {
    return Promise.all([
      apiFetch<{ consentimientos: Consentimiento[] }>('/api/cadena/consentimientos', { signal }),
      apiFetch<{ organizaciones: Organizacion[] }>('/api/cadena/organizaciones', { signal }).catch(() => ({ organizaciones: [] as Organizacion[] })),
    ])
      .then(([c, o]) => {
        setRows(Array.isArray(c.consentimientos) ? c.consentimientos : []);
        setOrgs(Array.isArray(o.organizaciones) ? o.organizaciones : []);
        setLoadError(null); setMigracionPendiente(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.migracionPendiente) { setMigracionPendiente(true); return; }
        setLoadError((e as Error).message || 'No se pudieron cargar los consentimientos.');
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
    fetch('/api/admin/clientes', { cache: 'no-store', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((c) => setClientes(Array.isArray(c) ? c : []))
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') console.error('[cadena/consentimientos] clientes:', e); });
    return () => ctrl.abort();
  }, [formOpen, esStaff]);

  const refresh = () => { setLoading(true); void load(); };
  const set = (k: keyof Omit<FormState, 'alcance'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setSubmitError(null); setSubmitOk(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const hash = form.hash_sha256.trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('El hash SHA-256 debe tener 64 caracteres hexadecimales.');
      if (!Object.values(form.alcance).some(Boolean)) throw new Error('Marque al menos un alcance.');
      await postJson('/api/cadena/consentimientos', {
        cliente_id: form.cliente_id.trim(),
        otorgado_a_org_id: form.otorgado_a_org_id,
        documento_path: form.documento_path.trim(),
        hash_sha256: hash,
        fecha_firma: form.fecha_firma,
        alcance: form.alcance,
      }, ctrl.signal);
      setSubmitOk('Consentimiento registrado.');
      setForm(EMPTY);
      setFormOpen(false);
      await load();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setSubmitError((err as Error).message || 'No se pudo registrar.');
    } finally {
      setBusy(false);
    }
  };

  const revocar = async (id: string) => {
    if (busyRow) return;
    setBusyRow(id); setRowError(null);
    try {
      const body: Record<string, unknown> = {};
      if (motivo.trim()) body.motivo = motivo.trim();
      if (constancia.trim()) body.constancia_path = constancia.trim();
      await postJson(`/api/cadena/consentimientos/${encodeURIComponent(id)}/revocar`, body);
      setRevocando(null); setMotivo(''); setConstancia('');
      await load();
    } catch (err) {
      setRowError((err as Error).message || 'No se pudo revocar.');
    } finally {
      setBusyRow(null);
    }
  };

  const alcanceTexto = (a: Consentimiento['alcance']) =>
    ALCANCES_CONSENTIMIENTO.filter((k) => a?.[k]).map((k) => ALCANCE_LABEL[k]).join(', ') || '—';

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={EYEBROW}>Cadena de custodia · Consentimientos</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)' }}>Consentimientos informados</h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, maxWidth: 760 }}>
            La planta de beneficio participante solo accede al expediente del productor con un consentimiento informado
            vigente, firmado por el productor y registrado aquí con el hash del documento. La revocación cierra el acceso
            desde ese momento; las lecturas anteriores quedan en la bitácora. Texto del consentimiento: [REVISAR CAPITÁN LEGAL].
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={refresh} style={BTN_GHOST} disabled={loading} aria-label="Recargar">
            <RefreshCw size={16} strokeWidth={1.5} /> Recargar
          </button>
          {canWrite && (
            <button type="button" onClick={() => { setSubmitError(null); setSubmitOk(null); setFormOpen((o) => !o); }} style={BTN_PRIMARY}>
              {formOpen ? <X size={16} strokeWidth={1.5} /> : <Plus size={16} strokeWidth={1.5} />}
              {formOpen ? 'Cerrar formulario' : 'Registrar consentimiento'}
            </button>
          )}
        </div>
      </header>

      {migracionPendiente && <MigracionPendiente />}
      <ErrorBox error={loadError} />
      {submitOk && <Notice tone="green">{submitOk}</Notice>}

      {canWrite && formOpen && (
        <form onSubmit={submit} style={{ ...CARD, borderColor: 'var(--border-2)', display: 'grid', gap: 16 }}>
          <div>
            <div style={EYEBROW}>Alta</div>
            <h2 style={{ fontSize: 20, margin: '6px 0 4px', color: 'var(--ink)' }}>Registrar consentimiento</h2>
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
              Se registra el documento firmado (ruta y huella SHA-256), no se sube el archivo. El alcance delimita qué
              puede ver la organización beneficiaria.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Field label="Productor (cliente) *">
              {esStaff ? (
                <select required style={INPUT} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Seleccione —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre ?? shortId(c.id)}{c.municipio ? ` · ${c.municipio}` : ''}</option>)}
                </select>
              ) : (
                <input required style={MONO_INPUT} value={form.cliente_id} onChange={set('cliente_id')} maxLength={64} />
              )}
            </Field>
            <Field label="Otorgado a (organización) *">
              <select required style={INPUT} value={form.otorgado_a_org_id} onChange={set('otorgado_a_org_id')}>
                <option value="">— Seleccione —</option>
                {orgs.filter((o) => o.activo).map((o) => <option key={o.id} value={o.id}>{o.nombre} · {TIPO_ORG_LABEL[o.tipo] ?? o.tipo}</option>)}
              </select>
            </Field>
            <Field label="Documento firmado (ruta) *" help="Ruta en el almacenamiento interno del documento firmado.">
              <input required style={MONO_INPUT} value={form.documento_path} onChange={set('documento_path')} maxLength={300} />
            </Field>
            <Field label="Huella SHA-256 del documento *" help="64 caracteres hexadecimales.">
              <input required style={MONO_INPUT} value={form.hash_sha256} onChange={set('hash_sha256')} maxLength={64} pattern="[0-9a-fA-F]{64}" />
            </Field>
            <Field label="Fecha de firma *">
              <input required type="date" style={MONO_INPUT} value={form.fecha_firma} onChange={set('fecha_firma')} />
            </Field>
            <Field label="Alcance *">
              <div style={{ display: 'grid', gap: 6, fontSize: 14, color: 'var(--t1)' }}>
                {ALCANCES_CONSENTIMIENTO.map((k) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={form.alcance[k]} onChange={(e) => setForm((f) => ({ ...f, alcance: { ...f.alcance, [k]: e.target.checked } }))} />
                    {ALCANCE_LABEL[k]}
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <ErrorBox error={submitError} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={BTN_PRIMARY} disabled={busy}>{busy ? 'Registrando…' : 'Registrar consentimiento'}</button>
            <button type="button" style={BTN_GHOST} onClick={() => setFormOpen(false)} disabled={busy}>Cancelar</button>
          </div>
        </form>
      )}

      <section style={CARD}>
        <div style={{ ...EYEBROW, marginBottom: 12 }}>{loading ? 'Cargando…' : `${rows.length} consentimientos`}</div>
        <ErrorBox error={rowError} />
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" style={TH}>Productor</th>
              <th scope="col" style={TH}>Organización</th>
              <th scope="col" style={TH}>Alcance</th>
              <th scope="col" style={TH}>Estado</th>
              <th scope="col" style={TH}>Firma</th>
              <th scope="col" style={TH}>Revocado</th>
              <th scope="col" style={TH}>Huella</th>
              <th scope="col" style={TH}>Registrado</th>
              {canWrite && <th scope="col" style={TH}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <EmptyRow cols={canWrite ? 9 : 8}>{migracionPendiente ? 'Pendiente de migración.' : 'Sin consentimientos registrados.'}</EmptyRow>}
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={{ ...TD, ...MONO }} title={c.cliente_id}>{shortId(c.cliente_id)}</td>
                <td style={TD_WRAP}>{orgNombre(orgs, c.otorgado_a_org_id)}</td>
                <td style={TD_WRAP}>{alcanceTexto(c.alcance)}</td>
                <td style={TD}>{c.estado === 'vigente' ? <Pill token="var(--green)">Vigente</Pill> : <Pill token="var(--red)">Revocado</Pill>}</td>
                <td style={TD}>{fmtDate(c.fecha_firma)}</td>
                <td style={TD_WRAP}>
                  {c.revocado_en ? fmtDateTime(c.revocado_en) : '—'}
                  {c.revocacion_motivo && <div style={{ fontSize: 12, color: 'var(--t3)' }}>{c.revocacion_motivo}</div>}
                </td>
                <td style={{ ...TD, ...MONO }} title={c.hash_sha256}>{shortHash(c.hash_sha256)}</td>
                <td style={TD}>{fmtDateTime(c.created_at)}</td>
                {canWrite && (
                  <td style={TD_WRAP}>
                    {c.estado === 'vigente' && revocando !== c.id && (
                      <button type="button" style={BTN_SMALL} onClick={() => { setRevocando(c.id); setRowError(null); }} disabled={busyRow !== null}>Revocar</button>
                    )}
                    {revocando === c.id && (
                      <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                        <input style={INPUT} placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
                        <input style={MONO_INPUT} placeholder="Constancia (ruta, opcional)" value={constancia} onChange={(e) => setConstancia(e.target.value)} maxLength={300} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" style={{ ...BTN_SMALL, color: 'var(--red)', borderColor: 'color-mix(in oklch, var(--red) 40%, white)' }} onClick={() => revocar(c.id)} disabled={busyRow === c.id}>
                            {busyRow === c.id ? 'Revocando…' : 'Confirmar revocación'}
                          </button>
                          <button type="button" style={BTN_SMALL} onClick={() => { setRevocando(null); setMotivo(''); setConstancia(''); }} disabled={busyRow === c.id}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </section>
    </div>
  );
}
