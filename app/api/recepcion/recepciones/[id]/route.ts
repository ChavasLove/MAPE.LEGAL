// GET /api/recepcion/recepciones/[id] — recepción con sus sobres. Personal con
// `recepcion:ver` que alcance el punto; en otro caso 404 (sin enumeración).

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, noEncontrado } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { puntoAlcanzable } from '@/lib/recepcion/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('recepcion:ver');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Recepción');
  const { data, error } = await s.admin.from('recepciones').select('*').eq('id', id).maybeSingle();
  if (error) return errorDb('[recepcion/recepciones/id GET]', error, 'Error al obtener la recepción');
  const rec = data as { id: string; punto_id: string } | null;
  if (!rec) return noEncontrado('Recepción');
  const punto = await puntoAlcanzable(s, rec.punto_id);
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Recepción');
  const sobres = await s.admin.from('sobres').select('*').eq('recepcion_id', id).order('created_at');
  if (sobres.error) return errorDb('[recepcion/recepciones/id GET]', sobres.error, 'Error al obtener los sobres');
  return NextResponse.json({ recepcion: rec, punto, sobres: sobres.data ?? [], rol: s.ctx.rol });
}
