// /api/recepcion/partes — quién cumple cada papel del flujo (operador de
// recepción designado, parte compradora configurada, laboratorio de destino),
// por lote o por punto. Solo asigna una organización a un papel: sin montos,
// sin pagos, sin comprobantes. Nada está cableado en código.
// GET personal con `recepcion:ver` · POST admin.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, iniciarSesionRoles, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { validarParte } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, papel, organizacion_id, lote_id, punto_id, vigente, created_at';

export async function GET(req: Request) {
  const s = await iniciarSesionPersonal('recepcion:ver');
  if (s instanceof NextResponse) return s;
  const url = new URL(req.url);
  const punto = url.searchParams.get('punto_id');
  const lote = url.searchParams.get('lote_id');
  let q = s.admin.from('partes_flujo').select(COLUMNAS).eq('vigente', true).limit(500);
  if (punto) { if (!isUuid(punto)) return NextResponse.json({ error: 'punto_id inválido.' }, { status: 400 }); q = q.eq('punto_id', punto); }
  if (lote) { if (!isUuid(lote)) return NextResponse.json({ error: 'lote_id inválido.' }, { status: 400 }); q = q.eq('lote_id', lote); }
  const { data, error } = await q;
  if (error) return errorDb('[recepcion/partes GET]', error, 'Error al obtener las partes del flujo');
  return NextResponse.json({ partes: data ?? [] });
}

export async function POST(req: Request) {
  const s = await iniciarSesionRoles('admin');
  if (s instanceof NextResponse) return s;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarParte(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { data, error } = await s.admin.from('partes_flujo').insert({ ...v.data, asignado_por: s.ctx.userId }).select(COLUMNAS).single();
  if (error) return errorDb('[recepcion/partes POST]', error, 'Error al asignar la parte del flujo');
  const parte = data as { id: string; papel: string };
  await registrarAccion(s, { accion: 'parte_flujo_asignada', recurso_tipo: 'parte_flujo', recurso_id: parte.id, resumen: `Papel asignado: ${parte.papel}` });
  return NextResponse.json({ parte }, { status: 201 });
}
