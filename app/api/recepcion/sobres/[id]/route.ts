// PATCH /api/recepcion/sobres/[id] — pesaje, análisis, etiquetado y empaque de
// un sobre en una caja (o su retiro de una caja abierta). Cada cambio emite su
// evento. La caja debe ser del MISMO titular de origen: no se mezclan.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { errorRecepcion, puntoAlcanzable, respuestaRegla } from '@/lib/recepcion/servidor';
import { puedeEmpacar } from '@/lib/recepcion/reglas';
import { validarSobre } from '@/lib/recepcion/validacion';
import type { Caja, Sobre } from '@/lib/recepcion/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('recepcion:registrar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Sobre');

  const { data: sobreData, error: sobreErr } = await s.admin.from('sobres').select('*').eq('id', id).maybeSingle();
  if (sobreErr) return errorDb('[recepcion/sobres PATCH]', sobreErr, 'Error al obtener el sobre');
  const sobre = sobreData as Sobre | null;
  if (!sobre) return noEncontrado('Sobre');
  const { data: recData, error: recErr } = await s.admin.from('recepciones').select('punto_id').eq('id', sobre.recepcion_id).maybeSingle();
  if (recErr) return errorDb('[recepcion/sobres PATCH]', recErr, 'Error al obtener la recepción');
  const punto = recData ? await puntoAlcanzable(s, (recData as { punto_id: string }).punto_id) : null;
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Sobre');

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarSobre(body, { permitirCaja: true });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (Object.keys(v.data).length === 0) return NextResponse.json({ error: 'No hay cambios.' }, { status: 400 });

  if (v.data.caja_id) {
    const { data: cajaData, error: cajaErr } = await s.admin.from('cajas').select('id, titular_cliente_id, estado').eq('id', v.data.caja_id).maybeSingle();
    if (cajaErr) return errorDb('[recepcion/sobres PATCH]', cajaErr, 'Error al obtener la caja');
    const caja = cajaData as Pick<Caja, 'id' | 'titular_cliente_id' | 'estado'> | null;
    if (!caja) return NextResponse.json({ error: 'Caja no encontrada.' }, { status: 400 });
    // El sobre se evalúa ya con los datos que trae este mismo cambio.
    const regla = puedeEmpacar({ ...sobre, ...v.data, caja_id: sobre.caja_id }, caja);
    if (!regla.ok) return respuestaRegla(regla.motivo);
  }

  const { data, error } = await s.admin.from('sobres').update({ ...v.data, actualizado_por: s.ctx.userId }).eq('id', id).select('*').single();
  if (error) return errorRecepcion('[recepcion/sobres PATCH]', error, 'Error al actualizar el sobre');
  await registrarAccion(s, {
    accion: 'sobre_actualizado', recurso_tipo: 'sobre', recurso_id: id,
    resumen: `Sobre actualizado: ${Object.keys(v.data).join(', ')}`,
  });
  return NextResponse.json({ sobre: data });
}
