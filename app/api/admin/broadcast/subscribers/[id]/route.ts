import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['minero', 'comprador', 'tecnico', 'admin'] as const;

// PATCH  /api/admin/broadcast/subscribers/[id]   { rol?, activo?, suscrito?, nombre? }
// DELETE /api/admin/broadcast/subscribers/[id]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    rol?:      string;
    activo?:   boolean;
    suscrito?: boolean;
    nombre?:   string | null;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.rol !== undefined) {
    if (!(VALID_ROLES as readonly string[]).includes(body.rol)) {
      return NextResponse.json(
        { error: `rol inválido — use uno de: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }
    patch.rol = body.rol;
  }
  if (body.activo !== undefined) patch.activo = !!body.activo;
  if (body.suscrito !== undefined) patch.suscrito = !!body.suscrito;
  if (body.nombre !== undefined) patch.nombre = body.nombre;

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('usuarios_broadcast')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Suscriptor no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, subscriber: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin
    .from('usuarios_broadcast')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
