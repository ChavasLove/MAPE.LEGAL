// /api/organizaciones/[id]/membresias
// GET  personal con `perfil:ver` → membresías de la organización + su bitácora.
// POST personal con `organizacion:gestionar` → alta. NACE pendiente: la activa
//      después un verificador distinto de quien dio el alta.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { validarMembresiaAlta } from '@/lib/organizaciones/membresias';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, organizacion_id, perfil_id, user_id, rol_en_organizacion, estado, alta_por, activada_por, fecha_alta, fecha_activacion, fecha_baja, motivo_baja';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('perfil:ver');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Organización');
  const [m, b] = await Promise.all([
    s.admin.from('membresias_organizacion').select(COLUMNAS).eq('organizacion_id', id).order('fecha_alta', { ascending: false }).limit(1000),
    s.admin.from('membresias_bitacora').select('membresia_id, actor_rol, cambio, de_estado, a_estado, created_at').eq('organizacion_id', id).order('created_at', { ascending: false }).limit(200),
  ]);
  if (m.error) return errorDb('[organizaciones/membresias GET]', m.error, 'Error al obtener las membresías');
  if (b.error) return errorDb('[organizaciones/membresias GET]', b.error, 'Error al obtener la bitácora');
  return NextResponse.json({ membresias: m.data ?? [], bitacora: b.data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('organizacion:gestionar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Organización');
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarMembresiaAlta(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { data, error } = await s.admin.from('membresias_organizacion')
    .insert({ ...v.data, organizacion_id: id, alta_por: s.ctx.userId, ultimo_actor: s.ctx.userId })
    .select(COLUMNAS).single();
  if (error) return errorDb('[organizaciones/membresias POST]', error, 'Error al registrar la membresía');
  const m = data as { id: string };
  await registrarAccion(s, { accion: 'membresia_alta', recurso_tipo: 'membresia', recurso_id: m.id, resumen: 'Membresía dada de alta (pendiente de activación)', detalle: { organizacion_id: id } });
  return NextResponse.json({ membresia: m }, { status: 201 });
}
