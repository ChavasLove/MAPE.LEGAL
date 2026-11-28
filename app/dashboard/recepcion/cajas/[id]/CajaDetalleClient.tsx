'use client';

// Detalle de una caja: contenido, cierre con manifiesto y precinto, manifiesto
// imprimible, envío al laboratorio y recepción con conciliación de pesos.
// Sin precios ni montos en ninguna parte.

import { useState } from 'react';
import Link from 'next/link';
import {
  BTN_GHOST, BTN_PRIMARY, BTN_SMALL, CARD, EmptyRow, ErrorBox, Field, INPUT, MONO, MONO_INPUT, Notice, Pill, Section, TableWrap, TD, TH, fmtDateTime, fmtNum, shortId,
} from '@/components/cadena/shared';
import { AVISO_PREPARACION, enviar, useCarga } from '@/components/recepcion/useCarga';
import {
  CONCILIACION_LAB_ETIQUETA, ESTADO_CAJA_ETIQUETA, MODOS_ENTREGA, MODO_ENTREGA_ETIQUETA, type Caja, type EstadoConciliacionLab, type ModoEntrega, type Sobre,
} from '@/lib/recepcion/types';
import type { Manifiesto } from '@/lib/recepcion/manifiesto';
import { puede } from '@/lib/acceso/personal';
import type { Role } from '@/lib/userRoleLookup';

interface Detalle {
  caja: Caja; sobres: Sobre[]; manifiesto_integro: boolean | null; rol: Role;
  laboratorio: { id: string; nombre: string } | null;
  envio: { medio: ModoEntrega; guia: string | null; fecha_envio: string } | null;
  recepcion_laboratorio: {
    fecha_recepcion: string; precinto_integro: boolean; estado_conciliacion: EstadoConciliacionLab;
    conciliacion: { diferencias: Array<{ sobre_id: string; peso_manifiesto_g: string; peso_recibido_g: string; diferencia_pct: number | null; excede: boolean | null }>; faltan: string[]; umbral_pct: number | null };
  } | null;
}

const TOKEN_CONC: Record<EstadoConciliacionLab, string> = { conciliada: 'var(--green)', discrepancia: 'var(--red)', incompleto: 'var(--amber)', umbral_no_configurado: 'var(--amber)' };

