import { NextResponse } from 'next/server';
import { updateDocumentoEstado } from '@/services/dashboardService';
import { getAdminClient } from '@/services/adminSupabase';
import { notifyDocumentVerified, notifyDocumentRejected } from '@/modules/notifications';
import { logAction } from '@/modules/expedientes';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const ESTADOS_VALIDOS = ['faltante', 'pendiente', 'verificado', 'rechazado'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Look up the document before mutation so we can log + notify with context
    const admin = getAdminClient();
    const { data: doc } = await admin
      .from('documentos')
      .select('expediente_id, nombre, estado')
      .eq('id', id)
      .single<{ expediente_id: string | null; nombre: string; estado: string }>();

    await updateDocumentoEstado(id, body.estado, body.info);

    // Audit + notify only when the estado actually changed
    if (doc && doc.estado !== body.estado && doc.expediente_id) {
      const accion = body.estado === 'verificado'
        ? 'DOCUMENTO_VERIFICADO'
        : body.estado === 'rechazado'
          ? 'DOCUMENTO_RECHAZADO'
          : null;

      if (accion) {
        logAction(doc.expediente_id, accion, {
          documento_id: id,
          documento_nombre: doc.nombre,
          estado_anterior: doc.estado,
          estado_nuevo: body.estado,
          info: body.info,
        }).catch(err => console.error('[documentos] audit log failed:', err));

        if (body.estado === 'verificado') {
          notifyDocumentVerified(doc.expediente_id, doc.nombre)
            .catch(() => { /* logged inside */ });
        } else {
          notifyDocumentRejected(doc.expediente_id, doc.nombre, body.info)
            .catch(() => { /* logged inside */ });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[documentos/[id] PATCH] failed:', error);
    return NextResponse.json({ error: 'Error al actualizar documento' }, { status: 500 });
  }
}
