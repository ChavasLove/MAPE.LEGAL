'use client';

// Organizaciones, membresías e invitaciones. Las altas, activaciones y bajas
// las hace el personal; el minero y la organización solo ven su pertenencia.

import { useState } from 'react';
import {
  BTN_GHOST, BTN_PRIMARY, BTN_SMALL, CARD, EmptyRow, ErrorBox, Field, INPUT, MONO, MONO_INPUT, Notice, Pill, Section, TableWrap, TD, TH,
  TIPO_ORG_LABEL, fmtDateTime, shortId,
} from '@/components/cadena/shared';
import { AVISO_PREPARACION, enviar, useCarga } from '@/components/recepcion/useCarga';
import { ESTADO_MEMBRESIA_ETIQUETA, ROLES_EN_ORGANIZACION, ROL_ORG_ETIQUETA, type EstadoMembresia, type Membresia } from '@/lib/organizaciones/membresias';
import { puede } from '@/lib/acceso/personal';
import type { TipoOrganizacion } from '@/lib/cadena/types';
import type { Role } from '@/lib/userRoleLookup';

interface Org { id: string; tipo: TipoOrganizacion; nombre: string; activo: boolean }
const TOKEN: Record<EstadoMembresia, string> = { pendiente: 'var(--amber)', activa: 'var(--green)', baja: 'var(--slate)' };

