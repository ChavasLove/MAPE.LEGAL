// POST /api/recepcion/recepciones/[id]/anular — anula una recepción. Nada se
// borra: la recepción y sus sobres quedan marcados y la cadena recibe un
// evento de corrección con el motivo.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { puntoAlcanzable, respuestaRegla } from '@/lib/recepcion/servidor';
import { validarAnulacion } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('recepcion:anular');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Recepción');
  const { data: recData, error: recErr } = await s.admin.from('recepciones').select('id, codigo, punto_id').eq('id', id).maybeSingle();
  if (recErr) return errorDb('[recepcion/anular]', recErr, 'Error al obtener la recepción');
  const rec = recData as { id: string; codigo: string; punto_id: string } | null;
  if (!rec) return noEncontrado('Recepción');
  const punto = await puntoAlcanzable(s, rec.punto_id);
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Recepción');

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarAnulacion(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const { data, error } = await s.admin.rpc('anular_recepcion', { p_recepcion: id, p_motivo: v.data.motivo, p_actor: s.ctx.userId });
  if (error) return errorDb('[recepcion/anular]', error, 'Error al anular la recepción');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string };
  if (!r.ok) return respuestaRegla(r.motivo ?? 'datos_invalidos');
  await registrarAccion(s, { accion: 'recepcion_anulada', recurso_tipo: 'recepcion', recurso_id: id, resumen: `Recepción ${rec.codigo} anulada (evento de corrección)` });
  return NextResponse.json({ ok: true, estado: 'anulada' });
}
