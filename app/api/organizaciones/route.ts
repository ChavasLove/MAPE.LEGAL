// GET /api/organizaciones — organizaciones (una sola entidad, con `tipo`).
// Personal con `perfil:ver`. El alta de una organización sigue en
// POST /api/cadena/organizaciones (admin), que ya admite los tipos nuevos.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal } from '@/lib/acceso/sesionPersonal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await iniciarSesionPersonal('perfil:ver');
  if (s instanceof NextResponse) return s;
  const { data, error } = await s.admin.from('organizaciones').select('id, tipo, nombre, activo').order('nombre').limit(1000);
  if (error) return errorDb('[organizaciones GET]', error, 'Error al obtener las organizaciones');
  return NextResponse.json({ organizaciones: data ?? [], rol: s.ctx.rol, usuario: s.ctx.userId });
}
