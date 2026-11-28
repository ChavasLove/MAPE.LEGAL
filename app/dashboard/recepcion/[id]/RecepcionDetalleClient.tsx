'use client';

// Detalle de una recepción: sobres por mina con su pesaje, análisis de ley y
// etiqueta de origen, y su empaque en una caja del MISMO titular.

import { useState } from 'react';
import Link from 'next/link';
import {
  BTN_GHOST, BTN_PRIMARY, BTN_SMALL, CARD, EmptyRow, ErrorBox, Field, INPUT, MONO, MONO_INPUT, Notice, Pill, Section, TableWrap, TD, TH, fmtDateTime, fmtNum, shortId,
} from '@/components/cadena/shared';
import { AVISO_PREPARACION, enviar, useCarga } from '@/components/recepcion/useCarga';
import { EMBALAJE_ETIQUETA, MODO_ENTREGA_ETIQUETA, type Caja, type PuntoRecepcion, type Recepcion, type Sobre } from '@/lib/recepcion/types';
import { sobreCompleto } from '@/lib/recepcion/reglas';
import { puede } from '@/lib/acceso/personal';
import type { Role } from '@/lib/userRoleLookup';

interface Detalle { recepcion: Recepcion; punto: PuntoRecepcion; sobres: Sobre[]; rol: Role }

export default function RecepcionDetalleClient({ id }: { id: string }) {
  const d = useCarga<Detalle>(`/api/recepcion/recepciones/${id}`);
  const cajas = useCarga<{ cajas: Caja[] }>('/api/recepcion/cajas');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (d.enPreparacion) return <Notice tone="amber">{AVISO_PREPARACION}</Notice>;
  if (!d.datos) return <div><ErrorBox error={d.error} />{!d.error && <p style={{ color: 'var(--t3)' }}>Cargando…</p>}</div>;

  const { recepcion: r, punto, sobres, rol } = d.datos;
  const registra = puede(rol, 'recepcion:registrar') && r.estado === 'registrada';
  const cajasAbiertas = (cajas.datos?.cajas ?? []).filter((c) => c.estado === 'abierta' && c.titular_cliente_id === r.titular_cliente_id);

  async function accion(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    setOcupado(true);
    const err = await enviar(url, body, method);
    setOcupado(false);
    setError(err);
    if (!err) d.recargar();
  }

  return (
    <Section
      eyebrow="Recepción"
      title={`Recepción ${r.codigo}`}
      lead={`${punto.nombre} · ${fmtDateTime(r.fecha_llegada)} · ${MODO_ENTREGA_ETIQUETA[r.modo_entrega]}${r.guia ? ` · guía ${r.guia}` : ''} · embalaje ${EMBALAJE_ETIQUETA[r.estado_embalaje].toLowerCase()}`}
      actions={<Link href="/dashboard/recepcion" style={{ ...BTN_SMALL, textDecoration: 'none' }}>Volver</Link>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pill token={r.estado === 'anulada' ? 'var(--red)' : 'var(--green)'}>{r.estado === 'anulada' ? 'Anulada' : 'Registrada'}</Pill>
        <span style={{ ...MONO, color: 'var(--t3)' }}>lote {shortId(r.lote_id)} · mina {shortId(r.mina_id)} · titular de origen {shortId(r.titular_cliente_id)}</span>
      </div>
      {r.observaciones && <p className="mb-4" style={{ fontSize: 14, color: 'var(--t2)' }}>{r.observaciones}</p>}
      <ErrorBox error={error} />

      <h3 className="mt-6 mb-3" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Sobres de esta mina</h3>
      <TableWrap>
        <thead>
          <tr>
            <th scope="col" style={TH}>Sobre</th>
            <th scope="col" style={TH}>Peso neto (g)</th>
            <th scope="col" style={TH}>Ley</th>
            <th scope="col" style={TH}>Etiqueta · sello</th>
            <th scope="col" style={TH}>Caja</th>
            <th scope="col" style={TH}><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {sobres.length === 0 && <EmptyRow cols={6}>Todavía no hay sobres.</EmptyRow>}
          {sobres.map((s) => (
            <FilaSobre key={s.id} sobre={s} editable={registra && !ocupado} cajas={cajasAbiertas}
              onGuardar={(body) => accion(`/api/recepcion/sobres/${s.id}`, body, 'PATCH')} />
          ))}
        </tbody>
      </TableWrap>

      {registra && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" style={{ ...BTN_PRIMARY, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado}
            onClick={() => accion(`/api/recepcion/recepciones/${id}/sobres`, {})}>Agregar sobre</button>
        </div>
      )}

      {registra && puede(rol, 'recepcion:anular') && (
        <div className="mt-8" style={CARD}>
          <Field label="Anular esta recepción" help="Nada se borra: la recepción queda marcada y la cadena recibe un evento de corrección con el motivo.">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Motivo (mínimo 5 caracteres)" style={INPUT} />
          </Field>
          <button type="button" disabled={ocupado || motivo.trim().length < 5} style={{ ...BTN_GHOST, marginTop: 12, opacity: ocupado || motivo.trim().length < 5 ? 0.6 : 1 }}
            onClick={() => accion(`/api/recepcion/recepciones/${id}/anular`, { motivo: motivo.trim() })}>Anular recepción</button>
        </div>
      )}
    </Section>
  );
}

