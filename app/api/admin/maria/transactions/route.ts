import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

// GET /api/admin/maria/transactions?estado=pendiente_confirmacion&limit=100
export async function GET(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100, 500);

  const admin = getAdminClient();
  let q = admin
    .from('transacciones_pendientes')
    .select('id, numero_whatsapp, estado, detalle, mensaje_original, respuesta_asistente, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) {
    console.error('[admin/maria/transactions GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener transacciones' }, { status: 500 });
  }

  return NextResponse.json({ transactions: data ?? [] });
}
