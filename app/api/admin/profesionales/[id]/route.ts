import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['abogado', 'tecnico_ambiental', 'admin'] as const;

// PATCH /api/admin/profesionales/[id] — update profile fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = ['nombre', 'iniciales', 'rol', 'especialidad', 'email', 'telefono', 'activo', 'usuario_id'];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (updates.rol !== undefined && !(VALID_ROLES as readonly string[]).includes(updates.rol as string)) {
      return NextResponse.json(
        { error: `Rol inválido — use uno de: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Validate usuario_id (if set) actually exists. PATCH used to write any
    // UUID to the FK column without verifying it; an unknown UUID would
    // either FK-fail at the DB or silently persist (if the column is nullable
    // with no constraint).
    if (typeof updates.usuario_id === 'string' && updates.usuario_id.length > 0) {
      const { data: user, error: userErr } = await admin.auth.admin.getUserById(updates.usuario_id);
      if (userErr || !user?.user) {
        return NextResponse.json({ error: 'usuario_id no encontrado.' }, { status: 400 });
      }
    }

    const { data, error } = await admin
      .from('perfiles_profesionales')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Conflicto de unicidad.' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/profesionales PATCH] failed:', error);
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
  }
}

// DELETE /api/admin/profesionales/[id] — soft-delete (set activo = false)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

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
    console.error('[admin/profesionales DELETE] failed:', error);
    return NextResponse.json({ error: 'Error al eliminar perfil' }, { status: 500 });
  }
}
