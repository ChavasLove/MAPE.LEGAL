import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

// PATCH /api/admin/usuarios/[id] — update role or active status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rol, activo, perfil_id } = await req.json();

    const admin = getAdminClient();

    const updates: Record<string, unknown> = {};
    if (rol !== undefined)      updates.rol      = rol;
    if (activo !== undefined)   updates.activo   = activo;
    if (perfil_id !== undefined) updates.perfil_id = perfil_id;

    const { error } = await admin
      .from('user_roles')
      .upsert({ user_id: id, ...updates }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/usuarios/[id] — permanently delete a Supabase Auth user
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = getAdminClient();

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
