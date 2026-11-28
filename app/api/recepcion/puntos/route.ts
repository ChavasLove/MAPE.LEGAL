// /api/recepcion/puntos — puntos de recepción (centro de acopio u oficina).
// GET  personal con `recepcion:ver`; `recepcion` solo ve los de su organización.
// POST admin: alta de un punto. La organización que lo opera es un dato
//      configurable; quién opera la recepción es [POR CONFIRMAR].

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, iniciarSesionRoles, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { puntosDelUsuario } from '@/lib/recepcion/servidor';
import { validarPunto } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await iniciarSesionPersonal('recepcion:ver');
  if (s instanceof NextResponse) return s;
  const ids = await puntosDelUsuario(s);
  if (ids instanceof NextResponse) return ids;
  if (ids !== null && ids.length === 0) return NextResponse.json({ puntos: [], rol: s.ctx.rol });
  let q = s.admin.from('puntos_recepcion').select('id, organizacion_id, tipo, nombre, activo').order('nombre');
  if (ids !== null) q = q.in('id', ids);
  const { data, error } = await q;
  if (error) return errorDb('[recepcion/puntos GET]', error, 'Error al obtener los puntos de recepción');
  return NextResponse.json({ puntos: data ?? [], rol: s.ctx.rol });
}

export async function POST(req: Request) {
  const s = await iniciarSesionRoles('admin');
  if (s instanceof NextResponse) return s;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarPunto(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { data, error } = await s.admin.from('puntos_recepcion').insert(v.data).select('id, organizacion_id, tipo, nombre, activo').single();
  if (error) return errorDb('[recepcion/puntos POST]', error, 'Error al crear el punto de recepción');
  const punto = data as { id: string; tipo: string };
  await registrarAccion(s, { accion: 'punto_recepcion_creado', recurso_tipo: 'punto_recepcion', recurso_id: punto.id, resumen: `Punto de recepción creado (${punto.tipo})` });
  return NextResponse.json({ punto }, { status: 201 });
}
