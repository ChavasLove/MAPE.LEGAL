// /api/recepcion/cajas — cajas (contenedores) para el envío al laboratorio.
// Una caja es de UN titular de origen y de un punto; su destino es una
// organización de tipo `laboratorio` (el nombre vive en datos, no en código).

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { errorRecepcion, puntoAlcanzable, puntosDelUsuario, siguienteCodigo } from '@/lib/recepcion/servidor';
import { validarCaja } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, codigo, punto_id, titular_cliente_id, laboratorio_org_id, precinto, estado, manifiesto_hash, cerrada_en, created_at';

export async function GET() {
  const s = await iniciarSesionPersonal('recepcion:ver');
  if (s instanceof NextResponse) return s;
  const ids = await puntosDelUsuario(s);
  if (ids instanceof NextResponse) return ids;
  if (ids !== null && ids.length === 0) return NextResponse.json({ cajas: [], laboratorios: [] });
  let q = s.admin.from('cajas').select(COLUMNAS).order('created_at', { ascending: false }).limit(300);
  if (ids !== null) q = q.in('punto_id', ids);
  const [cajas, labs] = await Promise.all([
    q,
    s.admin.from('organizaciones').select('id, nombre').eq('tipo', 'laboratorio').eq('activo', true).order('nombre'),
  ]);
  if (cajas.error) return errorDb('[recepcion/cajas GET]', cajas.error, 'Error al obtener las cajas');
  if (labs.error) return errorDb('[recepcion/cajas GET]', labs.error, 'Error al obtener los laboratorios');
  return NextResponse.json({ cajas: cajas.data ?? [], laboratorios: labs.data ?? [] });
}

export async function POST(req: Request) {
  const s = await iniciarSesionPersonal('recepcion:registrar');
  if (s instanceof NextResponse) return s;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarCaja(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const punto = await puntoAlcanzable(s, v.data.punto_id);
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Punto de recepción');
  const codigo = await siguienteCodigo(s.admin, 'cajas', 'CAJA');
  if (codigo instanceof NextResponse) return codigo;
  const { data, error } = await s.admin.from('cajas').insert({ ...v.data, codigo, creada_por: s.ctx.userId }).select(COLUMNAS).single();
  if (error) return errorRecepcion('[recepcion/cajas POST]', error, 'Error al crear la caja');
  const caja = data as { id: string; codigo: string };
  await registrarAccion(s, { accion: 'caja_creada', recurso_tipo: 'caja', recurso_id: caja.id, resumen: `Caja ${caja.codigo} abierta` });
  return NextResponse.json({ caja }, { status: 201 });
}
