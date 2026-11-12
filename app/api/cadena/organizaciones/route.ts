// /api/cadena/organizaciones — organizaciones participantes del estándar
// privado (comercializadores, plantas de beneficio, auditores). En código no se
// nombra a ninguna empresa: son filas de `organizaciones` (migración 043).
//
// GET  admin | abogado | tecnico_ambiental | auditor → todas.
//      comercializador | planta → solo la propia (para que la UI muestre su
//      nombre sin otro endpoint).
// POST admin → { tipo, nombre, rtn? }.

import { NextResponse } from 'next/server';
import { iniciarSesionCadena, leerJson, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { veTodo } from '@/lib/cadena/acceso';
import { validarBodyOrganizacion } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, tipo, nombre, rtn, activo, created_at';

export async function GET() {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'auditor', 'comercializador', 'planta');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  let query = admin.from('organizaciones').select(COLUMNAS).order('nombre', { ascending: true });
  if (!veTodo(ctx.rol)) {
    if (!ctx.organizacionId) return NextResponse.json({ organizaciones: [] });
    query = query.eq('id', ctx.organizacionId);
  }

  const { data, error } = await query;
  if (error) return respuestaErrorDb('[cadena/organizaciones GET]', error, { generico: 'Error al obtener organizaciones' });

  registrarAcceso({ ctx, accion: 'lectura', recurso_tipo: 'organizaciones', detalle: { total: data?.length ?? 0 } });
  return NextResponse.json({ organizaciones: data ?? [] });
}

export async function POST(req: Request) {
  const s = await iniciarSesionCadena('admin');
  if (s instanceof NextResponse) return s;
  const { admin } = s;

  const body = await leerJson(req);
  if (body instanceof NextResponse) return body;
  const v = validarBodyOrganizacion(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const { data, error } = await admin
    .from('organizaciones')
    .insert({ tipo: v.data.tipo, nombre: v.data.nombre, rtn: v.data.rtn, activo: true })
    .select(COLUMNAS)
    .single();
  if (error) {
    return respuestaErrorDb('[cadena/organizaciones POST]', error, {
      conflicto: 'Ya existe una organización con ese nombre o RTN.',
      generico: 'Error al crear la organización',
    });
  }
  return NextResponse.json({ organizacion: data }, { status: 201 });
}
