'use client';

// Cajas (contenedores) para el envío al laboratorio. Cada caja es de UN titular
// de origen: los lotes de titulares distintos no se mezclan.

import { useState } from 'react';
import Link from 'next/link';
import {
  BTN_PRIMARY, BTN_SMALL, CARD, EmptyRow, ErrorBox, Field, INPUT, MONO, MONO_INPUT, Notice, Pill, Section, TableWrap, TD, TH, fmtDateTime, shortHash, shortId,
} from '@/components/cadena/shared';
import { AVISO_PREPARACION, enviar, useCarga } from '@/components/recepcion/useCarga';
import { ESTADO_CAJA_ETIQUETA, type Caja, type EstadoCaja, type PuntoRecepcion } from '@/lib/recepcion/types';
import { puede } from '@/lib/acceso/personal';
import type { Role } from '@/lib/userRoleLookup';

const TOKEN: Record<EstadoCaja, string> = { abierta: 'var(--amber)', cerrada: 'var(--blue)', enviada: 'var(--blue)', recibida: 'var(--green)', anulada: 'var(--red)' };

export default function CajasClient() {
  const lista = useCarga<{ cajas: Caja[]; laboratorios: Array<{ id: string; nombre: string }> }>('/api/recepcion/cajas');
  const puntos = useCarga<{ puntos: PuntoRecepcion[]; rol: Role }>('/api/recepcion/puntos');
  const [nueva, setNueva] = useState(false);
  const [f, setF] = useState({ punto_id: '', titular_cliente_id: '', laboratorio_org_id: '' });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (lista.enPreparacion || puntos.enPreparacion) return <Notice tone="amber">{AVISO_PREPARACION}</Notice>;
  const rol = puntos.datos?.rol;
  const registra = rol ? puede(rol, 'recepcion:registrar') : false;
  const activos = (puntos.datos?.puntos ?? []).filter((p) => p.activo);
  const labs = lista.datos?.laboratorios ?? [];

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const err = await enviar('/api/recepcion/cajas', {
      punto_id: f.punto_id || activos[0]?.id, titular_cliente_id: f.titular_cliente_id.trim(), laboratorio_org_id: f.laboratorio_org_id || labs[0]?.id,
    });
    setOcupado(false);
    setError(err);
    if (!err) { setNueva(false); lista.recargar(); }
  }

  return (
    <Section
      eyebrow="Recepción"
      title="Cajas y envíos al laboratorio"
      lead="Los sobres se agrupan en una caja con manifiesto y precinto. La caja se envía al laboratorio de destino y allí se concilian los pesos contra el manifiesto."
      actions={(
        <div className="flex gap-3">
          <Link href="/dashboard/recepcion" style={{ ...BTN_SMALL, textDecoration: 'none' }}>Recepciones</Link>
          {registra && <button type="button" style={BTN_PRIMARY} onClick={() => setNueva((v) => !v)}>{nueva ? 'Cerrar' : 'Abrir caja'}</button>}
        </div>
      )}
    >
      {nueva && registra && (
        <form onSubmit={crear} className="mb-6" style={CARD}>
          {labs.length === 0 && <div className="mb-4"><Notice tone="amber">No hay ninguna organización de tipo laboratorio registrada. Administración debe darla de alta.</Notice></div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Punto de recepción">
              <select value={f.punto_id || activos[0]?.id || ''} onChange={(e) => setF((v) => ({ ...v, punto_id: e.target.value }))} style={INPUT} required>
                {activos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Titular de origen" help="Identificador interno. Todos los sobres de la caja deben ser de este titular.">
              <input value={f.titular_cliente_id} onChange={(e) => setF((v) => ({ ...v, titular_cliente_id: e.target.value }))} style={MONO_INPUT} required />
            </Field>
            <Field label="Laboratorio de destino">
              <select value={f.laboratorio_org_id || labs[0]?.id || ''} onChange={(e) => setF((v) => ({ ...v, laboratorio_org_id: e.target.value }))} style={INPUT} required>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4"><ErrorBox error={error} /></div>
          <button type="submit" disabled={ocupado || labs.length === 0 || activos.length === 0} style={{ ...BTN_PRIMARY, marginTop: 16, opacity: ocupado ? 0.6 : 1 }}>Abrir caja</button>
        </form>
      )}
      <ErrorBox error={lista.error} />
      <TableWrap>
        <thead>
          <tr>
            <th scope="col" style={TH}>Caja</th>
            <th scope="col" style={TH}>Titular de origen</th>
            <th scope="col" style={TH}>Estado</th>
            <th scope="col" style={TH}>Precinto</th>
            <th scope="col" style={TH}>Manifiesto</th>
            <th scope="col" style={TH}>Abierta</th>
            <th scope="col" style={TH}><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {lista.cargando && <EmptyRow cols={7}>Cargando…</EmptyRow>}
          {!lista.cargando && (lista.datos?.cajas.length ?? 0) === 0 && <EmptyRow cols={7}>No hay cajas.</EmptyRow>}
          {!lista.cargando && lista.datos?.cajas.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...TD, ...MONO }}>{c.codigo}</td>
              <td style={{ ...TD, ...MONO }}>{shortId(c.titular_cliente_id)}</td>
              <td style={TD}><Pill token={TOKEN[c.estado]}>{ESTADO_CAJA_ETIQUETA[c.estado]}</Pill></td>
              <td style={{ ...TD, ...MONO }}>{c.precinto ?? '—'}</td>
              <td style={{ ...TD, ...MONO }}>{c.manifiesto_hash ? shortHash(c.manifiesto_hash) : '—'}</td>
              <td style={TD}>{fmtDateTime(c.created_at)}</td>
              <td style={TD}><Link href={`/dashboard/recepcion/cajas/${c.id}`} style={{ ...BTN_SMALL, textDecoration: 'none' }}>Abrir</Link></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Section>
  );
}
