'use client';

// Client island de /portal/lotes. Lista de lotes del productor; cada lote se
// expande para cargar sus eventos resumidos y sus pagos (referencia bancaria,
// medio, fecha, monto). Tokens del Color Manual v1.0 (mismos valores que el
// esquema del portal). Sin "compra": son los pagos de SUS propias ventas.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Boxes } from 'lucide-react';
import type { Lote, LoteEvento, PagoLote } from '@/lib/cadena/types';
import {
  TH, TD, TD_WRAP, MONO, EYEBROW, BTN_SMALL,
  EstadoLotePill, Notice, ErrorBox, MigracionPendiente, TableWrap, EmptyRow,
  apiFetch, ApiError, fmtDate, fmtDateTime, fmtNum, fmtLps, TIPO_EVENTO_LABEL, MEDIO_PAGO_LABEL,
  type VerificacionCadena,
} from '@/components/cadena/shared';

interface Detalle { eventos: LoteEvento[]; pagos: PagoLote[]; verificacion: VerificacionCadena | null }

export default function PortalLotesClient() {
  const router = useRouter();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, Detalle>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    apiFetch<{ lotes: Lote[] }>('/api/cadena/lotes', { signal: ctrl.signal })
      .then((d) => setLotes(Array.isArray(d.lotes) ? d.lotes : []))
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.status === 401) { router.replace('/login'); return; }
        if (e instanceof ApiError && e.migracionPendiente) { setMigracionPendiente(true); return; }
        setLoadError((e as Error).message || 'No se pudieron cargar sus lotes.');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [router]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const cargarDetalle = async (id: string) => {
    if (busyId) return;
    setBusyId(id); setDetalleError(null);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const d = await apiFetch<{ eventos?: LoteEvento[]; pagos?: PagoLote[]; verificacion?: VerificacionCadena }>(
        `/api/cadena/lotes/${encodeURIComponent(id)}`, { signal: ctrl.signal },
      );
      setDetalles((prev) => ({
        ...prev,
        [id]: {
          eventos: Array.isArray(d.eventos) ? [...d.eventos].sort((a, b) => a.secuencia - b.secuencia) : [],
          pagos: Array.isArray(d.pagos) ? d.pagos : [],
          verificacion: d.verificacion ?? null,
        },
      }));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setDetalleError((e as Error).message || 'No se pudo cargar el detalle del lote.');
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (id: string) => {
    if (abierto === id) { setAbierto(null); return; }
    setAbierto(id);
    if (!detalles[id]) void cargarDetalle(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm font-sans" style={{ color: 'var(--slate)' }}>Cargando sus lotes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {migracionPendiente && <MigracionPendiente />}
      <ErrorBox error={loadError} />

      {!migracionPendiente && !loadError && lotes.length === 0 && (
        <div className="text-center py-24">
          <Boxes size={48} strokeWidth={1} className="mx-auto mb-4" style={{ color: 'var(--slate-lt)' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink)' }}>Sin lotes registrados</h2>
          <p className="text-sm font-sans" style={{ color: 'var(--slate)' }}>
            Cuando un comercializador participante registre un lote con su producción, aparecerá aquí con sus
            eventos y pagos.
          </p>
        </div>
      )}

      {lotes.length > 0 && (
        <>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>Mis lotes</h1>
            <p className="text-sm font-sans mt-1" style={{ color: 'var(--slate)' }}>
              Trazabilidad de su producción: eventos registrados en cada lote y los pagos bancarios recibidos por él.
            </p>
          </div>

          {lotes.map((l) => {
            const open = abierto === l.id;
            const det = detalles[l.id];
            return (
              <div key={l.id} className="rounded-xl border shadow-sm overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => toggle(l.id)}
                  aria-expanded={open}
                  className="w-full px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer"
                  style={{ background: 'transparent', border: 'none' }}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold" style={{ ...MONO, fontSize: 15, color: 'var(--ink)' }}>{l.codigo}</span>
                      <EstadoLotePill estado={l.estado} />
                    </div>
                    <p className="text-xs font-sans mt-1" style={{ color: 'var(--t3)' }}>
                      Creado: {fmtDateTime(l.created_at)}
                      {l.bloqueo_motivo ? ` · Motivo de bloqueo: ${l.bloqueo_motivo}` : ''}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-sans" style={{ color: 'var(--slate)' }}>
                    {open ? 'Ocultar' : 'Ver detalle'}
                    {open ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
                  </span>
                </button>

                {open && (
                  <div className="px-6 pb-6 space-y-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    {busyId === l.id && <p className="text-sm font-sans pt-4" style={{ color: 'var(--slate)' }}>Cargando detalle…</p>}
                    {detalleError && !det && <div className="pt-4"><ErrorBox error={detalleError} /></div>}
                    {det && (
                      <>
                        <div className="pt-4">
                          <div style={{ ...EYEBROW, marginBottom: 8 }}>Eventos del lote</div>
                          <TableWrap>
                            <thead>
                              <tr>
                                <th scope="col" style={TH}>#</th>
                                <th scope="col" style={TH}>Evento</th>
                                <th scope="col" style={TH}>Fecha</th>
                                <th scope="col" style={TH}>Lugar</th>
                                <th scope="col" style={TH}>Peso (g)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {det.eventos.length === 0 && <EmptyRow cols={5}>Sin eventos registrados.</EmptyRow>}
                              {det.eventos.map((e) => (
                                <tr key={e.id}>
                                  <td style={{ ...TD, ...MONO }}>{e.secuencia}</td>
                                  <td style={TD_WRAP}>{TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}</td>
                                  <td style={TD}>{fmtDateTime(e.fecha)}</td>
                                  <td style={TD_WRAP}>{e.lugar ?? '—'}</td>
                                  <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtNum(e.peso_g, 3)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </TableWrap>
                          {det.verificacion && !det.verificacion.ok && (
                            <p className="text-xs font-sans mt-2" style={{ color: 'var(--red)' }}>
                              La verificación de la cadena de este lote presenta una inconsistencia (eslabón {det.verificacion.primeraRotura ?? '?'}). Consulte a su abogado.
                            </p>
                          )}
                        </div>

                        <div>
                          <div style={{ ...EYEBROW, marginBottom: 8 }}>Pagos del lote (bancarios)</div>
                          <TableWrap>
                            <thead>
                              <tr>
                                <th scope="col" style={TH}>Fecha de pago</th>
                                <th scope="col" style={TH}>Medio</th>
                                <th scope="col" style={TH}>Referencia bancaria</th>
                                <th scope="col" style={TH}>Banco</th>
                                <th scope="col" style={TH}>Monto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {det.pagos.length === 0 && <EmptyRow cols={5}>Sin pagos registrados para este lote.</EmptyRow>}
                              {det.pagos.map((p) => (
                                <tr key={p.id}>
                                  <td style={TD}>{fmtDate(p.fecha_pago)}</td>
                                  <td style={TD}>{MEDIO_PAGO_LABEL[p.medio] ?? p.medio}</td>
                                  <td style={{ ...TD, ...MONO }}>{p.referencia_bancaria}</td>
                                  <td style={TD_WRAP}>{p.banco ?? '—'}</td>
                                  <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtLps(p.monto_lps)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </TableWrap>
                          <Notice tone="blue">
                            Precio de sus propias ventas; no es una oferta general. Los montos corresponden a pagos bancarios ya
                            registrados por el comercializador para este lote.
                          </Notice>
                        </div>
                        <button type="button" style={BTN_SMALL} onClick={() => cargarDetalle(l.id)} disabled={busyId !== null}>
                          {busyId === l.id ? 'Actualizando…' : 'Actualizar detalle'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs font-sans text-center" style={{ color: 'var(--t3)' }}>
            Para consultas sobre un lote o un pago, contáctese con su abogado asignado por WhatsApp.
          </p>
        </>
      )}
    </div>
  );
}
