import { NextResponse } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

export async function GET() {
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
    const msg = error instanceof Error ? error.message : 'Error al obtener roles';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear rol';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
