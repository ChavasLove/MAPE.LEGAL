import { NextResponse, type NextRequest } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['admin', 'abogado', 'tecnico_ambiental', 'cliente'] as const;
type ValidRole = (typeof VALID_ROLES)[number];

// Counts active admins excluding the target user, so we can refuse to demote /
// delete / deactivate the last remaining administrator. Returns true when the
// pending action would leave zero active admins.
async function wouldLeaveZeroActiveAdmins(
  admin: SupabaseClient,
  targetUserId: string
): Promise<boolean> {
  const { data: target, error: targetErr } = await admin
    .from('user_roles')
    .select('rol, activo')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetErr) throw targetErr;
  if (!target || target.rol !== 'admin' || !target.activo) return false;

  const { count, error: countErr } = await admin
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('rol', 'admin')
    .eq('activo', true)
    .neq('user_id', targetUserId);
  if (countErr) throw countErr;

  return (count ?? 0) === 0;
}

// PATCH /api/admin/usuarios/[id] — update role or active status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { rol, activo, perfil_id } = await req.json();

    // No self-modification of rol or activo. perfil_id is fine (assigning a
    // staff profile to yourself is harmless). This blocks session-hijack
    // downgrade attacks and stops an admin from accidentally locking
    // themselves out.
    if (id === auth.user.id && (rol !== undefined || activo !== undefined)) {
      return NextResponse.json(
        { error: 'No puedes modificar tu propio rol ni estado activo. Pídele a otro admin.' },
        { status: 400 }
      );
    }

    if (rol !== undefined && !VALID_ROLES.includes(rol as ValidRole)) {
      return NextResponse.json(
        { error: `Rol inválido. Permitidos: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Last-admin guard: refuse to demote or deactivate the only remaining
    // active admin.
    const willRemoveAdmin =
      (rol !== undefined && rol !== 'admin') || activo === false;
    if (willRemoveAdmin && (await wouldLeaveZeroActiveAdmins(admin, id))) {
      return NextResponse.json(
        { error: 'No puedes degradar al último administrador activo. Asigna otro admin primero.' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (rol !== undefined)       updates.rol       = rol;
    if (activo !== undefined)    updates.activo    = activo;
    if (perfil_id !== undefined) updates.perfil_id = perfil_id;

    const { error } = await admin
      .from('user_roles')
      .upsert({ user_id: id, ...updates }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/usuarios PATCH] failed:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
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

    if (await wouldLeaveZeroActiveAdmins(admin, id)) {
      return NextResponse.json(
        { error: 'No puedes eliminar al último administrador activo. Asigna otro admin primero.' },
        { status: 400 }
      );
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/usuarios DELETE] failed:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
