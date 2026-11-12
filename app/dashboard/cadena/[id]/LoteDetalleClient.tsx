'use client';

// Client island de /dashboard/cadena/[id].
//
// Bloques: cabecera · línea de tiempo (verificación de cadena) · registrar
// evento (tipos según rol) · pagos del lote (oculto para planta) · conciliación
// de pesos · alertas · expediente del productor (planta, con consentimiento).
// Tokens del Color Manual v1.0 únicamente. Sin "compra": los pagos son pagos
// del lote (bancarios). Un pago sin referencia bancaria o en efectivo bloquea
// el lote — el formulario no ofrece efectivo.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import {
  TIPOS_EVENTO, MEDIOS_PAGO, PUNTOS_CONCILIACION,
  type Lote, type LoteEvento, type AlertaLote, type PagoLote, type Organizacion, type TipoEvento, type MedioPago, type PuntoConciliacion,
} from '@/lib/cadena/types';
import type { DiferenciaPeso } from '@/lib/cadena/reglas';
import EventosTimeline from '@/components/cadena/EventosTimeline';
import {
  CARD, EYEBROW, INPUT, MONO_INPUT, MONO, TH, TD, TD_WRAP, BTN_PRIMARY, BTN_MOSS, BTN_GHOST,
  Field, Notice, ErrorBox, MigracionPendiente, TableWrap, EmptyRow, EstadoLotePill, Section, Pill,
  apiFetch, postJson, ApiError, fmtDateTime, fmtDate, fmtNum, fmtLps, shortId, orgNombre,
  TIPO_EVENTO_LABEL, TIPO_ALERTA_LABEL, MEDIO_PAGO_LABEL, ROL_LABEL_CADENA, MOTIVO_PAGO_LABEL,
  type VerificacionCadena,
} from '@/components/cadena/shared';

interface Props { loteId: string; role: string }

interface DetalleResponse {
  lote: Lote;
  eventos: LoteEvento[];
  alertas: AlertaLote[];
  verificacion: VerificacionCadena;
  pagos?: PagoLote[];
}

interface Conciliacion {
  estado: 'umbral_no_configurado' | 'incompleto' | 'alerta' | 'conciliado' | string;
  conciliado: boolean;
  diferencias: DiferenciaPeso[];
  faltan: PuntoConciliacion[];
}

interface ExpedienteResponse {
  cliente: Record<string, unknown> | null;
  expedientes: Array<Record<string, unknown>>;
  documentos?: Array<Record<string, unknown>>;
}

const STAFF: ReadonlyArray<string> = ['admin', 'abogado', 'tecnico_ambiental'];
const TIPOS_COMERCIALIZADOR: ReadonlyArray<TipoEvento> = ['origen_mina', 'acopio', 'transporte', 'correccion', 'nota'];
const TIPOS_PLANTA: ReadonlyArray<TipoEvento> = ['recepcion_planta', 'laboratorio', 'fundicion', 'refinado', 'nota'];
// El evento `pago` lo asienta la API al registrar un pago del lote; no se
// ofrece como evento manual.
const TIPOS_STAFF: ReadonlyArray<TipoEvento> = TIPOS_EVENTO.filter((t) => t !== 'pago');

function tiposPermitidos(role: string): ReadonlyArray<TipoEvento> {
  if (role === 'comercializador') return TIPOS_COMERCIALIZADOR;
  if (role === 'planta') return TIPOS_PLANTA;
  if (STAFF.includes(role)) return TIPOS_STAFF;
  return [];
}

const PUNTO_LABEL: Record<PuntoConciliacion, string> = {
  origen_mina: 'Origen en mina', acopio: 'Acopio', laboratorio: 'Laboratorio', refinado: 'Refinado',
};

const ESTADO_CONCILIACION_LABEL: Record<string, string> = {
  umbral_no_configurado: 'Umbral pendiente de definición',
  incompleto: 'Faltan puntos de pesaje',
  alerta: 'Diferencia fuera de umbral',
  conciliado: 'Conciliado',
};

