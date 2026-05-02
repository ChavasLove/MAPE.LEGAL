import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

// PATCH /api/admin/profesionales/[id] — update profile fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = ['nombre', 'iniciales', 'rol', 'especialidad', 'email', 'telefono', 'activo', 'usuario_id'];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('perfiles_profesionales')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar perfil';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/profesionales/[id] — soft-delete (set activo = false)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = getAdminClient();

    const { error } = await admin
      .from('perfiles_profesionales')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar perfil';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
