import { NextResponse } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

// GET /api/admin/profesionales — list all profiles
export async function GET() {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('perfiles_profesionales')
      .select('*')
      .order('nombre');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al obtener perfiles';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/profesionales — create a new profile
export async function POST(req: Request) {
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

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear perfil';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