export default function LoteDetalleClient({ loteId, role }: Props) {
  const [data, setData] = useState<DetalleResponse | null>(null);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const esPlanta = role === 'planta';
  const esStaff = STAFF.includes(role);
  const puedePagar = role === 'comercializador' || role === 'admin';
  const puedeConciliar = role === 'comercializador' || role === 'admin';
  const tipos = tiposPermitidos(role);

  const load = useCallback((signal?: AbortSignal) => {
    return Promise.all([
      apiFetch<DetalleResponse>(`/api/cadena/lotes/${encodeURIComponent(loteId)}`, { signal }),
      apiFetch<{ organizaciones: Organizacion[] }>('/api/cadena/organizaciones', { signal }).catch(() => ({ organizaciones: [] as Organizacion[] })),
    ])
      .then(([d, o]) => {
        setData({
          lote: d.lote,
          eventos: Array.isArray(d.eventos) ? [...d.eventos].sort((a, b) => a.secuencia - b.secuencia) : [],
          alertas: Array.isArray(d.alertas) ? d.alertas : [],
          verificacion: d.verificacion,
          pagos: Array.isArray(d.pagos) ? d.pagos : undefined,
        });
        setOrgs(Array.isArray(o.organizaciones) ? o.organizaciones : []);
        setLoadError(null); setMigracionPendiente(false); setNotFound(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.migracionPendiente) { setMigracionPendiente(true); return; }
        if (e instanceof ApiError && e.status === 404) { setNotFound(true); return; }
        setLoadError((e as Error).message || 'No se pudo cargar el lote.');
      })
      .finally(() => setLoading(false));
  }, [loteId]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const refresh = () => { setLoading(true); void load(); };

  const lote = data?.lote ?? null;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Link href="/dashboard/cadena" style={{ ...EYEBROW, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--moss)' }}>
            <ArrowLeft size={14} strokeWidth={1.5} /> Lotes
          </Link>
          <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{lote?.codigo ?? (loading ? 'Cargando…' : 'Lote')}</span>
            {lote && <EstadoLotePill estado={lote.estado} />}
          </h1>
          {lote && (
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px 24px', fontSize: 13, color: 'var(--t2)', margin: 0 }}>
              <div><dt style={EYEBROW}>Productor</dt><dd style={{ ...MONO, margin: 0 }} title={lote.cliente_id}>{shortId(lote.cliente_id)}</dd></div>
              <div><dt style={EYEBROW}>Comercializador</dt><dd style={{ margin: 0 }}>{orgNombre(orgs, lote.comercializador_org_id)}</dd></div>
              <div><dt style={EYEBROW}>Planta de beneficio participante</dt><dd style={{ margin: 0 }}>{orgNombre(orgs, lote.planta_org_id)}</dd></div>
              <div><dt style={EYEBROW}>Creado</dt><dd style={{ margin: 0 }}>{fmtDateTime(lote.created_at)}</dd></div>
            </dl>
          )}
        </div>
        <button type="button" onClick={refresh} style={BTN_GHOST} disabled={loading} aria-label="Recargar">
          <RefreshCw size={16} strokeWidth={1.5} /> Recargar
        </button>
      </header>

      {migracionPendiente && <MigracionPendiente />}
      {notFound && <Notice tone="red" role="alert">Lote no encontrado o fuera de su alcance.</Notice>}
      <ErrorBox error={loadError} />

      {lote?.estado === 'bloqueado' && (
        <Notice tone="red" role="alert">
          <strong>Lote bloqueado.</strong> {lote.bloqueo_motivo ?? 'Motivo no informado.'}
        </Notice>
      )}

      {data && (
        <>
          <Section eyebrow="Cadena de custodia" title="Línea de tiempo de eventos"
            lead="Cada evento incluye el hash del anterior. Alterar o eliminar un eslabón rompe la verificación de todos los posteriores.">
            <EventosTimeline eventos={data.eventos} verificacion={data.verificacion} />
          </Section>

          {tipos.length > 0 && lote && (
            <RegistrarEvento loteId={loteId} role={role} tipos={tipos} onDone={() => load()} />
          )}

          {!esPlanta && (
            <PagosBlock loteId={loteId} pagos={data.pagos ?? []} puedePagar={puedePagar} onDone={() => load()} />
          )}

          <ConciliacionBlock loteId={loteId} puedeConciliar={puedeConciliar} onDone={() => load()} />

          <Section eyebrow="Seguimiento" title="Alertas">
            <TableWrap>
              <thead>
                <tr>
                  <th scope="col" style={TH}>Tipo</th>
                  <th scope="col" style={TH}>Detalle</th>
                  <th scope="col" style={TH}>Fecha</th>
                  <th scope="col" style={TH}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.alertas.length === 0 && <EmptyRow cols={4}>Sin alertas.</EmptyRow>}
                {data.alertas.map((a) => (
                  <tr key={a.id}>
                    <td style={TD_WRAP}>{TIPO_ALERTA_LABEL[a.tipo] ?? a.tipo}</td>
                    <td style={{ ...TD_WRAP, ...MONO, color: 'var(--t2)' }}>{detalleAlerta(a.detalle)}</td>
                    <td style={TD}>{fmtDateTime(a.created_at)}</td>
                    <td style={TD}>{a.resuelta ? <Pill token="var(--green)">Resuelta</Pill> : <Pill token="var(--amber)">Abierta</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Section>

          {(esPlanta || esStaff) && <ExpedienteBlock loteId={loteId} />}
        </>
      )}
    </div>
  );
}

function detalleAlerta(d: Record<string, unknown>): string {
  if (!d || Object.keys(d).length === 0) return '—';
  if (typeof d.motivo === 'string') return d.motivo;
  if (typeof d.detalle === 'string') return d.detalle;
  try { return JSON.stringify(d); } catch { return '—'; }
}

/* ── Registrar evento ─────────────────────────────────────────────────── */

function RegistrarEvento({ loteId, role, tipos, onDone }: {
  loteId: string; role: string; tipos: ReadonlyArray<TipoEvento>; onDone: () => Promise<void> | void;
}) {
  const [tipo, setTipo] = useState<TipoEvento>(tipos[0]);
  const [fecha, setFecha] = useState('');
  const [lugar, setLugar] = useState('');
  const [peso, setPeso] = useState('');
  const [ley, setLey] = useState('');
  const [nota, setNota] = useState('');
  const [realizadoPor, setRealizadoPor] = useState('planta');
  const [titularNombre, setTitularNombre] = useState('');
  const [titularId, setTitularId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const esFundicion = tipo === 'fundicion';
  const esPesaje = (PUNTOS_CONCILIACION as ReadonlyArray<string>).includes(tipo) || tipo === 'recepcion_planta';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setOk(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const detalle: Record<string, unknown> = {};
      if (nota.trim()) detalle.nota = nota.trim();
      if (esFundicion) {
        detalle.realizado_por_rol = realizadoPor;
        detalle.titular_beneficio = { nombre: titularNombre.trim(), identificacion: titularId.trim() };
      }
      const body: Record<string, unknown> = { tipo, detalle };
      if (fecha) {
        const d = new Date(fecha);
        if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida.');
        body.fecha = d.toISOString();
      }
      if (lugar.trim()) body.lugar = lugar.trim();
      if (peso.trim()) body.peso_g = Number(peso);
      if (ley.trim()) body.ley_fino = Number(ley);
      await postJson(`/api/cadena/lotes/${encodeURIComponent(loteId)}/eventos`, body, ctrl.signal);
      setOk(`Evento "${TIPO_EVENTO_LABEL[tipo]}" registrado y encadenado.`);
      setFecha(''); setLugar(''); setPeso(''); setLey(''); setNota(''); setTitularNombre(''); setTitularId('');
      await onDone();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const ae = err as ApiError;
      if (ae instanceof ApiError && ae.code === 'fundicion_no_permitida') {
        setError(`Fundición no permitida: ${String(ae.payload.motivo ?? 'el comercializador no funde')}.`);
      } else {
        setError((err as Error).message || 'No se pudo registrar el evento.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section eyebrow="Registro" title="Registrar evento"
      lead="Los eventos se asientan en orden y no se editan: una corrección es un evento nuevo de tipo Corrección. Los pesos de origen en mina, acopio, laboratorio y refinado alimentan la conciliación.">
      <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Tipo de evento *">
            <select style={INPUT} value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>
              {tipos.map((t) => <option key={t} value={t}>{TIPO_EVENTO_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Fecha y hora" help="Opcional: si se omite, se usa el momento del registro.">
            <input type="datetime-local" style={MONO_INPUT} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Lugar">
            <input style={INPUT} value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={200} />
          </Field>
          <Field label={`Peso (g)${esPesaje ? ' *' : ''}`} help="Gramos con hasta 3 decimales.">
            <input type="number" min={0} step="0.001" required={esPesaje} style={MONO_INPUT} value={peso} onChange={(e) => setPeso(e.target.value)} />
          </Field>
          <Field label="Ley fino" help="Fracción 0–1 (p. ej. 0.915). Opcional.">
            <input type="number" min={0} max={1} step="0.000001" style={MONO_INPUT} value={ley} onChange={(e) => setLey(e.target.value)} />
          </Field>
          <Field label="Nota">
            <input style={INPUT} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
          </Field>
        </div>

        {esFundicion && (
          <div style={{ ...CARD, padding: 16, borderColor: 'var(--border-2)', display: 'grid', gap: 12 }}>
            <Notice tone="amber">
              <strong>Regla del estándar: el comercializador no funde.</strong> La fundición la realiza únicamente el
              titular de beneficio en la planta participante; el evento exige identificar a ese titular.
            </Notice>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Field label="Realizado por (rol) *">
                <select style={INPUT} value={realizadoPor} onChange={(e) => setRealizadoPor(e.target.value)} disabled={role === 'planta'}>
                  <option value="planta">{ROL_LABEL_CADENA.planta}</option>
                  {role !== 'planta' && <option value="admin">{ROL_LABEL_CADENA.admin}</option>}
                </select>
              </Field>
              <Field label="Titular de beneficio — nombre *">
                <input required style={INPUT} value={titularNombre} onChange={(e) => setTitularNombre(e.target.value)} maxLength={200} />
              </Field>
              <Field label="Titular de beneficio — identificación *" help="RTN o identidad, tal como figura en el documento.">
                <input required style={MONO_INPUT} value={titularId} onChange={(e) => setTitularId(e.target.value)} maxLength={64} />
              </Field>
            </div>
          </div>
        )}

        <ErrorBox error={error} />
        {ok && <Notice tone="green">{ok}</Notice>}
        <div>
          <button type="submit" style={BTN_PRIMARY} disabled={busy}>{busy ? 'Registrando…' : 'Registrar evento'}</button>
        </div>
      </form>
    </Section>
  );
}

/* ── Pagos del lote ───────────────────────────────────────────────────── */

function PagosBlock({ loteId, pagos, puedePagar, onDone }: {
  loteId: string; pagos: PagoLote[]; puedePagar: boolean; onDone: () => Promise<void> | void;
}) {
  const [medio, setMedio] = useState<MedioPago>(MEDIOS_PAGO[0]);
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState('');
  const [banco, setBanco] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setOk(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const body: Record<string, unknown> = {
        medio, referencia_bancaria: referencia.trim(), monto_lps: Number(monto), fecha_pago: fechaPago,
      };
      if (banco.trim()) body.banco = banco.trim();
      await postJson(`/api/cadena/lotes/${encodeURIComponent(loteId)}/pagos`, body, ctrl.signal);
      setOk('Pago del lote registrado.');
      setReferencia(''); setMonto(''); setBanco(''); setFechaPago('');
      await onDone();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const ae = err as ApiError;
      if (ae instanceof ApiError && ae.code === 'pago_invalido') {
        const motivo = String(ae.payload.motivo ?? '');
        setError(`Pago inválido: ${MOTIVO_PAGO_LABEL[motivo] ?? motivo}.${ae.payload.lote_bloqueado ? ' El lote quedó bloqueado.' : ''}`);
        await onDone();
      } else {
        setError((err as Error).message || 'No se pudo registrar el pago.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section eyebrow="Pagos del lote (bancarios)" title="Pagos del lote"
      lead="Todo pago al productor es bancario e identificable por su referencia. Sin referencia bancaria o en efectivo, el lote se bloquea. Este registro es evidencia; no constituye promesa ni oferta de pago.">
      <div style={{ display: 'grid', gap: 16 }}>
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" style={TH}>Fecha de pago</th>
              <th scope="col" style={TH}>Medio</th>
              <th scope="col" style={TH}>Referencia bancaria</th>
              <th scope="col" style={TH}>Banco</th>
              <th scope="col" style={TH}>Monto</th>
              <th scope="col" style={TH}>Registrado</th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 && <EmptyRow cols={6}>Sin pagos registrados.</EmptyRow>}
            {pagos.map((p) => (
              <tr key={p.id}>
                <td style={TD}>{fmtDate(p.fecha_pago)}</td>
                <td style={TD}>{MEDIO_PAGO_LABEL[p.medio] ?? p.medio}</td>
                <td style={{ ...TD, ...MONO }}>{p.referencia_bancaria}</td>
                <td style={TD_WRAP}>{p.banco ?? '—'}</td>
                <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtLps(p.monto_lps)}</td>
                <td style={TD}>{fmtDateTime(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        {puedePagar && (
          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Field label="Medio *" help="Solo medios bancarios. El efectivo no es una opción.">
                <select style={INPUT} value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
                  {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{MEDIO_PAGO_LABEL[m]}</option>)}
                </select>
              </Field>
              <Field label="Referencia bancaria *">
                <input required minLength={4} style={MONO_INPUT} value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={64} />
              </Field>
              <Field label="Monto (L) *">
                <input required type="number" min={0.01} step="0.01" style={MONO_INPUT} value={monto} onChange={(e) => setMonto(e.target.value)} />
              </Field>
              <Field label="Banco">
                <input style={INPUT} value={banco} onChange={(e) => setBanco(e.target.value)} maxLength={120} />
              </Field>
              <Field label="Fecha de pago *">
                <input required type="date" style={MONO_INPUT} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
              </Field>
            </div>
            <ErrorBox error={error} />
            {ok && <Notice tone="green">{ok}</Notice>}
            <div>
              <button type="submit" style={BTN_PRIMARY} disabled={busy}>{busy ? 'Registrando…' : 'Registrar pago del lote'}</button>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}

/* ── Conciliación de pesos ────────────────────────────────────────────── */

function ConciliacionBlock({ loteId, puedeConciliar, onDone }: {
  loteId: string; puedeConciliar: boolean; onDone: () => Promise<void> | void;
}) {
  const [res, setRes] = useState<Conciliacion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const conciliar = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const r = await postJson<{ conciliacion: Conciliacion; lote: Lote }>(`/api/cadena/lotes/${encodeURIComponent(loteId)}/conciliar`, {}, ctrl.signal);
      setRes(r.conciliacion);
      await onDone();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message || 'No se pudo conciliar.');
    } finally {
      setBusy(false);
    }
  };

  const tonoEstado = (estado: string): 'green' | 'amber' | 'red' | 'blue' =>
    estado === 'conciliado' ? 'green' : estado === 'alerta' ? 'red' : estado === 'incompleto' ? 'blue' : 'amber';

  return (
    <Section eyebrow="Control" title="Conciliación de pesos"
      lead="Compara el peso entre puntos consecutivos de la cadena (origen en mina → acopio → laboratorio → refinado). El umbral tolerado vive en la configuración del sistema; sin umbral definido ningún lote se da por conciliado."
      actions={puedeConciliar ? (
        <button type="button" style={BTN_MOSS} onClick={conciliar} disabled={busy}>{busy ? 'Conciliando…' : 'Conciliar'}</button>
      ) : undefined}>
      <div style={{ display: 'grid', gap: 12 }}>
        <ErrorBox error={error} />
        {!res && !error && (
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            {puedeConciliar ? 'Pulse "Conciliar" para calcular las diferencias con los pesos registrados.' : 'La conciliación la ejecuta el comercializador o la administración; el resultado queda en las alertas y en el estado del lote.'}
          </p>
        )}
        {res && (
          <>
            {res.estado === 'umbral_no_configurado' ? (
              <Notice tone="amber" role="alert">
                <strong>Umbral pendiente de definición</strong> [POR DEFINIR — WILLIS / LEGAL MINERO]. Las diferencias se
                calculan, pero el lote no puede darse por conciliado hasta que exista el umbral.
              </Notice>
            ) : (
              <Notice tone={tonoEstado(res.estado)}>
                <strong>{ESTADO_CONCILIACION_LABEL[res.estado] ?? res.estado}.</strong>
                {res.faltan.length > 0 && ` Faltan: ${res.faltan.map((p) => PUNTO_LABEL[p] ?? p).join(', ')}.`}
              </Notice>
            )}
            <TableWrap>
              <thead>
                <tr>
                  <th scope="col" style={TH}>Tramo</th>
                  <th scope="col" style={TH}>Peso desde (g)</th>
                  <th scope="col" style={TH}>Peso hasta (g)</th>
                  <th scope="col" style={TH}>Diferencia</th>
                  <th scope="col" style={TH}>Excede umbral</th>
                </tr>
              </thead>
              <tbody>
                {res.diferencias.length === 0 && <EmptyRow cols={5}>Sin tramos comparables: hacen falta al menos dos puntos de pesaje.</EmptyRow>}
                {res.diferencias.map((d) => (
                  <tr key={`${d.desde}-${d.hasta}`}>
                    <td style={TD}>{PUNTO_LABEL[d.desde] ?? d.desde} → {PUNTO_LABEL[d.hasta] ?? d.hasta}</td>
                    <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtNum(d.peso_desde, 3)}</td>
                    <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtNum(d.peso_hasta, 3)}</td>
                    <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{Number.isFinite(d.diferencia_pct) ? `${fmtNum(d.diferencia_pct, 2)} %` : '∞'}</td>
                    <td style={TD}>
                      {d.excede === null ? <Pill token="var(--amber)">Sin umbral</Pill>
                        : d.excede ? <Pill token="var(--red)">Sí</Pill> : <Pill token="var(--green)">No</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        )}
      </div>
    </Section>
  );
}

/* ── Expediente del productor (planta, con consentimiento) ────────────── */

function ExpedienteBlock({ loteId }: { loteId: string }) {
  const [res, setRes] = useState<ExpedienteResponse | null>(null);
  const [sinConsentimiento, setSinConsentimiento] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const ver = async () => {
    if (busy) return;
    setBusy(true); setError(null); setSinConsentimiento(false);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const r = await apiFetch<ExpedienteResponse>(`/api/cadena/lotes/${encodeURIComponent(loteId)}/expediente`, { signal: ctrl.signal });
      setRes(r);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const ae = err as ApiError;
      if (ae instanceof ApiError && ae.status === 403) { setSinConsentimiento(true); return; }
      setError((err as Error).message || 'No se pudo consultar el expediente.');
    } finally {
      setBusy(false);
    }
  };

  const str = (o: Record<string, unknown> | null | undefined, k: string): string => {
    const v = o?.[k];
    return v === null || v === undefined || v === '' ? '—' : String(v);
  };

  return (
    <Section eyebrow="Consentimiento informado" title="Expediente del productor"
      lead="El expediente completo del productor solo se muestra a la planta con consentimiento informado vigente. Cada lectura queda en la bitácora de accesos."
      actions={<button type="button" style={BTN_GHOST} onClick={ver} disabled={busy}>{busy ? 'Consultando…' : 'Ver expediente del productor'}</button>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <ErrorBox error={error} />
        {sinConsentimiento && (
          <Notice tone="amber" role="alert">
            <strong>Sin consentimiento informado vigente del productor.</strong> El acceso al expediente está cerrado hasta
            que exista un consentimiento vigente registrado a favor de su organización.
          </Notice>
        )}
        {res && (
          <>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px 24px', fontSize: 13, margin: 0 }}>
              <div><dt style={EYEBROW}>Productor</dt><dd style={{ margin: 0 }}>{str(res.cliente, 'nombre')}</dd></div>
              <div><dt style={EYEBROW}>Municipio</dt><dd style={{ margin: 0 }}>{str(res.cliente, 'municipio')}</dd></div>
              <div><dt style={EYEBROW}>Mineral</dt><dd style={{ margin: 0 }}>{str(res.cliente, 'tipo_mineral')}</dd></div>
              <div><dt style={EYEBROW}>Situación de tierra</dt><dd style={{ margin: 0 }}>{str(res.cliente, 'situacion_tierra')}</dd></div>
            </dl>
            <TableWrap>
              <thead>
                <tr>
                  <th scope="col" style={TH}>Expediente</th>
                  <th scope="col" style={TH}>Tipo</th>
                  <th scope="col" style={TH}>Estado</th>
                  <th scope="col" style={TH}>Fase</th>
                  <th scope="col" style={TH}>Paso</th>
                </tr>
              </thead>
              <tbody>
                {(res.expedientes ?? []).length === 0 && <EmptyRow cols={5}>El productor no tiene expedientes registrados.</EmptyRow>}
                {(res.expedientes ?? []).map((x, i) => (
                  <tr key={String(x.id ?? i)}>
                    <td style={{ ...TD, ...MONO }}>{str(x, 'numero_expediente')}</td>
                    <td style={TD_WRAP}>{str(x, 'tipo')}</td>
                    <td style={TD}>{str(x, 'estado')}</td>
                    <td style={TD}>{str(x, 'fase_numero')}</td>
                    <td style={TD}>{str(x, 'paso')}{x.total_pasos ? ` / ${String(x.total_pasos)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {Array.isArray(res.documentos) && res.documentos.length > 0 && (
              <TableWrap>
                <thead>
                  <tr>
                    <th scope="col" style={TH}>Documento</th>
                    <th scope="col" style={TH}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {res.documentos.map((d, i) => (
                    <tr key={String(d.id ?? i)}>
                      <td style={TD_WRAP}>{str(d, 'nombre')}</td>
                      <td style={TD}>{str(d, 'estado')}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
