import { NextResponse } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('roles')
      .select('*')
      .order('es_sistema', { ascending: false })
      .order('nombre');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('[admin/roles GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { nombre, descripcion, permisos } = await req.json();
    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('roles')
      .insert({ nombre, descripcion, permisos: permisos ?? [], es_sistema: false, activo: true })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un rol con ese nombre.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[admin/roles POST] failed:', error);
    return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 });
  }
}