function FilaSobre({ sobre: s, editable, cajas, onGuardar }: { sobre: Sobre; editable: boolean; cajas: Caja[]; onGuardar: (body: Record<string, unknown>) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({
    peso_bruto_g: s.peso_bruto_g?.toString() ?? '', peso_neto_g: s.peso_neto_g?.toString() ?? '', instrumento: s.instrumento ?? '',
    calibracion_fecha: s.calibracion_fecha ?? '', ley_fino: s.ley_fino?.toString() ?? '', etiqueta: s.etiqueta ?? '', numero_sello: s.numero_sello ?? '',
  });
  const [caja, setCaja] = useState(cajas[0]?.id ?? '');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const completo = sobreCompleto(s).ok;
  const puedeEditar = editable && s.estado === 'abierto';

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={{ ...TD, ...MONO }}>{shortId(s.id)}</td>
        <td style={{ ...TD, ...MONO }}>{s.peso_neto_g === null ? '—' : fmtNum(s.peso_neto_g)}</td>
        <td style={{ ...TD, ...MONO }}>{s.ley_fino === null ? '—' : fmtNum(s.ley_fino, 4)}</td>
        <td style={{ ...TD, ...MONO }}>{s.etiqueta ?? '—'}{s.numero_sello ? ` · ${s.numero_sello}` : ''}</td>
        <td style={TD}>
          {s.estado === 'anulado' ? <Pill token="var(--red)">Anulado</Pill>
            : s.caja_id ? <Link href={`/dashboard/recepcion/cajas/${s.caja_id}`} style={{ color: 'var(--moss)', fontWeight: 600 }}>En caja</Link>
            : <Pill token={completo ? 'var(--blue)' : 'var(--amber)'}>{completo ? 'Listo para caja' : 'Incompleto'}</Pill>}
        </td>
        <td style={TD}>{puedeEditar && <button type="button" style={BTN_SMALL} aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>{abierto ? 'Cerrar' : 'Registrar'}</button>}</td>
      </tr>
      {abierto && puedeEditar && (
        <tr>
          <td colSpan={6} style={{ padding: 16, background: 'var(--bg-soft)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Field label="Peso bruto (g)"><input inputMode="decimal" value={f.peso_bruto_g} onChange={set('peso_bruto_g')} style={MONO_INPUT} /></Field>
              <Field label="Peso neto (g)"><input inputMode="decimal" value={f.peso_neto_g} onChange={set('peso_neto_g')} style={MONO_INPUT} /></Field>
              <Field label="Instrumento"><input value={f.instrumento} onChange={set('instrumento')} maxLength={120} style={INPUT} /></Field>
              <Field label="Fecha de calibración"><input type="date" value={f.calibracion_fecha} onChange={set('calibracion_fecha')} style={INPUT} /></Field>
              <Field label="Ley (fracción 0–1)"><input inputMode="decimal" value={f.ley_fino} onChange={set('ley_fino')} style={MONO_INPUT} /></Field>
              <Field label="Etiqueta"><input value={f.etiqueta} onChange={set('etiqueta')} maxLength={64} style={MONO_INPUT} /></Field>
              <Field label="Número de sello" help="Del certificado de origen ya registrado."><input value={f.numero_sello} onChange={set('numero_sello')} maxLength={64} style={MONO_INPUT} /></Field>
            </div>
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <button type="button" style={BTN_PRIMARY} onClick={() => onGuardar({
                peso_bruto_g: f.peso_bruto_g || null, peso_neto_g: f.peso_neto_g || null, instrumento: f.instrumento || null,
                calibracion_fecha: f.calibracion_fecha || null, ley_fino: f.ley_fino || null, etiqueta: f.etiqueta || null, numero_sello: f.numero_sello || null,
              })}>Guardar pesaje, análisis y etiqueta</button>
              {completo && cajas.length > 0 && (
                <>
                  <select value={caja} onChange={(e) => setCaja(e.target.value)} style={{ ...INPUT, width: 220 }} aria-label="Caja de destino">
                    {cajas.map((c) => <option key={c.id} value={c.id}>{c.codigo}</option>)}
                  </select>
                  <button type="button" style={BTN_GHOST} onClick={() => onGuardar({ caja_id: caja })}>Empacar en la caja</button>
                </>
              )}
              {completo && cajas.length === 0 && <span style={{ fontSize: 13, color: 'var(--t3)' }}>No hay una caja abierta de este titular. Ábrala en «Cajas y envíos».</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
