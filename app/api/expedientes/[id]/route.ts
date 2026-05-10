import { NextResponse } from 'next/server';
import { getDashExpedienteById } from '@/services/dashboardService';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const exp = await getDashExpedienteById(id);
    if (!exp) {
      return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });
    }
    return NextResponse.json(exp);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch expediente';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
