'use client';

// Client island de /dashboard/certificados.
//
// Tabla de registros + formulario "Registrar documento oficial + sello" en
// tres bloques separados a propósito (la distinción es jurídica, no estética):
//   1. Documento oficial — lo emite el TITULAR, lo autentica la AUTORIDAD.
//   2. Sello complementario MAPE.LEGAL — folio, QR (solo la URL), hash.
//   3. Copia al minero — estado de entrega y constancia.
//
// Sin impresión de QR (se muestra la URL que codificará). Sin subida de
// archivos (los *_path se registran como texto). Sin botón de eliminar: los
// registros son indelebles; el retiro es cambiar `estado`.
// Tokens del Color Manual v1.0 únicamente (cero hex nuevos).

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, X, ExternalLink } from 'lucide-react';
import {
  COPIA_MINERO_ESTADOS,
  COPIA_MINERO_LABELS,
  EMISOR_TITULAR_TIPOS,
  EMISOR_TITULAR_LABELS,
  CERTIFICADO_ESTADOS,
  buildQrUrl,
  type CertificadoRegistro,
  type CopiaMineroEstado,
} from '@/lib/certificados/sello';

interface MinaSlim { id: string; nombre: string | null; codigo: string | null; municipio: string | null }
type Row = CertificadoRegistro & { mina: MinaSlim | null };
interface ListResponse { migracion_aplicada: boolean; rows: Row[] }
interface MinaOption { id: string; nombre: string; codigo: string | null; municipio: string | null }

interface Props { canWrite: boolean }

// ── Estilos (tokens) ───────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 };
const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--t1)',
};
const MONO_INPUT: React.CSSProperties = { ...INPUT, fontFamily: 'var(--font-mono)' };
const HELP: React.CSSProperties = { fontSize: 12, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 };
const TH: React.CSSProperties = {
  background: 'var(--ink)', color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'var(--slate)',
};
const BTN_PRIMARY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8,
  background: 'var(--ink)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
};
const BTN_GHOST: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8,
  background: 'transparent', color: 'var(--t2)', fontSize: 14, fontWeight: 500,
  border: '1px solid var(--border)', cursor: 'pointer',
};

function Pill({ token, children }: { token: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600,
      fontFamily: 'var(--font-body)', color: token,
      background: `color-mix(in oklch, ${token} 14%, white)`,
      border: `1px solid color-mix(in oklch, ${token} 30%, white)`,
    }}>
      {children}
    </span>
  );
}

const ESTADO_TOKEN: Record<string, string> = {
  vigente: 'var(--green)', revocado: 'var(--red)', expirado: 'var(--slate)', suspendido: 'var(--amber)',
};
const COPIA_TOKEN: Record<CopiaMineroEstado, string> = {
  pendiente: 'var(--amber)', entregada: 'var(--blue)', constancia_firmada: 'var(--green)',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ── Formulario ─────────────────────────────────────────────────────────────
interface FormState {
  // Documento oficial
  emisor_titular: string; emisor_titular_tipo: string; autoridad_autentica: string;
  autoridad_autentica_fecha: string; numero_documento_oficial: string; fecha_emision: string;
  mina_id: string; peso_oro_g: string; ley_oro_kt: string;
  escaneo_documento_oficial_path: string; escaneo_documento_oficial_hash_sha256: string;
  // Sello
  numero_sello: string; folio_talonario: string; valido_hasta: string; estado: string;
  ejemplar_sello_escaneo_path: string; hash_sha256: string;
  // Copia al minero
  copia_minero_estado: CopiaMineroEstado; copia_minero_fecha: string; copia_minero_constancia_path: string;
  notas: string;
}

const EMPTY: FormState = {
  emisor_titular: '', emisor_titular_tipo: '', autoridad_autentica: '', autoridad_autentica_fecha: '',
  numero_documento_oficial: '', fecha_emision: '', mina_id: '', peso_oro_g: '', ley_oro_kt: '',
  escaneo_documento_oficial_path: '', escaneo_documento_oficial_hash_sha256: '',
  numero_sello: '', folio_talonario: '', valido_hasta: '', estado: 'vigente',
  ejemplar_sello_escaneo_path: '', hash_sha256: '',
  copia_minero_estado: 'pendiente', copia_minero_fecha: '', copia_minero_constancia_path: '',
  notas: '',
};

async function fetchList(): Promise<ListResponse> {
  const res = await fetch('/api/certificados', { cache: 'no-store' });
  const json = (await res.json()) as ListResponse | { error: string };
  if (!res.ok) throw new Error('error' in json ? json.error : `HTTP ${res.status}`);
  return json as ListResponse;
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
      {help && <p style={HELP}>{help}</p>}
    </div>
  );
}

