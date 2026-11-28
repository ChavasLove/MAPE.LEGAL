// POST /api/recepcion/recepciones/[id]/sobres — prepara un sobre de la mina de
// la recepción. Puede traer ya el pesaje, la ley y la etiqueta; cada dato
// emite su evento encadenado (empaque_sobre, pesaje, analisis, etiquetado).

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { errorRecepcion, puntoAlcanzable, respuestaRegla } from '@/lib/recepcion/servidor';
import { sobreAdmisible } from '@/lib/recepcion/reglas';
import { validarSobre } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('recepcion:registrar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Recepción');
  const { data: recData, error: recErr } = await s.admin.from('recepciones').select('id, codigo, punto_id, mina_id, estado').eq('id', id).maybeSingle();
  if (recErr) return errorDb('[recepcion/sobres POST]', recErr, 'Error al obtener la recepción');
  const rec = recData as { id: string; codigo: string; punto_id: string; mina_id: string; estado: string } | null;
  if (!rec) return noEncontrado('Recepción');
  const punto = await puntoAlcanzable(s, rec.punto_id);
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Recepción');

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarSobre(body, { permitirCaja: false });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const regla = sobreAdmisible(rec);
  if (!regla.ok) return respuestaRegla(regla.motivo);

  const { data, error } = await s.admin.from('sobres')
    .insert({ ...v.data, recepcion_id: id, registrado_por: s.ctx.userId })
    .select('*').single();
  if (error) return errorRecepcion('[recepcion/sobres POST]', error, 'Error al registrar el sobre');
  const sobre = data as { id: string };
  await registrarAccion(s, { accion: 'sobre_registrado', recurso_tipo: 'sobre', recurso_id: sobre.id, resumen: `Sobre preparado en la recepción ${rec.codigo}` });
  return NextResponse.json({ sobre }, { status: 201 });
}