export default function OrganizacionesClient() {
  const orgs = useCarga<{ organizaciones: Org[]; rol: Role; usuario: string }>('/api/organizaciones');
  const [sel, setSel] = useState<string | null>(null);

  if (orgs.enPreparacion) return <Notice tone="amber">{AVISO_PREPARACION}</Notice>;

  return (
    <Section
      eyebrow="Recepción y perfiles"
      title="Organizaciones"
      lead="Cooperativas, municipios que adoptan el estándar, laboratorios, centros de acopio y demás organizaciones viven en una sola lista. La pertenencia de un minero a una organización es informativa: no concede derechos de carga."
    >
      <ErrorBox error={orgs.error} />
      <TableWrap>
        <thead>
          <tr><th scope="col" style={TH}>Organización</th><th scope="col" style={TH}>Tipo</th><th scope="col" style={TH}>Estado</th><th scope="col" style={TH}><span className="sr-only">Abrir</span></th></tr>
        </thead>
        <tbody>
          {orgs.cargando && <EmptyRow cols={4}>Cargando…</EmptyRow>}
          {!orgs.cargando && (orgs.datos?.organizaciones.length ?? 0) === 0 && <EmptyRow cols={4}>No hay organizaciones registradas.</EmptyRow>}
          {!orgs.cargando && orgs.datos?.organizaciones.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={TD}>{o.nombre}</td>
              <td style={TD}>{TIPO_ORG_LABEL[o.tipo] ?? o.tipo}</td>
              <td style={TD}><Pill token={o.activo ? 'var(--green)' : 'var(--slate)'}>{o.activo ? 'Activa' : 'Inactiva'}</Pill></td>
              <td style={TD}><button type="button" style={BTN_SMALL} aria-expanded={sel === o.id} onClick={() => setSel(sel === o.id ? null : o.id)}>{sel === o.id ? 'Cerrar' : 'Miembros'}</button></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {sel && orgs.datos && <Miembros key={sel} orgId={sel} rol={orgs.datos.rol} usuario={orgs.datos.usuario} />}
    </Section>
  );
}

function Miembros({ orgId, rol, usuario }: { orgId: string; rol: Role; usuario: string }) {
  const m = useCarga<{ membresias: Membresia[]; bitacora: Array<{ membresia_id: string; actor_rol: string | null; cambio: string; de_estado: string | null; a_estado: string; created_at: string }> }>(`/api/organizaciones/${orgId}/membresias`);
  const inv = useCarga<{ invitaciones: Array<{ id: string; correo: string; estado: string; expira_en: string; rol_en_organizacion: string }> }>(`/api/organizaciones/${orgId}/invitaciones`);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [alta, setAlta] = useState({ perfil_id: '', rol: 'miembro' });
  const [invitar, setInvitar] = useState({ correo: '', rol: 'miembro' });
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const gestiona = puede(rol, 'organizacion:gestionar');
  const activa = puede(rol, 'membresia:activar');

  async function accion(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    setOcupado(true);
    const err = await enviar(url, body, method);
    setOcupado(false);
    setError(err);
    if (!err) { m.recargar(); inv.recargar(); }
  }

  return (
    <div className="mt-6" style={CARD}>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Miembros</h3>
      <div className="mt-3"><ErrorBox error={error ?? m.error ?? inv.error} /></div>
      <TableWrap>
        <thead>
          <tr><th scope="col" style={TH}>Miembro</th><th scope="col" style={TH}>Papel</th><th scope="col" style={TH}>Estado</th><th scope="col" style={TH}>Alta</th><th scope="col" style={TH}><span className="sr-only">Acciones</span></th></tr>
        </thead>
        <tbody>
          {(m.datos?.membresias.length ?? 0) === 0 && <EmptyRow cols={5}>{m.cargando ? 'Cargando…' : 'Sin miembros.'}</EmptyRow>}
          {m.datos?.membresias.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...TD, ...MONO }}>{x.perfil_id ? `perfil ${shortId(x.perfil_id)}` : `usuario ${shortId(x.user_id)}`}</td>
              <td style={TD}>{ROL_ORG_ETIQUETA[x.rol_en_organizacion]}</td>
              <td style={TD}><Pill token={TOKEN[x.estado]}>{ESTADO_MEMBRESIA_ETIQUETA[x.estado]}</Pill></td>
              <td style={TD}>{fmtDateTime(x.fecha_alta)}</td>
              <td style={{ ...TD, whiteSpace: 'normal' }}>
                <div className="flex flex-wrap items-center gap-2">
                  {x.estado === 'pendiente' && activa && (
                    x.alta_por === usuario
                      ? <span style={{ fontSize: 12, color: 'var(--t3)' }}>La activa otra persona</span>
                      : <button type="button" disabled={ocupado} style={BTN_SMALL} onClick={() => accion(`/api/organizaciones/membresias/${x.id}`, { accion: 'activar' }, 'PATCH')}>Activar</button>
                  )}
                  {x.estado !== 'baja' && gestiona && (
                    <>
                      <input aria-label="Motivo de la baja" placeholder="Motivo de la baja" value={motivos[x.id] ?? ''} maxLength={500}
                        onChange={(e) => setMotivos((v) => ({ ...v, [x.id]: e.target.value }))} style={{ ...INPUT, width: 200, padding: '6px 10px', fontSize: 13 }} />
                      <button type="button" disabled={ocupado || (motivos[x.id] ?? '').trim().length < 5} style={{ ...BTN_SMALL, opacity: (motivos[x.id] ?? '').trim().length < 5 ? 0.6 : 1 }}
                        onClick={() => accion(`/api/organizaciones/membresias/${x.id}`, { accion: 'baja', motivo: motivos[x.id] }, 'PATCH')}>Dar de baja</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {gestiona && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <form onSubmit={(e) => { e.preventDefault(); void accion(`/api/organizaciones/${orgId}/membresias`, { perfil_id: alta.perfil_id.trim(), rol_en_organizacion: alta.rol }); }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Alta de un minero con perfil</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Perfil" help="Identificador interno del perfil."><input required value={alta.perfil_id} onChange={(e) => setAlta((v) => ({ ...v, perfil_id: e.target.value }))} style={MONO_INPUT} /></Field>
              <Field label="Papel">
                <select value={alta.rol} onChange={(e) => setAlta((v) => ({ ...v, rol: e.target.value }))} style={INPUT}>
                  {ROLES_EN_ORGANIZACION.map((r) => <option key={r} value={r}>{ROL_ORG_ETIQUETA[r]}</option>)}
                </select>
              </Field>
            </div>
            <button type="submit" disabled={ocupado} style={{ ...BTN_PRIMARY, marginTop: 12 }}>Dar de alta (queda pendiente)</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); void accion(`/api/organizaciones/${orgId}/invitaciones`, { correo: invitar.correo, rol_en_organizacion: invitar.rol }); }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Invitar por correo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Correo" help="Recibe un enlace de un solo uso."><input type="email" required value={invitar.correo} onChange={(e) => setInvitar((v) => ({ ...v, correo: e.target.value }))} style={INPUT} /></Field>
              <Field label="Papel">
                <select value={invitar.rol} onChange={(e) => setInvitar((v) => ({ ...v, rol: e.target.value }))} style={INPUT}>
                  {ROLES_EN_ORGANIZACION.map((r) => <option key={r} value={r}>{ROL_ORG_ETIQUETA[r]}</option>)}
                </select>
              </Field>
            </div>
            <button type="submit" disabled={ocupado} style={{ ...BTN_GHOST, marginTop: 12 }}>Enviar invitación</button>
          </form>
        </div>
      )}

      {(inv.datos?.invitaciones.length ?? 0) > 0 && (
        <>
          <p className="mt-6" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Invitaciones</p>
          <ul className="mt-2 space-y-1" style={{ fontSize: 13, color: 'var(--t2)' }}>
            {inv.datos?.invitaciones.map((i) => <li key={i.id}>{i.correo} · {i.estado} · vence {fmtDateTime(i.expira_en)}</li>)}
          </ul>
        </>
      )}

      {(m.datos?.bitacora.length ?? 0) > 0 && (
        <>
          <p className="mt-6" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Bitácora</p>
          <ol className="mt-2 space-y-1" style={{ fontSize: 13, color: 'var(--t2)' }}>
            {m.datos?.bitacora.map((b, i) => (
              <li key={i}><span style={MONO}>{shortId(b.membresia_id)}</span> · {b.cambio} · {b.de_estado ?? '—'} → {b.a_estado} · {b.actor_rol ?? '—'} · {fmtDateTime(b.created_at)}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
