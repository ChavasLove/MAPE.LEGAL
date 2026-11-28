'use client';

// Cola de aprobaciones de perfiles. Cada perfil se abre y se decide POR
// SEPARADO: no hay selección múltiple ni aprobación masiva. Quien creó o editó
// un perfil ve la decisión deshabilitada (separación de funciones); el servidor
// y la base lo vuelven a validar.

import { useEffect, useState } from 'react';
import {
  ApiError, apiFetch, postJson, BTN_GHOST, BTN_MOSS, BTN_PRIMARY, BTN_SMALL, CARD, EmptyRow, ErrorBox, Field, INPUT, MONO,
  Notice, Pill, Section, TableWrap, TD, TH, fmtDateTime, shortHash, shortId,
} from '@/components/cadena/shared';
import { ESTADOS_PERFIL, ESTADO_PERFIL_ETIQUETA, type EstadoPerfil, type TipoPerfil } from '@/lib/perfiles/estados';
import { CAMPOS_CONTENIDO } from '@/lib/perfiles/validacion';
import { puede, separacionDeFunciones } from '@/lib/acceso/personal';
import type { Role } from '@/lib/userRoleLookup';

interface PerfilLista {
  id: string; tipo: TipoPerfil; cliente_id: string | null; organizacion_id: string | null; estado: EstadoPerfil;
  version: number; contenido_hash: string; creado_por: string | null; editado_por: string | null; updated_at: string;
}
interface PerfilDetalle extends PerfilLista { contenido: Record<string, string>; documentos_respaldo: string[] }
interface Decision { secuencia: number; decision: string; decidido_rol: string; version: number; contenido_hash: string; motivo: string | null; hash: string; created_at: string }

const TOKEN: Record<EstadoPerfil, string> = {
  borrador: 'var(--slate)', pendiente: 'var(--amber)', aprobado: 'var(--green)', rechazado: 'var(--red)', suspendido: 'var(--red)',
};
const CAMPO_ETIQUETA: Record<string, string> = {
  nombre_legal: 'Nombre legal', razon_social: 'Razón social', tipo_persona: 'Tipo de persona', tipo_organizacion: 'Tipo de organización',
  municipio: 'Municipio', departamento: 'Departamento', representante: 'Representante', observaciones: 'Observaciones',
};

