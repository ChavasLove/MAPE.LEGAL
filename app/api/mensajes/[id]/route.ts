import { NextResponse } from 'next/server';
import { updateMensajeEstado } from '@/services/dashboardService';

const ESTADOS_VALIDOS = ['listo', 'procesando', 'ilegible', 'verificado', 'rechazado'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.estado || !ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json(
        { error: `estado must be one of: ${ESTADOS_VALIDOS.join(', ')}` },
        { status: 400 }
      );
    }

    await updateMensajeEstado(id, body.estado);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update mensaje';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
