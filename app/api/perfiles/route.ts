// /api/perfiles — perfiles de mineros/productores y organizaciones.
//
// GET  personal con `perfil:ver` → lista (filtro ?estado=). Es la cola de
//      aprobaciones cuando estado=pendiente.
// POST personal con `perfil:crear` → alta. NACE pendiente (o borrador): el
//      estado del body nunca produce un perfil aprobado.
//
// Los usuarios externos (cliente, comercializador, planta, auditor) no entran:
// su lectura va por /api/portal/expediente.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { ESTADOS_PERFIL } from '@/lib/perfiles/estados';
import { validarPerfilCrear } from '@/lib/perfiles/validacion';
import { avisarPerfilesPendientes } from '@/lib/perfiles/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, tipo, cliente_id, organizacion_id, estado, version, contenido_hash, creado_por, editado_por, created_at, updated_at';

export async function GET(req: Request) {
  const s = await iniciarSesionPersonal('perfil:ver');
  if (s instanceof NextResponse) return s;
  const estado = new URL(req.url).searchParams.get('estado');
  if (estado !== null && !(ESTADOS_PERFIL as ReadonlyArray<string>).includes(estado)) {
    return NextResponse.json({ error: `estado inválido. Permitidos: ${ESTADOS_PERFIL.join(', ')}` }, { status: 400 });
  }
  let q = s.admin.from('perfiles').select(COLUMNAS).order('updated_at', { ascending: true }).limit(500);
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) return errorDb('[perfiles GET]', error, 'Error al obtener los perfiles');
  return NextResponse.json({ perfiles: data ?? [], usuario: s.ctx.userId, rol: s.ctx.rol });
}

export async function POST(req: Request) {
  const s = await iniciarSesionPersonal('perfil:crear');
  if (s instanceof NextResponse) return s;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarPerfilCrear(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const { data, error } = await s.admin.from('perfiles')
    .insert({ ...v.data, creado_por: s.ctx.userId })
    .select(COLUMNAS)
    .single();
  if (error) return errorDb('[perfiles POST]', error, 'Error al crear el perfil');

  const perfil = data as { id: string; estado: string; tipo: string };
  await registrarAccion(s, {
    accion: 'perfil_creado', recurso_tipo: 'perfil', recurso_id: perfil.id,
    resumen: `Perfil de ${perfil.tipo} creado en estado ${perfil.estado}`,
  });
  if (perfil.estado === 'pendiente') avisarPerfilesPendientes(s.admin);
  return NextResponse.json({ perfil }, { status: 201 });
}
