'use client';

// components/cadena/EventosTimeline.tsx — línea de tiempo de los eventos de un
// lote (secuencia, tipo, actor, fecha, lugar, peso, ley, hash y hash previo) con
// el indicador de verificación de la cadena de hash. Solo lectura.

import type { LoteEvento } from '@/lib/cadena/types';
import {
  TH, TD, TD_WRAP, MONO, TIPO_EVENTO_LABEL, ROL_LABEL_CADENA,
  fmtDateTime, fmtNum, shortHash, TableWrap, EmptyRow, VerificacionBadge,
  type VerificacionCadena,
} from './shared';

interface Props {
  eventos: LoteEvento[];
  verificacion: VerificacionCadena | null;
}

export default function EventosTimeline({ eventos, verificacion }: Props) {
  const rotura = verificacion && !verificacion.ok ? verificacion.primeraRotura : null;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <VerificacionBadge v={verificacion} />
      <TableWrap>
        <thead>
          <tr>
            <th scope="col" style={TH}>#</th>
            <th scope="col" style={TH}>Tipo</th>
            <th scope="col" style={TH}>Actor</th>
            <th scope="col" style={TH}>Fecha</th>
            <th scope="col" style={TH}>Lugar</th>
            <th scope="col" style={TH}>Peso (g)</th>
            <th scope="col" style={TH}>Ley fino</th>
            <th scope="col" style={TH}>Hash</th>
            <th scope="col" style={TH}>Hash previo</th>
          </tr>
        </thead>
        <tbody>
          {eventos.length === 0 && <EmptyRow cols={9}>Sin eventos registrados todavía.</EmptyRow>}
          {eventos.map((e) => {
            const roto = rotura !== null && rotura !== undefined && e.secuencia >= rotura;
            const detalleTexto = detalleResumen(e);
            return (
              <tr key={e.id} style={roto ? { boxShadow: 'inset 3px 0 0 var(--red)' } : undefined}>
                <td style={{ ...TD, ...MONO, color: roto ? 'var(--red)' : 'var(--t1)' }}>{e.secuencia}</td>
                <td style={TD_WRAP}>
                  <div style={{ fontWeight: 600 }}>{TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}</div>
                  {detalleTexto && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{detalleTexto}</div>}
                </td>
                <td style={TD_WRAP}>
                  <div>{ROL_LABEL_CADENA[e.actor_rol ?? ''] ?? e.actor_rol ?? '—'}</div>
                  {e.actor_nombre && <div style={{ fontSize: 12, color: 'var(--t3)' }}>{e.actor_nombre}</div>}
                </td>
                <td style={TD}>{fmtDateTime(e.fecha)}</td>
                <td style={TD_WRAP}>{e.lugar ?? '—'}</td>
                <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtNum(e.peso_g, 3)}</td>
                <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtNum(e.ley_fino, 6)}</td>
                <td style={{ ...TD, ...MONO }} title={e.hash}>{shortHash(e.hash)}</td>
                <td style={{ ...TD, ...MONO, color: 'var(--t3)' }} title={e.hash_previo}>{shortHash(e.hash_previo)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}

function detalleResumen(e: LoteEvento): string | null {
  const d = e.detalle ?? {};
  if (e.tipo === 'fundicion') {
    const t = d.titular_beneficio as { nombre?: string } | undefined;
    const rol = typeof d.realizado_por_rol === 'string' ? ROL_LABEL_CADENA[d.realizado_por_rol] ?? d.realizado_por_rol : null;
    const partes = [t?.nombre ? `Titular de beneficio: ${t.nombre}` : null, rol ? `Realizado por: ${rol}` : null].filter(Boolean);
    return partes.length ? partes.join(' · ') : null;
  }
  if (typeof d.nota === 'string' && d.nota.trim()) return d.nota.trim();
  if (typeof d.descripcion === 'string' && d.descripcion.trim()) return d.descripcion.trim();
  return null;
}
