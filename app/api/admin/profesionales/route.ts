import { NextResponse } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/profesionales — list all profiles
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('perfiles_profesionales')
      .select('*')
      .order('nombre');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/profesionales GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener perfiles' }, { status: 500 });
  }
}

// POST /api/admin/profesionales — create a new profile
export async function POST(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { nombre, iniciales, rol, especialidad, email, telefono } = body;

    if (!nombre || !iniciales || !rol) {
      return NextResponse.json(
        { error: 'nombre, iniciales y rol son obligatorios' },
        { status: 400 }
      );
    }

    const validRoles = ['abogado', 'tecnico_ambiental', 'admin'];
    if (!validRoles.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('perfiles_profesionales')
      .insert({ nombre, iniciales, rol, especialidad, email, telefono, activo: true })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un perfil con ese identificador.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[admin/profesionales POST] failed:', error);
    return NextResponse.json({ error: 'Error al crear perfil' }, { status: 500 });
  }
}