export default function CajaDetalleClient({ id }: { id: string }) {
  const d = useCarga<Detalle>(`/api/recepcion/cajas/${id}`);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [precinto, setPrecinto] = useState('');
  const [envio, setEnvio] = useState({ medio: 'en_persona', guia: '' });
  const [lab, setLab] = useState<{ integro: boolean; pesos: Record<string, string> }>({ integro: true, pesos: {} });

  if (d.enPreparacion) return <Notice tone="amber">{AVISO_PREPARACION}</Notice>;
  if (!d.datos) return <div><ErrorBox error={d.error} />{!d.error && <p style={{ color: 'var(--t3)' }}>Cargando…</p>}</div>;
  const { caja, sobres, rol, laboratorio, manifiesto_integro: integro, envio: env, recepcion_laboratorio: rl } = d.datos;
  const manifiesto = caja.manifiesto as Manifiesto | null;

  async function accion(ruta: string, body: unknown) {
    setOcupado(true);
    const err = await enviar(`/api/recepcion/cajas/${id}/${ruta}`, body);
    setOcupado(false);
    setError(err);
    if (!err) d.recargar();
  }

  return (
    <Section
      eyebrow="Cajas y envíos"
      title={`Caja ${caja.codigo}`}
      lead={`Titular de origen ${shortId(caja.titular_cliente_id)} · destino: ${laboratorio?.nombre ?? 'laboratorio de destino'}`}
      actions={<Link href="/dashboard/recepcion/cajas" className="no-imprimir" style={{ ...BTN_SMALL, textDecoration: 'none' }}>Volver</Link>}
    >
      <style>{'@media print { .no-imprimir, aside, nav { display: none !important; } main { padding: 0 !important; } }'}</style>
      <div className="mb-4"><Pill token={caja.estado === 'recibida' ? 'var(--green)' : caja.estado === 'abierta' ? 'var(--amber)' : 'var(--blue)'}>{ESTADO_CAJA_ETIQUETA[caja.estado]}</Pill></div>
      <div className="no-imprimir"><ErrorBox error={error} /></div>

      {caja.estado === 'abierta' && (
        <>
          <h3 className="mt-2 mb-3" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Sobres en la caja</h3>
          <TableWrap>
            <thead><tr><th scope="col" style={TH}>Etiqueta</th><th scope="col" style={TH}>Sello</th><th scope="col" style={TH}>Mina</th><th scope="col" style={TH}>Peso neto (g)</th></tr></thead>
            <tbody>
              {sobres.length === 0 && <EmptyRow cols={4}>La caja está vacía. Empaque sobres desde la recepción.</EmptyRow>}
              {sobres.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...TD, ...MONO }}>{s.etiqueta}</td><td style={{ ...TD, ...MONO }}>{s.numero_sello}</td>
                  <td style={{ ...TD, ...MONO }}>{shortId(s.mina_id)}</td><td style={{ ...TD, ...MONO }}>{fmtNum(s.peso_neto_g)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {puede(rol, 'caja:cerrar') && (
            <div className="mt-6" style={CARD}>
              <Field label="Número de precinto" help="Al cerrar se genera el manifiesto con su huella. Una caja cerrada ya no se modifica.">
                <input value={precinto} onChange={(e) => setPrecinto(e.target.value)} maxLength={64} style={{ ...MONO_INPUT, maxWidth: 320 }} />
              </Field>
              <button type="button" disabled={ocupado || !precinto.trim() || sobres.length === 0} style={{ ...BTN_PRIMARY, marginTop: 12, opacity: ocupado || !precinto.trim() || sobres.length === 0 ? 0.6 : 1 }}
                onClick={() => accion('cerrar', { precinto: precinto.trim() })}>Cerrar caja con manifiesto</button>
            </div>
          )}
        </>
      )}

      {manifiesto && (
        <div className="mt-2" style={CARD}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Manifiesto de la caja {manifiesto.caja.codigo}</h3>
              <p style={{ fontSize: 13, color: 'var(--slate)' }}>Precinto {manifiesto.caja.precinto} · {manifiesto.total_sobres} sobre(s) · peso total {manifiesto.peso_total_g} g · cerrada {fmtDateTime(caja.cerrada_en)}</p>
            </div>
            <button type="button" className="no-imprimir" style={BTN_GHOST} onClick={() => window.print()}>Imprimir manifiesto</button>
          </div>
          <div className="mt-4">
            <TableWrap>
              <thead><tr><th scope="col" style={TH}>N.º</th><th scope="col" style={TH}>Etiqueta</th><th scope="col" style={TH}>Número de sello</th><th scope="col" style={TH}>Mina de origen</th><th scope="col" style={TH}>Lote</th><th scope="col" style={TH}>Peso neto (g)</th></tr></thead>
              <tbody>
                {manifiesto.sobres.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...TD, ...MONO }}>{i + 1}</td><td style={{ ...TD, ...MONO }}>{s.etiqueta}</td><td style={{ ...TD, ...MONO }}>{s.numero_sello}</td>
                    <td style={{ ...TD, ...MONO }}>{shortId(s.mina_id)}</td><td style={{ ...TD, ...MONO }}>{shortId(s.lote_id)}</td><td style={{ ...TD, ...MONO }}>{s.peso_neto_g}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
          <p className="mt-4" style={{ ...MONO, color: 'var(--t2)', wordBreak: 'break-all' }}>Huella SHA-256 del manifiesto: {caja.manifiesto_hash}</p>
          <p className="mt-1" style={{ fontSize: 13, color: integro ? 'var(--green)' : 'var(--red)' }}>
            {integro ? 'Integridad verificada: la huella corresponde al manifiesto guardado.' : 'La huella NO corresponde al manifiesto guardado.'}
          </p>
          <p className="mt-3" style={{ fontSize: 12, color: 'var(--t3)' }}>
            Documento de custodia. Lista el contenido de la caja por origen; no acredita propiedad ni valor del material.
          </p>
        </div>
      )}

      {caja.estado === 'cerrada' && puede(rol, 'envio:registrar') && (
        <div className="mt-6 no-imprimir" style={CARD}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Envío o entrega al laboratorio</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Medio">
              <select value={envio.medio} onChange={(e) => setEnvio((v) => ({ ...v, medio: e.target.value }))} style={INPUT}>
                {MODOS_ENTREGA.map((m) => <option key={m} value={m}>{MODO_ENTREGA_ETIQUETA[m]}</option>)}
              </select>
            </Field>
            <Field label="Guía"><input value={envio.guia} onChange={(e) => setEnvio((v) => ({ ...v, guia: e.target.value }))} maxLength={80} style={MONO_INPUT} /></Field>
          </div>
          <button type="button" disabled={ocupado} style={{ ...BTN_PRIMARY, marginTop: 12, opacity: ocupado ? 0.6 : 1 }} onClick={() => accion('envio', { medio: envio.medio, guia: envio.guia || null })}>Registrar envío</button>
        </div>
      )}

      {env && (
        <p className="mt-6" style={{ fontSize: 14, color: 'var(--t2)' }}>
          Enviada el {fmtDateTime(env.fecha_envio)} · {MODO_ENTREGA_ETIQUETA[env.medio]}{env.guia ? <span style={MONO}> · guía {env.guia}</span> : null}
        </p>
      )}

      {caja.estado === 'enviada' && puede(rol, 'laboratorio:recibir') && manifiesto && (
        <div className="mt-6 no-imprimir" style={CARD}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Recepción en laboratorio</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {manifiesto.sobres.map((s) => (
              <Field key={s.id} label={`Peso recibido · ${s.etiqueta} (g)`} help={`Manifiesto: ${s.peso_neto_g} g`}>
                <input inputMode="decimal" value={lab.pesos[s.id] ?? ''} onChange={(e) => setLab((v) => ({ ...v, pesos: { ...v.pesos, [s.id]: e.target.value } }))} style={MONO_INPUT} />
              </Field>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-4" style={{ fontSize: 14, color: 'var(--ink)' }}>
            <input type="checkbox" checked={lab.integro} onChange={(e) => setLab((v) => ({ ...v, integro: e.target.checked }))} /> El precinto llegó íntegro
          </label>
          <button type="button" disabled={ocupado} style={{ ...BTN_PRIMARY, marginTop: 12, opacity: ocupado ? 0.6 : 1 }}
            onClick={() => accion('laboratorio', {
              precinto_integro: lab.integro,
              pesos: Object.entries(lab.pesos).filter(([, v]) => v.trim() !== '').map(([sobre_id, peso_g]) => ({ sobre_id, peso_g })),
            })}>Registrar recepción y conciliar</button>
        </div>
      )}

      {rl && (
        <div className="mt-6" style={CARD}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Recepción en laboratorio</h3>
          <p className="mt-2" style={{ fontSize: 14, color: 'var(--t2)' }}>
            {fmtDateTime(rl.fecha_recepcion)} · precinto {rl.precinto_integro ? 'íntegro' : 'alterado'} · <Pill token={TOKEN_CONC[rl.estado_conciliacion]}>{CONCILIACION_LAB_ETIQUETA[rl.estado_conciliacion]}</Pill>
          </p>
          {rl.estado_conciliacion === 'umbral_no_configurado' && (
            <div className="mt-3"><Notice tone="amber">El umbral de conciliación de pesos no está configurado. Nada se da por conciliado hasta que se defina.</Notice></div>
          )}
          <div className="mt-4">
            <TableWrap>
              <thead><tr><th scope="col" style={TH}>Sobre</th><th scope="col" style={TH}>Manifiesto (g)</th><th scope="col" style={TH}>Recibido (g)</th><th scope="col" style={TH}>Diferencia</th></tr></thead>
              <tbody>
                {rl.conciliacion.diferencias.map((x) => (
                  <tr key={x.sobre_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...TD, ...MONO }}>{shortId(x.sobre_id)}</td><td style={{ ...TD, ...MONO }}>{x.peso_manifiesto_g}</td><td style={{ ...TD, ...MONO }}>{x.peso_recibido_g}</td>
                    <td style={{ ...TD, ...MONO, color: x.excede ? 'var(--red)' : 'var(--t1)' }}>{x.diferencia_pct === null ? '—' : `${fmtNum(x.diferencia_pct, 3)} %`}</td>
                  </tr>
                ))}
                {rl.conciliacion.faltan.map((f) => (
                  <tr key={f} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ ...TD, ...MONO }}>{shortId(f)}</td><td style={TD} colSpan={3}>Sin peso recibido</td></tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </div>
      )}
    </Section>
  );
}
