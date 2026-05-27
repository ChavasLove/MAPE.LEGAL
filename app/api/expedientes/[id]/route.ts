import { NextResponse } from 'next/server';
import { getDashExpedienteById } from '@/services/dashboardService';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const exp = await getDashExpedienteById(id);
    if (!exp) {
      return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });
    }
    return NextResponse.json(exp);
  } catch (error) {
    console.error('[expedientes/[id] GET] failed:', error);
    return NextResponse.json({ error: 'Error al cargar expediente' }, { status: 500 });
  }
}
