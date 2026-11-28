// PATCH /api/organizaciones/membresias/[id] — { accion: 'activar' | 'baja', motivo? }
// activar: `membresia:activar` (verificador o admin) y nunca quien dio el alta.
// baja:    `organizacion:gestionar`, con motivo. La baja es terminal.
// El cambio queda en `membresias_bitacora` (trigger) y en `bitacora_acciones`.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionRoles, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { puede, rolesCon } from '@/lib/acceso/personal';
import { isObj, isUuid } from '@/lib/cadena/validacion';
import { MEMBRESIA_MENSAJE, validarTransicionMembresia, type EstadoMembresia } from '@/lib/organizaciones/membresias';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionRoles(...new Set([...rolesCon('membresia:activar'), ...rolesCon('organizacion:gestionar')]));
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Membresía');
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  if (!isObj(body) || (body.accion !== 'activar' && body.accion !== 'baja')) {
    return NextResponse.json({ error: "accion inválida. Permitidas: 'activar', 'baja'." }, { status: 400 });
  }
  const activar = body.accion === 'activar';
  if (!puede(s.ctx.rol, activar ? 'membresia:activar' : 'organizacion:gestionar')) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  const actual = await s.admin.from('membresias_organizacion').select('id, estado, alta_por, organizacion_id').eq('id', id).maybeSingle();
  if (actual.error) return errorDb('[organizaciones/membresias PATCH]', actual.error, 'Error al obtener la membresía');
  const m = actual.data as { id: string; estado: EstadoMembresia; alta_por: string; organizacion_id: string } | null;
  if (!m) return noEncontrado('Membresía');

  const a: EstadoMembresia = activar ? 'activa' : 'baja';
  const t = validarTransicionMembresia({ de: m.estado, a, actorId: s.ctx.userId, actorRol: s.ctx.rol, altaPor: m.alta_por, motivo: body.motivo });
  if (!t.ok) {
    const status = t.motivo === 'separacion_de_funciones' || t.motivo === 'activacion_no_autorizada' ? 403 : t.motivo === 'motivo_obligatorio' ? 400 : 409;
    return NextResponse.json({ error: MEMBRESIA_MENSAJE[t.motivo], motivo: t.motivo }, { status });
  }

  const cambios: Record<string, unknown> = { estado: a, ultimo_actor: s.ctx.userId };
  if (!activar) cambios.motivo_baja = String(body.motivo).trim().slice(0, 500);
  const { data, error } = await s.admin.from('membresias_organizacion').update(cambios).eq('id', id).eq('estado', m.estado).select('id, estado');
  if (error) return errorDb('[organizaciones/membresias PATCH]', error, 'Error al actualizar la membresía');
  if ((data ?? []).length === 0) return NextResponse.json({ error: 'La membresía fue modificada por otra operación.' }, { status: 409 });
  await registrarAccion(s, {
    accion: activar ? 'membresia_activada' : 'membresia_baja', recurso_tipo: 'membresia', recurso_id: id,
    resumen: `Membresía ${m.estado} → ${a}`, detalle: { organizacion_id: m.organizacion_id },
  });
  return NextResponse.json({ ok: true, estado: a });
}
