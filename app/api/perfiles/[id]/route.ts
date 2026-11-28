// /api/perfiles/[id]
// GET   personal con `perfil:ver` → perfil completo + historial de decisiones.
// PATCH personal con `perfil:editar` → edita contenido / documentos / envía a
//       revisión. Editar un perfil ya decidido lo devuelve a `pendiente` y sube
//       la versión (trigger de la 046): quien edita ya no podrá decidir.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { puedeTransicionarCarga, type EstadoPerfil, type TipoPerfil } from '@/lib/perfiles/estados';
import { validarPerfilEditar } from '@/lib/perfiles/validacion';
import { avisarPerfilesPendientes } from '@/lib/perfiles/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PerfilFila { id: string; tipo: TipoPerfil; estado: EstadoPerfil; version: number; creado_por: string | null; editado_por: string | null }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('perfil:ver');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Perfil');
  const [perfil, decisiones] = await Promise.all([
    s.admin.from('perfiles').select('*').eq('id', id).maybeSingle(),
    s.admin.from('aprobaciones_perfil')
      .select('secuencia, decision, decidido_por, decidido_rol, version, contenido_hash, motivo, hash_previo, hash, created_at')
      .eq('perfil_id', id).order('secuencia', { ascending: true }),
  ]);
  if (perfil.error) return errorDb('[perfiles/id GET]', perfil.error, 'Error al obtener el perfil');
  if (!perfil.data) return noEncontrado('Perfil');
  if (decisiones.error) return errorDb('[perfiles/id GET]', decisiones.error, 'Error al obtener el historial');
  return NextResponse.json({ perfil: perfil.data, decisiones: decisiones.data ?? [], usuario: s.ctx.userId, rol: s.ctx.rol });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('perfil:editar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Perfil');

  const actual = await s.admin.from('perfiles').select('id, tipo, estado, version, creado_por, editado_por').eq('id', id).maybeSingle();
  if (actual.error) return errorDb('[perfiles/id PATCH]', actual.error, 'Error al obtener el perfil');
  const p = actual.data as PerfilFila | null;
  if (!p) return noEncontrado('Perfil');

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarPerfilEditar(p.tipo, body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const cambios: Record<string, unknown> = {};
  if (v.data.contenido !== undefined) cambios.contenido = v.data.contenido;
  if (v.data.documentos_respaldo !== undefined) cambios.documentos_respaldo = v.data.documentos_respaldo;
  if (cambios.contenido !== undefined || cambios.documentos_respaldo !== undefined) cambios.editado_por = s.ctx.userId;
  if (v.data.enviar_a_revision) {
    if (p.estado !== 'pendiente' && !puedeTransicionarCarga(p.estado, 'pendiente')) {
      return NextResponse.json({ error: 'El estado actual no permite enviar el perfil a revisión.' }, { status: 409 });
    }
    cambios.estado = 'pendiente';
  }

  // Guard optimista sobre la versión leída: dos ediciones simultáneas no se pisan.
  const { data, error } = await s.admin.from('perfiles').update(cambios).eq('id', id).eq('version', p.version)
    .select('id, tipo, estado, version, contenido_hash, updated_at');
  if (error) return errorDb('[perfiles/id PATCH]', error, 'Error al editar el perfil');
  const filas = (data ?? []) as Array<{ id: string; estado: string; version: number }>;
  if (filas.length === 0) return NextResponse.json({ error: 'El perfil fue modificado por otra operación. Recargue e intente de nuevo.' }, { status: 409 });

  const nuevo = filas[0];
  await registrarAccion(s, {
    accion: 'perfil_editado', recurso_tipo: 'perfil', recurso_id: id,
    resumen: `Perfil editado: versión ${p.version} → ${nuevo.version}, estado ${p.estado} → ${nuevo.estado}`,
  });
  if (nuevo.estado === 'pendiente' && p.estado !== 'pendiente') avisarPerfilesPendientes(s.admin);
  return NextResponse.json({ perfil: nuevo });
}
