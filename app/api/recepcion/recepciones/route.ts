// /api/recepcion/recepciones — registro de recepción por el operador de
// recepción designado. Lo carga el PERSONAL; el titular nunca.
//
// GET  personal con `recepcion:ver`, acotado por punto (`recepcion` solo los
//      puntos de su organización).
// POST personal con `recepcion:registrar` → asienta la llegada de material de
//      un lote. La base deriva el titular del lote, exige perfil aprobado y que
//      la mina sea del mismo titular, y emite el evento `recepcion`.
//
// No hay campos de monto, medio de pago ni comprobante: un body que los traiga
// se rechaza (lista cerrada en lib/recepcion/validacion.ts).

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { errorRecepcion, puntoAlcanzable, puntosDelUsuario, respuestaRegla, siguienteCodigo } from '@/lib/recepcion/servidor';
import { recepcionAdmisible } from '@/lib/recepcion/reglas';
import { validarRecepcion } from '@/lib/recepcion/validacion';
import type { EstadoPerfil } from '@/lib/perfiles/estados';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, codigo, punto_id, lote_id, titular_cliente_id, mina_id, modo_entrega, guia, fecha_llegada, receptor_user_id, estado_embalaje, observaciones, estado, created_at';

export async function GET() {
  const s = await iniciarSesionPersonal('recepcion:ver');
  if (s instanceof NextResponse) return s;
  const ids = await puntosDelUsuario(s);
  if (ids instanceof NextResponse) return ids;
  if (ids !== null && ids.length === 0) return NextResponse.json({ recepciones: [] });
  let q = s.admin.from('recepciones').select(COLUMNAS).order('fecha_llegada', { ascending: false }).limit(300);
  if (ids !== null) q = q.in('punto_id', ids);
  const { data, error } = await q;
  if (error) return errorDb('[recepcion/recepciones GET]', error, 'Error al obtener las recepciones');
  return NextResponse.json({ recepciones: data ?? [] });
}

export async function POST(req: Request) {
  const s = await iniciarSesionPersonal('recepcion:registrar');
  if (s instanceof NextResponse) return s;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarRecepcion(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.data;

  const punto = await puntoAlcanzable(s, d.punto_id);
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Punto de recepción');

  const [loteR, minaR] = await Promise.all([
    s.admin.from('lotes').select('id, cliente_id, estado').eq('id', d.lote_id).maybeSingle(),
    s.admin.from('minas').select('id, cliente_id').eq('id', d.mina_id).maybeSingle(),
  ]);
  if (loteR.error) return errorDb('[recepcion/recepciones POST]', loteR.error, 'Error al validar el lote');
  if (minaR.error) return errorDb('[recepcion/recepciones POST]', minaR.error, 'Error al validar la mina');
  const lote = loteR.data as { id: string; cliente_id: string; estado: string } | null;
  const mina = minaR.data as { id: string; cliente_id: string | null } | null;
  if (!lote) return NextResponse.json({ error: 'Lote no encontrado.' }, { status: 400 });
  if (!mina) return NextResponse.json({ error: 'Mina no encontrada.' }, { status: 400 });

  const perfilR = await s.admin.from('perfiles').select('estado').eq('cliente_id', lote.cliente_id).maybeSingle();
  if (perfilR.error) return errorDb('[recepcion/recepciones POST]', perfilR.error, 'Error al validar el perfil del titular');
  const regla = recepcionAdmisible({ perfil: perfilR.data as { estado: EstadoPerfil } | null, lote, mina, punto });
  if (!regla.ok) return respuestaRegla(regla.motivo);

  const codigo = await siguienteCodigo(s.admin, 'recepciones', 'REC');
  if (codigo instanceof NextResponse) return codigo;

  const { data, error } = await s.admin.from('recepciones')
    .insert({ ...d, codigo, receptor_user_id: s.ctx.userId })
    .select(COLUMNAS).single();
  if (error) return errorRecepcion('[recepcion/recepciones POST]', error, 'Error al registrar la recepción');
  const recepcion = data as { id: string; codigo: string };
  await registrarAccion(s, {
    accion: 'recepcion_registrada', recurso_tipo: 'recepcion', recurso_id: recepcion.id,
    resumen: `Recepción ${recepcion.codigo} registrada (${d.modo_entrega})`, detalle: { punto_id: d.punto_id, lote_id: d.lote_id },
  });
  return NextResponse.json({ recepcion }, { status: 201 });
}
