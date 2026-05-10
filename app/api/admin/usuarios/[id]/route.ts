import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

// PATCH /api/admin/usuarios/[id] — update role or active status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { rol, activo, perfil_id } = await req.json();

    // Block self-demotion: an admin cannot revoke or deactivate their own
    // role from the API. This protects against an accidental "last admin"
    // lockout and against a session hijacker downgrading the real user
    // to lock them out of recovery.
    if (id === auth.user.id && (rol !== undefined && rol !== 'admin' || activo === false)) {
      return NextResponse.json(
        { error: 'No puedes modificar tu propio rol o estado.' },
        { status: 400 }
      );
    }

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
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta.' },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