function Block({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section style={{ ...CARD, borderColor: 'var(--border-2)' }}>
      <div style={EYEBROW}>{eyebrow}</div>
      <h3 style={{ fontSize: 20, margin: '6px 0 4px', color: 'var(--ink)' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 16 }}>{lead}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {children}
      </div>
    </section>
  );
}

export default function CertificadosClient({ canWrite }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [migracionAplicada, setMigracionAplicada] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [minas, setMinas] = useState<MinaOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  // El efecto de montaje parte con loading=true y escribe estado solo en los
  // callbacks de la promesa (sistema externo → React), nunca en el cuerpo del
  // efecto. `refresh` (botón Recargar) enciende el loading de inmediato.
  const load = useCallback(() => {
    return fetchList()
      .then(data => {
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setMigracionAplicada(data.migracion_aplicada !== false);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        setLoadError((e as Error).message || 'No se pudo cargar el registro.');
      })
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => {
    setLoading(true);
    setLoadError(null);
    void load();
  };

  useEffect(() => {
    let cancelled = false;
    fetchList()
      .then(data => {
        if (cancelled) return;
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setMigracionAplicada(data.migracion_aplicada !== false);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError((e as Error).message || 'No se pudo cargar el registro.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/minas', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setMinas(data);
      } catch (e) {
        if (!cancelled) setSubmitError('No se pudo cargar la lista de minas.');
        console.error('[certificados] minas fetch failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [formOpen]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const qrPreview = form.numero_sello.trim() ? buildQrUrl(form.numero_sello, siteUrl) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) payload[k] = v === '' ? null : v;
      payload.numero_certificado = form.numero_sello.trim() || null;
      const res = await fetch('/api/certificados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSubmitOk(`Registro asentado: ${json.numero_sello ?? json.numero_certificado}.`);
      setForm(EMPTY);
      setFormOpen(false);
      await load();
    } catch (err) {
      setSubmitError((err as Error).message || 'No se pudo registrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      {/* Encabezado */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={EYEBROW}>Registro · Certificados de Origen</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)' }}>Certificados</h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, maxWidth: 760 }}>
            La plataforma no emite el Certificado de Origen oficial: lo emite el titular del derecho minero y lo
            autentica la Autoridad Minera o Municipal (Art. 35 Regl. Especial MAPE; art. 43.e Regl. 042-2013).
            Aquí se registra y digitaliza ese documento y se asienta el sello complementario MAPE.LEGAL, que es
            voluntario y complementario: no sustituye el documento oficial ni constituye acto de autoridad.
            La verificación pública consulta únicamente el sello.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={refresh} style={BTN_GHOST} disabled={loading} aria-label="Recargar">
            <RefreshCw size={16} strokeWidth={1.5} /> Recargar
          </button>
          {canWrite && (
            <button type="button" onClick={() => { setSubmitError(null); setSubmitOk(null); setFormOpen(o => !o); }} style={BTN_PRIMARY}>
              {formOpen ? <X size={16} strokeWidth={1.5} /> : <Plus size={16} strokeWidth={1.5} />}
              {formOpen ? 'Cerrar formulario' : 'Registrar documento oficial + sello'}
            </button>
          )}
        </div>
      </header>

      {!migracionAplicada && (
        <div role="alert" style={{
          background: 'color-mix(in oklch, var(--amber) 10%, white)',
          border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
          borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--t1)', lineHeight: 1.6,
        }}>
          <strong>Migración 042 pendiente.</strong> Las columnas del documento oficial, el sello y la copia al minero
          no existen todavía en la base de datos. El registro de nuevos certificados fallará hasta que un humano aplique
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}> supabase/migrations/042_certificados_documento_oficial_y_sello.sql </code>
          en Supabase Studio tras la aprobación de Willis.
        </div>
      )}

      {submitOk && (
        <div role="status" aria-live="polite" style={{
          background: 'color-mix(in oklch, var(--green) 10%, white)',
          border: '1px solid color-mix(in oklch, var(--green) 30%, white)',
          borderRadius: 12, padding: 14, fontSize: 14, color: 'var(--t1)',
        }}>
          {submitOk}
        </div>
      )}

      {/* Formulario */}
      {canWrite && formOpen && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 20 }}>
          <Block
            eyebrow="Bloque 1 · Documento oficial"
            title="Documento oficial (lo emite el titular, lo autentica la autoridad)"
            lead="Datos tal como figuran en el papel. El titular del derecho minero es quien emite y firma; la plataforma solo lo registra. El nombre del titular es dato personal y nunca se expone en la verificación pública."
          >
            <Field label="Titular del derecho minero (emisor) *">
              <input required style={INPUT} value={form.emisor_titular} onChange={set('emisor_titular')} maxLength={200} />
            </Field>
            <Field label="Naturaleza del titular">
              <select style={INPUT} value={form.emisor_titular_tipo} onChange={set('emisor_titular_tipo')}>
                <option value="">— Sin especificar —</option>
                {EMISOR_TITULAR_TIPOS.map(t => <option key={t} value={t}>{EMISOR_TITULAR_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Autoridad que autentica *" help="Autoridad Minera o Municipal, tal como figura en el documento.">
              <input required style={INPUT} value={form.autoridad_autentica} onChange={set('autoridad_autentica')} maxLength={200} />
            </Field>
            <Field label="Fecha de autenticación">
              <input type="date" style={MONO_INPUT} value={form.autoridad_autentica_fecha} onChange={set('autoridad_autentica_fecha')} />
            </Field>
            <Field label="Número del documento oficial *" help="El número que figura en el documento emitido por el titular (no es el número de sello).">
              <input required style={MONO_INPUT} value={form.numero_documento_oficial} onChange={set('numero_documento_oficial')} maxLength={64} />
            </Field>
            <Field label="Fecha de emisión (por el titular) *">
              <input required type="date" style={MONO_INPUT} value={form.fecha_emision} onChange={set('fecha_emision')} />
            </Field>
            <Field label="Mina *">
              <select required style={INPUT} value={form.mina_id} onChange={set('mina_id')}>
                <option value="">— Seleccionar —</option>
                {minas.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}{m.codigo ? ` · ${m.codigo}` : ''}{m.municipio ? ` · ${m.municipio}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Peso de oro (g) *">
              <input required type="number" min="0.001" step="0.001" style={MONO_INPUT} value={form.peso_oro_g} onChange={set('peso_oro_g')} />
            </Field>
            <Field label="Ley (kilates)">
              <input type="number" min="0.01" max="24" step="0.01" style={MONO_INPUT} value={form.ley_oro_kt} onChange={set('ley_oro_kt')} />
            </Field>
            <Field label="Escaneo del documento oficial — ruta" help="Ruta relativa en Storage. La subida de archivos aún no existe: se registra la ruta como texto.">
              <input style={MONO_INPUT} value={form.escaneo_documento_oficial_path} onChange={set('escaneo_documento_oficial_path')} maxLength={240} placeholder="certificados/2026/CO-2026-0001/oficial.pdf" />
            </Field>
            <Field label="SHA-256 del escaneo oficial" help="64 caracteres hex. Indeleble una vez registrado.">
              <input style={MONO_INPUT} value={form.escaneo_documento_oficial_hash_sha256} onChange={set('escaneo_documento_oficial_hash_sha256')} maxLength={64} pattern="[0-9a-fA-F]{64}" />
            </Field>
          </Block>

          <Block
            eyebrow="Bloque 2 · Sello complementario MAPE.LEGAL"
            title="Sello complementario MAPE.LEGAL (folio, QR, hash)"
            lead="Registro voluntario y complementario de trazabilidad. El número de sello es la clave de la verificación pública; el QR impreso en el ejemplar enlaza el papel con este asiento. La imagen del QR no se genera aquí: solo se muestra la URL que codificará."
          >
            <Field label="Número de sello *" help="Hoy coincide con el número de certificado (misma serie).">
              <input required style={MONO_INPUT} value={form.numero_sello} onChange={set('numero_sello')} maxLength={64} placeholder="CO-2026-0001" />
            </Field>
            <Field label="Folio del talonario" help="Pre-numerado. Único.">
              <input style={MONO_INPUT} value={form.folio_talonario} onChange={set('folio_talonario')} maxLength={64} />
            </Field>
            <Field label="URL del QR (calculada)" help="La calcula el servidor a partir del número de sello y NEXT_PUBLIC_SITE_URL.">
              <div style={{ ...MONO_INPUT, background: 'var(--bg-soft)', color: qrPreview ? 'var(--t1)' : 'var(--t3)', overflowWrap: 'anywhere' }}>
                {qrPreview ?? '—'}
              </div>
            </Field>
            <Field label="Válido hasta" help="Por defecto, 365 días desde la emisión.">
              <input type="date" style={MONO_INPUT} value={form.valido_hasta} onChange={set('valido_hasta')} />
            </Field>
            <Field label="Estado del sello">
              <select style={INPUT} value={form.estado} onChange={set('estado')}>
                {CERTIFICADO_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Escaneo del ejemplar con sello — ruta" help="Ruta relativa en Storage (subida pendiente).">
              <input style={MONO_INPUT} value={form.ejemplar_sello_escaneo_path} onChange={set('ejemplar_sello_escaneo_path')} maxLength={240} />
            </Field>
            <Field label="SHA-256 del ejemplar con sello" help="Huella del archivo digital del ejemplar. Indeleble una vez registrada.">
              <input style={MONO_INPUT} value={form.hash_sha256} onChange={set('hash_sha256')} maxLength={64} pattern="[0-9a-fA-F]{64}" />
            </Field>
          </Block>

          <Block
            eyebrow="Bloque 3 · Copia al minero"
            title="Copia al minero"
            lead="Entrega de la copia del ejemplar con sello al minero y constancia firmada. La fecha es obligatoria cuando la copia ya fue entregada."
          >
            <Field label="Estado de la copia">
              <select style={INPUT} value={form.copia_minero_estado} onChange={set('copia_minero_estado')}>
                {COPIA_MINERO_ESTADOS.map(s => <option key={s} value={s}>{COPIA_MINERO_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Fecha de entrega">
              <input type="date" style={MONO_INPUT} value={form.copia_minero_fecha} onChange={set('copia_minero_fecha')} required={form.copia_minero_estado !== 'pendiente'} />
            </Field>
            <Field label="Constancia firmada — ruta" help="Ruta relativa en Storage (subida pendiente).">
              <input style={MONO_INPUT} value={form.copia_minero_constancia_path} onChange={set('copia_minero_constancia_path')} maxLength={240} />
            </Field>
            <Field label="Notas internas">
              <textarea style={{ ...INPUT, minHeight: 72 }} value={form.notas} onChange={set('notas')} maxLength={2000} />
            </Field>
          </Block>

          {submitError && (
            <div role="alert" style={{
              background: 'color-mix(in oklch, var(--red) 8%, white)',
              border: '1px solid color-mix(in oklch, var(--red) 28%, white)',
              borderRadius: 12, padding: 14, fontSize: 14, color: 'var(--red)',
            }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={BTN_GHOST} onClick={() => { setFormOpen(false); setSubmitError(null); }} disabled={submitting}>Cancelar</button>
            <button type="submit" style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
              {submitting ? 'Registrando…' : 'Asentar registro'}
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <section style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        {loadError && (
          <div role="alert" style={{ padding: 16, fontSize: 14, color: 'var(--red)' }}>{loadError}</div>
        )}
        {loading && !loadError && (
          <div style={{ padding: 24, fontSize: 14, color: 'var(--t3)' }}>Cargando registro…</div>
        )}
        {!loading && !loadError && rows.length === 0 && (
          <div style={{ padding: 24, fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
            Registro sin asientos. No se siembran certificados de muestra: el primer registro debe corresponder a un
            documento oficial real emitido por un titular y autenticado por la autoridad.
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th scope="col" style={TH}>Nº sello</th>
                  <th scope="col" style={TH}>Mina</th>
                  <th scope="col" style={TH}>Emisión</th>
                  <th scope="col" style={TH}>Autenticado</th>
                  <th scope="col" style={TH}>Estado</th>
                  <th scope="col" style={TH}>Folio</th>
                  <th scope="col" style={TH}>Copia al minero</th>
                  <th scope="col" style={TH}>Hash oficial</th>
                  <th scope="col" style={TH}>Hash sello</th>
                  <th scope="col" style={TH}>QR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const sello = r.numero_sello ?? r.numero_certificado;
                  const qr = r.qr_url ?? buildQrUrl(sello, siteUrl);
                  return (
                    <tr key={r.id}>
                      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{sello}</td>
                      <td style={TD}>
                        {r.mina ? <>{r.mina.nombre}{r.mina.codigo ? <span style={{ color: 'var(--t3)' }}> · {r.mina.codigo}</span> : null}</> : '—'}
                      </td>
                      <td style={{ ...TD, fontFamily: 'var(--font-mono)' }}>{fmtDate(r.fecha_emision)}</td>
                      <td style={{ ...TD, fontFamily: 'var(--font-mono)' }}>{fmtDate(r.autoridad_autentica_fecha)}</td>
                      <td style={TD}><Pill token={ESTADO_TOKEN[r.estado] ?? 'var(--slate)'}>{r.estado}</Pill></td>
                      <td style={{ ...TD, fontFamily: 'var(--font-mono)' }}>{r.folio_talonario ?? '—'}</td>
                      <td style={TD}>
                        {r.copia_minero_estado
                          ? <Pill token={COPIA_TOKEN[r.copia_minero_estado] ?? 'var(--slate)'}>{COPIA_MINERO_LABELS[r.copia_minero_estado] ?? r.copia_minero_estado}</Pill>
                          : '—'}
                      </td>
                      <td style={TD}>{r.escaneo_documento_oficial_hash_sha256 ? 'Sí' : 'No'}</td>
                      <td style={TD}>{r.hash_sha256 ? 'Sí' : 'No'}</td>
                      <td style={TD}>
                        <a href={qr} target="_blank" rel="noopener noreferrer"
                           style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--moss)', fontSize: 13, fontWeight: 500 }}>
                          /verificar/{sello} <ExternalLink size={14} strokeWidth={1.5} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 760 }}>
        Los registros son indelebles: no existe eliminación. Un sello se retira cambiando su estado
        (revocado · expirado · suspendido). Las huellas SHA-256 no se pueden sobrescribir una vez registradas.
      </p>
    </div>
  );
}
