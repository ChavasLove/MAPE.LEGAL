import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const admin = getAdminClient();

    const allowed = ['nombre', 'descripcion', 'permisos', 'activo'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await admin
      .from('roles')
      .update(updates)
      .eq('id', id)
      .eq('es_sistema', false)  // protect system roles
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar rol';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = getAdminClient();

    const { error } = await admin
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('es_sistema', false);  // protect system roles

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar rol';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
