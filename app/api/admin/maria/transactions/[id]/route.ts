import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

const VALID_ESTADOS = ['pendiente_confirmacion', 'confirmada', 'cancelada'] as const;

// PATCH /api/admin/maria/transactions/[id]   { estado: 'confirmada' | 'cancelada' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { estado?: string };
  const estado = body.estado;

  if (!estado || !(VALID_ESTADOS as readonly string[]).includes(estado)) {
    return NextResponse.json(
      { error: `estado inválido — use uno de: ${VALID_ESTADOS.join(', ')}` },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('transacciones_pendientes')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[admin/maria/transactions PATCH] failed:', error);
    return NextResponse.json({ error: 'Error al actualizar la transacción' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true, transaction: data });
}
