// /api/cadena/fuentes — fuentes registradas por un comercializador (minero +
// mina + permiso municipal + área INHGEOMIN + mercurio cero + CLPI). La
// elegibilidad se evalúa en JS con evaluarElegibilidadFuente() (misma regla que
// el trigger de `lotes` en la 043) y viaja en cada fila como `elegibilidad`.
//
// GET  staff | auditor → todas; comercializador → las de su organización.
//      ?cliente_id= filtra por minero.
// POST comercializador (su organización) | admin (debe mandar organizacion_id).

import { NextResponse } from 'next/server';
import { iniciarSesionCadena, leerJson, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { veTodo } from '@/lib/cadena/acceso';
import { evaluarElegibilidadFuente } from '@/lib/cadena/reglas';
import type { FuenteComercializador } from '@/lib/cadena/types';
import { isUuid, parseLimit, validarBodyFuente } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function conElegibilidad(f: FuenteComercializador) {
  return { ...f, elegibilidad: evaluarElegibilidadFuente(f) };
}

export async function GET(req: Request) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'auditor', 'comercializador');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const url = new URL(req.url);
  const clienteId = url.searchParams.get('cliente_id');
  if (clienteId !== null && !isUuid(clienteId)) {
    return NextResponse.json({ error: 'cliente_id inválido (uuid).' }, { status: 400 });
  }
  const limit = parseLimit(url.searchParams.get('limit'), 200, 1000);

  let query = admin.from('fuentes_comercializador').select('*').order('created_at', { ascending: false }).limit(limit);
  if (!veTodo(ctx.rol)) {
    if (!ctx.organizacionId) return NextResponse.json({ fuentes: [] });
    query = query.eq('organizacion_id', ctx.organizacionId);
  }
  if (clienteId) query = query.eq('cliente_id', clienteId);

  const { data, error } = await query;
  if (error) return respuestaErrorDb('[cadena/fuentes GET]', error, { generico: 'Error al obtener fuentes' });

  const fuentes = ((data ?? []) as FuenteComercializador[]).map(conElegibilidad);
  registrarAcceso({ ctx, accion: 'lectura', recurso_tipo: 'fuentes', detalle: { total: fuentes.length, cliente_id: clienteId } });
  return NextResponse.json({ fuentes });
}

export async function POST(req: Request) {
  const s = await iniciarSesionCadena('admin', 'comercializador');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const body = await leerJson(req);
  if (body instanceof NextResponse) return body;
  const v = validarBodyFuente(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.data;

  // La organización siempre se fija server-side: el comercializador registra
  // para la suya (ignora cualquier organizacion_id del body); admin la elige.
  let organizacionId: string;
  if (ctx.rol === 'comercializador') {
    if (!ctx.organizacionId) {
      return NextResponse.json({ error: 'El usuario no tiene organización vinculada.' }, { status: 403 });
    }
    organizacionId = ctx.organizacionId;
  } else {
    if (!d.organizacion_id) return NextResponse.json({ error: 'organizacion_id es obligatorio para admin.' }, { status: 400 });
    organizacionId = d.organizacion_id;
  }

  // Pre-checks de referencias (400 claro en vez de 23503 opaco).
  const [orgRes, cliRes] = await Promise.all([
    admin.from('organizaciones').select('id, tipo, activo').eq('id', organizacionId).maybeSingle(),
    admin.from('clientes').select('id').eq('id', d.cliente_id).maybeSingle(),
  ]);
  if (orgRes.error) return respuestaErrorDb('[cadena/fuentes POST]', orgRes.error, { generico: 'Error al validar la organización' });
  if (cliRes.error) return respuestaErrorDb('[cadena/fuentes POST]', cliRes.error, { generico: 'Error al validar el cliente' });
  const org = orgRes.data as { id: string; tipo: string; activo: boolean } | null;
  if (!org || !org.activo) return NextResponse.json({ error: 'Organización no encontrada o inactiva.' }, { status: 400 });
  if (org.tipo !== 'comercializador') return NextResponse.json({ error: 'La organización no es un comercializador.' }, { status: 400 });
  if (!cliRes.data) return NextResponse.json({ error: 'Cliente (minero) no encontrado.' }, { status: 400 });

  const fila = {
    organizacion_id: organizacionId,
    cliente_id: d.cliente_id,
    mina_id: d.mina_id,
    permiso_municipal_numero: d.permiso_municipal_numero,
    permiso_vigente_hasta: d.permiso_vigente_hasta,
    dentro_area_inhgeomin: d.dentro_area_inhgeomin,
    declaracion_mercurio_cero: d.declaracion_mercurio_cero,
    clpi_estado: d.clpi_estado,
    documentos: d.documentos,
    registrado_por: ctx.userId,
  };

  const { data, error } = await admin.from('fuentes_comercializador').insert(fila).select('*').single();
  if (error) {
    return respuestaErrorDb('[cadena/fuentes POST]', error, {
      conflicto: 'Ya existe una fuente registrada para ese minero y mina en la organización.',
      generico: 'Error al registrar la fuente',
    });
  }
  const fuente = data as FuenteComercializador;
  return NextResponse.json({ fuente, elegibilidad: evaluarElegibilidadFuente(fuente) }, { status: 201 });
}
