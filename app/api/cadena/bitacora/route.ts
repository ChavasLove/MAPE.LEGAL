// /api/cadena/bitacora — lectura de la bitácora de accesos del estándar.
//
// GET admin | auditor → { accesos } (más reciente primero, cap 500).
//     ?limit= (default 100, máx 500) · ?recurso_tipo= · ?accion=lectura|exportacion
//     · ?user_id= · ?organizacion_id=
// La propia consulta queda registrada (recurso_tipo 'bitacora'): quien audita
// también deja huella.

import { NextResponse } from 'next/server';
import { iniciarSesionCadena, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { ACCIONES_BITACORA, type BitacoraAcceso } from '@/lib/cadena/types';
import { isUuid, parseLimit } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RECURSO_TIPO_RE = /^[a-z_]{1,40}$/;

export async function GET(req: Request) {
  const s = await iniciarSesionCadena('admin', 'auditor');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get('limit'), 100, 500);
  const recursoTipo = url.searchParams.get('recurso_tipo');
  const accion = url.searchParams.get('accion');
  const userId = url.searchParams.get('user_id');
  const orgId = url.searchParams.get('organizacion_id');

  if (recursoTipo !== null && !RECURSO_TIPO_RE.test(recursoTipo)) {
    return NextResponse.json({ error: 'recurso_tipo inválido.' }, { status: 400 });
  }
  if (accion !== null && !(ACCIONES_BITACORA as ReadonlyArray<string>).includes(accion)) {
    return NextResponse.json({ error: `accion inválida. Permitidas: ${ACCIONES_BITACORA.join(', ')}` }, { status: 400 });
  }
  if (userId !== null && !isUuid(userId)) return NextResponse.json({ error: 'user_id inválido (uuid).' }, { status: 400 });
  if (orgId !== null && !isUuid(orgId)) return NextResponse.json({ error: 'organizacion_id inválido (uuid).' }, { status: 400 });

  let query = admin.from('bitacora_accesos').select('*').order('created_at', { ascending: false }).limit(limit);
  if (recursoTipo) query = query.eq('recurso_tipo', recursoTipo);
  if (accion) query = query.eq('accion', accion);
  if (userId) query = query.eq('user_id', userId);
  if (orgId) query = query.eq('organizacion_id', orgId);

  const { data, error } = await query;
  if (error) return respuestaErrorDb('[cadena/bitacora GET]', error, { generico: 'Error al obtener la bitácora' });

  const accesos = (data ?? []) as BitacoraAcceso[];
  registrarAcceso({
    ctx, accion: 'lectura', recurso_tipo: 'bitacora',
    detalle: { total: accesos.length, filtros: { recurso_tipo: recursoTipo, accion, user_id: userId, organizacion_id: orgId } },
  });
  return NextResponse.json({ accesos });
}
