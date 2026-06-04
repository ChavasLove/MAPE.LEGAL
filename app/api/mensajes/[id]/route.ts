import { NextResponse } from 'next/server';
import { updateMensajeEstado } from '@/services/dashboardService';
import { requireRole } from '@/lib/serverAuth';

const ESTADOS_VALIDOS = ['listo', 'procesando', 'ilegible', 'verificado', 'rechazado'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // proxy.ts only checks cookie presence; re-validate the JWT + role here so an
  // expired/forged cookie can't mutate message state.
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

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
    console.error('[mensajes] PATCH failed:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el mensaje' }, { status: 500 });
  }
}
