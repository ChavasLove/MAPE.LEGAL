'use client';

// Recepciones registradas por el personal del punto. El titular no carga nada:
// aquí se anota la llegada del material de un lote. Sin montos ni comprobantes.

import { useState } from 'react';
import Link from 'next/link';
import {
  BTN_PRIMARY, BTN_SMALL, CARD, EmptyRow, ErrorBox, Field, INPUT, MONO, MONO_INPUT, Notice, Pill, Section, TableWrap, TD, TH, fmtDateTime, shortId,
} from '@/components/cadena/shared';
import { AVISO_PREPARACION, enviar, useCarga } from '@/components/recepcion/useCarga';
import { EMBALAJE_ETIQUETA, ESTADOS_EMBALAJE, MODOS_ENTREGA, MODO_ENTREGA_ETIQUETA, TIPO_PUNTO_ETIQUETA, type PuntoRecepcion, type Recepcion } from '@/lib/recepcion/types';
import { puede } from '@/lib/acceso/personal';
import type { Role } from '@/lib/userRoleLookup';

export default function RecepcionesClient() {
  const lista = useCarga<{ recepciones: Recepcion[] }>('/api/recepcion/recepciones');
  const puntos = useCarga<{ puntos: PuntoRecepcion[]; rol: Role }>('/api/recepcion/puntos');
  const [nueva, setNueva] = useState(false);

  if (lista.enPreparacion || puntos.enPreparacion) return <Notice tone="amber">{AVISO_PREPARACION}</Notice>;
  const rol = puntos.datos?.rol;
  const registra = rol ? puede(rol, 'recepcion:registrar') : false;
  const nombrePunto = (id: string) => puntos.datos?.puntos.find((p) => p.id === id)?.nombre ?? shortId(id);

  return (
    <Section
      eyebrow="Recepción y perfiles"
      title="Recepción"
      lead="Registro de recepción por el operador de recepción designado. Lo anota el personal del punto; cada paso queda en la cadena de custodia del lote."
      actions={(
        <div className="flex gap-3">
          <Link href="/dashboard/recepcion/cajas" style={{ ...BTN_SMALL, textDecoration: 'none' }}>Cajas y envíos</Link>
          {registra && <button type="button" style={BTN_PRIMARY} onClick={() => setNueva((v) => !v)}>{nueva ? 'Cerrar' : 'Nueva recepción'}</button>}
        </div>
      )}
    >
      {nueva && registra && <NuevaRecepcion puntos={(puntos.datos?.puntos ?? []).filter((p) => p.activo)} onListo={() => { setNueva(false); lista.recargar(); }} />}
      <ErrorBox error={lista.error ?? puntos.error} />
      {!registra && rol && <div className="mb-4"><Notice tone="blue">Su rol consulta las recepciones; el registro lo hace el personal de recepción.</Notice></div>}
      <TableWrap>
        <thead>
          <tr>
            <th scope="col" style={TH}>Recepción</th>
            <th scope="col" style={TH}>Punto</th>
            <th scope="col" style={TH}>Llegada</th>
            <th scope="col" style={TH}>Entrega</th>
            <th scope="col" style={TH}>Embalaje</th>
            <th scope="col" style={TH}>Estado</th>
            <th scope="col" style={TH}><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {lista.cargando && <EmptyRow cols={7}>Cargando…</EmptyRow>}
          {!lista.cargando && (lista.datos?.recepciones.length ?? 0) === 0 && <EmptyRow cols={7}>No hay recepciones registradas.</EmptyRow>}
          {!lista.cargando && lista.datos?.recepciones.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...TD, ...MONO }}>{r.codigo}</td>
              <td style={TD}>{nombrePunto(r.punto_id)}</td>
              <td style={TD}>{fmtDateTime(r.fecha_llegada)}</td>
              <td style={TD}>{MODO_ENTREGA_ETIQUETA[r.modo_entrega]}{r.guia ? <span style={{ ...MONO, color: 'var(--t3)' }}> · {r.guia}</span> : null}</td>
              <td style={TD}>{EMBALAJE_ETIQUETA[r.estado_embalaje]}</td>
              <td style={TD}><Pill token={r.estado === 'anulada' ? 'var(--red)' : 'var(--green)'}>{r.estado === 'anulada' ? 'Anulada' : 'Registrada'}</Pill></td>
              <td style={TD}><Link href={`/dashboard/recepcion/${r.id}`} style={{ ...BTN_SMALL, textDecoration: 'none' }}>Abrir</Link></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Section>
  );
}

function NuevaRecepcion({ puntos, onListo }: { puntos: PuntoRecepcion[]; onListo: () => void }) {
  const [f, setF] = useState({ punto_id: puntos[0]?.id ?? '', lote_id: '', mina_id: '', modo_entrega: 'en_persona', guia: '', estado_embalaje: 'integro', observaciones: '' });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const err = await enviar('/api/recepcion/recepciones', { ...f, lote_id: f.lote_id.trim(), mina_id: f.mina_id.trim(), guia: f.guia || null, observaciones: f.observaciones || null });
    setOcupado(false);
    setError(err);
    if (!err) onListo();
  }

  if (puntos.length === 0) return <div className="mb-6"><Notice tone="amber">No tiene un punto de recepción activo asignado. Pida a administración que lo asigne.</Notice></div>;

  return (
    <form onSubmit={guardar} className="mb-6" style={CARD}>
      <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16 }}>
        El titular de origen se toma del lote y debe tener su perfil aprobado. La mina debe ser de ese mismo titular: cada mina con su expediente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Punto de recepción">
          <select value={f.punto_id} onChange={set('punto_id')} style={INPUT} required>
            {puntos.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {TIPO_PUNTO_ETIQUETA[p.tipo]}</option>)}
          </select>
        </Field>
        <Field label="Modo de entrega">
          <select value={f.modo_entrega} onChange={set('modo_entrega')} style={INPUT}>
            {MODOS_ENTREGA.map((m) => <option key={m} value={m}>{MODO_ENTREGA_ETIQUETA[m]}</option>)}
          </select>
        </Field>
        <Field label="Lote" help="Identificador interno del lote ya creado en la cadena de custodia.">
          <input value={f.lote_id} onChange={set('lote_id')} style={MONO_INPUT} required />
        </Field>
        <Field label="Mina / expediente de procedencia" help="Identificador interno de la mina del titular.">
          <input value={f.mina_id} onChange={set('mina_id')} style={MONO_INPUT} required />
        </Field>
        <Field label="Guía o número de envío" help="Si llegó por transportista.">
          <input value={f.guia} onChange={set('guia')} maxLength={80} style={MONO_INPUT} />
        </Field>
        <Field label="Estado del embalaje">
          <select value={f.estado_embalaje} onChange={set('estado_embalaje')} style={INPUT}>
            {ESTADOS_EMBALAJE.map((m) => <option key={m} value={m}>{EMBALAJE_ETIQUETA[m]}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Observaciones" help="Evite datos personales.">
          <textarea value={f.observaciones} onChange={set('observaciones')} rows={2} maxLength={1000} style={{ ...INPUT, resize: 'vertical' }} />
        </Field>
      </div>
      <div className="mt-4"><ErrorBox error={error} /></div>
      <button type="submit" disabled={ocupado} style={{ ...BTN_PRIMARY, marginTop: 16, opacity: ocupado ? 0.6 : 1 }}>Registrar recepción</button>
    </form>
  );
}
