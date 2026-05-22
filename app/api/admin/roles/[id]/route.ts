import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

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
      .maybeSingle();

    if (error) {
      // PostgreSQL unique violation on roles.nombre → 409
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe un rol con ese nombre.' },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Rol no encontrado o protegido del sistema.' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/roles PATCH] failed:', error);
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const admin = getAdminClient();

    // Look up the role first so we can (a) return 404 cleanly and (b) check
    // if any users have it assigned. user_roles.rol is a text field that
    // matches roles.nombre (no FK; see migrations 005 + 006).
    const { data: roleRow, error: lookupErr } = await admin
      .from('roles')
      .select('nombre, es_sistema')
      .eq('id', id)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!roleRow) {
      return NextResponse.json({ error: 'Rol no encontrado.' }, { status: 404 });
    }
    if (roleRow.es_sistema) {
      return NextResponse.json(
        { error: 'No se pueden eliminar roles del sistema.' },
        { status: 400 }
      );
    }

    // Defensive guard: even though user_roles.rol has a CHECK constraint
    // restricting it to the 4 system roles today, a future schema change
    // could relax that. Block delete if any user holds this role.
    const { count, error: countErr } = await admin
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('rol', roleRow.nombre);
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `No puedes eliminar este rol: ${count} usuario(s) lo tienen asignado.` },
        { status: 409 }
      );
    }

    const { error } = await admin
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('es_sistema', false);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/roles DELETE] failed:', error);
    return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 });
  }
}
