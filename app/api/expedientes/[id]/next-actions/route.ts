import { NextResponse } from 'next/server';
import { getNextActions } from '@/modules/workflow';
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
    const result = await getNextActions(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[expedientes/[id]/next-actions GET] failed:', error);
    return NextResponse.json({ error: 'Error al evaluar siguientes acciones' }, { status: 400 });
  }
}
