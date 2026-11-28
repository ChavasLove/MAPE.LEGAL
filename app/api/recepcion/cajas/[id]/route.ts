// GET /api/recepcion/cajas/[id] — caja con sus sobres, manifiesto (y su
// verificación de integridad), envío y recepción en laboratorio.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal } from '@/lib/acceso/sesionPersonal';
import { cargarCaja } from '@/lib/recepcion/cajaServidor';
import { verificarManifiesto } from '@/lib/recepcion/manifiesto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('recepcion:ver');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const c = await cargarCaja(s, id);
  if (c instanceof NextResponse) return c;
  const [envio, lab, laboratorio] = await Promise.all([
    s.admin.from('envios_laboratorio').select('id, medio, guia, fecha_envio, responsable_user_id').eq('caja_id', id).maybeSingle(),
    s.admin.from('recepciones_laboratorio').select('id, fecha_recepcion, precinto_integro, pesos, conciliacion, estado_conciliacion').eq('caja_id', id).maybeSingle(),
    s.admin.from('organizaciones').select('id, nombre').eq('id', c.caja.laboratorio_org_id).maybeSingle(),
  ]);
  if (envio.error) return errorDb('[recepcion/cajas/id GET]', envio.error, 'Error al obtener el envío');
  if (lab.error) return errorDb('[recepcion/cajas/id GET]', lab.error, 'Error al obtener la recepción en laboratorio');
  return NextResponse.json({
    caja: c.caja,
    sobres: c.sobres,
    manifiesto_integro: c.caja.manifiesto_hash ? verificarManifiesto(c.caja.manifiesto_canonico, c.caja.manifiesto_hash) : null,
    envio: envio.data ?? null,
    recepcion_laboratorio: lab.data ?? null,
    laboratorio: laboratorio.data ?? null,
    rol: s.ctx.rol,
  });
}
