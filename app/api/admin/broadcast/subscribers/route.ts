import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { normalizePhone } from '@/lib/maria/normalizePhone';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['minero', 'comprador', 'tecnico', 'admin'] as const;
type BroadcastRol = typeof VALID_ROLES[number];

// GET  /api/admin/broadcast/subscribers
// POST /api/admin/broadcast/subscribers  { telefono, rol?, nombre? }
//
// Reads + creates rows in usuarios_broadcast (the audience for the daily
// broadcast). Per-row updates/deletes live on the [id] route.

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('usuarios_broadcast')
    .select('id, telefono, nombre, rol, activo, suscrito, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscribers: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({})) as {
    telefono?: string;
    nombre?:   string;
    rol?:      string;
  };

  const telefono = normalizePhone(body.telefono ?? '');
  if (!telefono) {
    return NextResponse.json({ error: 'telefono requerido' }, { status: 400 });
  }

  const rol = (body.rol ?? 'minero') as BroadcastRol;
  if (!(VALID_ROLES as readonly string[]).includes(rol)) {
    return NextResponse.json(
      { error: `rol inválido — use uno de: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('usuarios_broadcast')
    .upsert(
      { telefono, nombre: body.nombre ?? null, rol, activo: true, suscrito: true },
      { onConflict: 'telefono' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, subscriber: data }, { status: 201 });
}