export default function AprobacionesClient() {
  const [estado, setEstado] = useState<EstadoPerfil | ''>('pendiente');
  const [perfiles, setPerfiles] = useState<PerfilLista[]>([]);
  const [yo, setYo] = useState<{ id: string; rol: Role } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enPreparacion, setEnPreparacion] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  // `recarga` fuerza una nueva lectura; el estado se actualiza solo dentro de
  // los callbacks de la petición (nunca de forma síncrona en el efecto).
  const [recarga, setRecarga] = useState(0);
  const recargar = () => { setCargando(true); setError(null); setRecarga((n) => n + 1); };

  useEffect(() => {
    let vivo = true;
    apiFetch<{ perfiles: PerfilLista[]; usuario: string; rol: Role }>(`/api/perfiles${estado ? `?estado=${estado}` : ''}`)
      .then((d) => {
        if (!vivo) return;
        setPerfiles(d.perfiles);
        setYo({ id: d.usuario, rol: d.rol });
        setCargando(false);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        if (e instanceof ApiError && e.migracionPendiente) setEnPreparacion(true);
        else setError(e instanceof Error ? e.message : 'Error al cargar');
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [estado, recarga]);

  if (enPreparacion) {
    return <Notice tone="amber">Módulo en preparación: las migraciones de perfiles y aprobaciones aún no están aplicadas en la base de datos.</Notice>;
  }

  const puedeCrear = yo ? puede(yo.rol, 'perfil:crear') : false;

  return (
    <Section
      eyebrow="Recepción y perfiles"
      title="Aprobaciones de perfiles"
      lead="Todo perfil nace pendiente. Se revisa con sus documentos de respaldo y se decide uno por uno. Quien creó o editó un perfil no puede decidir sobre él."
      actions={puedeCrear ? <button type="button" style={BTN_PRIMARY} onClick={() => setNuevo((v) => !v)}>{nuevo ? 'Cerrar' : 'Cargar perfil'}</button> : undefined}
    >
      {nuevo && puedeCrear && <NuevoPerfil onListo={() => { setNuevo(false); recargar(); }} />}

      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="estado" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Estado</label>
        <select id="estado" value={estado} onChange={(e) => { setAbierto(null); setCargando(true); setError(null); setEstado(e.target.value as EstadoPerfil | ''); }} style={{ ...INPUT, width: 240 }}>
          <option value="">Todos</option>
          {ESTADOS_PERFIL.map((e) => <option key={e} value={e}>{ESTADO_PERFIL_ETIQUETA[e]}</option>)}
        </select>
      </div>

      <ErrorBox error={error} />

      <TableWrap>
        <thead>
          <tr>
            <th scope="col" style={TH}>Perfil</th>
            <th scope="col" style={TH}>Tipo</th>
            <th scope="col" style={TH}>Estado</th>
            <th scope="col" style={TH}>Versión</th>
            <th scope="col" style={TH}>Actualizado</th>
            <th scope="col" style={TH}><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {cargando && <EmptyRow cols={6}>Cargando…</EmptyRow>}
          {!cargando && perfiles.length === 0 && <EmptyRow cols={6}>No hay perfiles en este estado.</EmptyRow>}
          {!cargando && perfiles.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...TD, ...MONO }}>{shortId(p.id)}</td>
              <td style={TD}>{p.tipo === 'minero' ? 'Minero / productor' : 'Organización'}</td>
              <td style={TD}><Pill token={TOKEN[p.estado]}>{ESTADO_PERFIL_ETIQUETA[p.estado]}</Pill></td>
              <td style={{ ...TD, ...MONO }}>v{p.version} · {shortHash(p.contenido_hash)}</td>
              <td style={TD}>{fmtDateTime(p.updated_at)}</td>
              <td style={TD}>
                <button type="button" style={BTN_SMALL} aria-expanded={abierto === p.id} onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
                  {abierto === p.id ? 'Cerrar' : 'Revisar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {abierto && yo && <Detalle key={abierto} id={abierto} yo={yo} onCambio={() => { setAbierto(null); recargar(); }} />}
    </Section>
  );
}

function Detalle({ id, yo, onCambio }: { id: string; yo: { id: string; rol: Role }; onCambio: () => void }) {
  const [perfil, setPerfil] = useState<PerfilDetalle | null>(null);
  const [decisiones, setDecisiones] = useState<Decision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    apiFetch<{ perfil: PerfilDetalle; decisiones: Decision[] }>(`/api/perfiles/${id}`)
      .then((d) => { if (vivo) { setPerfil(d.perfil); setDecisiones(d.decisiones); } })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar'); });
    return () => { vivo = false; };
  }, [id]);

  async function decidir(decision: 'aprobado' | 'rechazado' | 'suspendido') {
    setOcupado(true);
    setError(null);
    try {
      await postJson(`/api/perfiles/${id}/decidir`, { decision, motivo: motivo.trim() || null });
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la decisión');
    } finally {
      setOcupado(false);
    }
  }

  if (!perfil) return <div className="mt-6" style={CARD}><ErrorBox error={error} />{!error && <p style={{ color: 'var(--t3)', fontSize: 14 }}>Cargando perfil…</p>}</div>;

  const rolDecide = puede(yo.rol, 'perfil:decidir');
  const separacion = separacionDeFunciones(yo.id, perfil);
  const motivoCorto = motivo.trim().length < 5;

  return (
    <div className="mt-6" style={CARD}>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
        Perfil <span style={MONO}>{shortId(perfil.id)}</span> · versión {perfil.version}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mt-4">
        {CAMPOS_CONTENIDO[perfil.tipo].map((c) => (
          <div key={c}>
            <dt style={{ fontSize: 12, color: 'var(--t3)' }}>{CAMPO_ETIQUETA[c] ?? c}</dt>
            <dd style={{ fontSize: 14, color: 'var(--ink)' }}>{perfil.contenido?.[c] ?? '—'}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Documentos de respaldo</p>
      {perfil.documentos_respaldo?.length ? (
        <ul className="mt-1" style={{ fontSize: 13, color: 'var(--t2)' }}>
          {perfil.documentos_respaldo.map((d) => <li key={d} style={MONO}>{d}</li>)}
        </ul>
      ) : <p className="mt-1" style={{ fontSize: 13, color: 'var(--t3)' }}>Sin documentos de respaldo asociados.</p>}

      <p className="mt-5" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Historial de decisiones</p>
      {decisiones.length === 0 ? <p className="mt-1" style={{ fontSize: 13, color: 'var(--t3)' }}>Sin decisiones registradas.</p> : (
        <ol className="mt-1 space-y-1" style={{ fontSize: 13, color: 'var(--t2)' }}>
          {decisiones.map((d) => (
            <li key={d.secuencia}>
              <span style={MONO}>#{d.secuencia}</span> {d.decision} · versión {d.version} · {d.decidido_rol} · {fmtDateTime(d.created_at)}
              {d.motivo ? ` — ${d.motivo}` : ''} <span style={{ ...MONO, color: 'var(--t3)' }}>{shortHash(d.hash)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
        <ErrorBox error={error} />
        {!rolDecide && <Notice tone="blue">Su rol carga y consulta perfiles; la decisión corresponde al verificador.</Notice>}
        {rolDecide && !separacion.ok && (
          <Notice tone="amber">Usted creó o editó este perfil: la decisión debe tomarla otra persona.</Notice>
        )}
        {rolDecide && separacion.ok && (perfil.estado === 'pendiente' || perfil.estado === 'aprobado') && (
          <>
            <Field label="Motivo" help="Obligatorio para rechazar o suspender (mínimo 5 caracteres). Evite datos personales.">
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={1000} style={{ ...INPUT, resize: 'vertical' }} />
            </Field>
            <div className="flex flex-wrap gap-3 mt-4">
              {perfil.estado === 'pendiente' && (
                <>
                  <button type="button" style={{ ...BTN_MOSS, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={() => decidir('aprobado')}>Aprobar este perfil</button>
                  <button type="button" style={{ ...BTN_GHOST, opacity: ocupado || motivoCorto ? 0.6 : 1 }} disabled={ocupado || motivoCorto} onClick={() => decidir('rechazado')}>Rechazar</button>
                </>
              )}
              {perfil.estado === 'aprobado' && (
                <button type="button" style={{ ...BTN_GHOST, opacity: ocupado || motivoCorto ? 0.6 : 1 }} disabled={ocupado || motivoCorto} onClick={() => decidir('suspendido')}>Suspender</button>
              )}
            </div>
          </>
        )}
        {rolDecide && separacion.ok && perfil.estado !== 'pendiente' && perfil.estado !== 'aprobado' && (
          <Notice tone="blue">Este perfil no tiene una decisión pendiente en su estado actual.</Notice>
        )}
      </div>
    </div>
  );
}

function NuevoPerfil({ onListo }: { onListo: () => void }) {
  const [tipo, setTipo] = useState<TipoPerfil>('minero');
  const [sujeto, setSujeto] = useState('');
  const [contenido, setContenido] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await postJson('/api/perfiles', {
        tipo,
        cliente_id: tipo === 'minero' ? sujeto.trim() : null,
        organizacion_id: tipo === 'organizacion' ? sujeto.trim() : null,
        contenido,
      });
      onListo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el perfil');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mb-6" style={CARD}>
      <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16 }}>
        El perfil lo carga el personal a partir de los documentos del titular. Nace pendiente y otra persona lo revisa.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tipo de perfil">
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoPerfil); setContenido({}); }} style={INPUT}>
            <option value="minero">Minero / productor</option>
            <option value="organizacion">Organización</option>
          </select>
        </Field>
        <Field label={tipo === 'minero' ? 'Identificador del titular' : 'Identificador de la organización'} help="Identificador interno (uuid) del registro ya existente.">
          <input required value={sujeto} onChange={(e) => setSujeto(e.target.value)} style={{ ...INPUT, fontFamily: 'var(--font-mono)' }} />
        </Field>
        {CAMPOS_CONTENIDO[tipo].map((c) => (
          <Field key={c} label={CAMPO_ETIQUETA[c] ?? c}>
            <input value={contenido[c] ?? ''} maxLength={300} onChange={(e) => setContenido((v) => ({ ...v, [c]: e.target.value }))} style={INPUT} />
          </Field>
        ))}
      </div>
      <div className="mt-4"><ErrorBox error={error} /></div>
      <button type="submit" disabled={ocupado} style={{ ...BTN_PRIMARY, marginTop: 16, opacity: ocupado ? 0.6 : 1 }}>Guardar como pendiente</button>
    </form>
  );
}
