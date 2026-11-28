// POST /api/recepcion/cajas/[id]/envio — envío o entrega de una caja CERRADA
// al laboratorio de destino: medio, guía, fecha y responsable.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { cargarCaja } from '@/lib/recepcion/cajaServidor';
import { puedeEnviarCaja } from '@/lib/recepcion/reglas';
import { respuestaRegla } from '@/lib/recepcion/servidor';
import { validarEnvio } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('envio:registrar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const c = await cargarCaja(s, id);
  if (c instanceof NextResponse) return c;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarEnvio(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const regla = puedeEnviarCaja(c.caja, c.sobres);
  if (!regla.ok) return respuestaRegla(regla.motivo);

  const { data, error } = await s.admin.rpc('registrar_envio_laboratorio', {
    p_caja: id, p_medio: v.data.medio, p_guia: v.data.guia, p_fecha: v.data.fecha_envio, p_actor: s.ctx.userId,
  });
  if (error) return errorDb('[recepcion/cajas/envio]', error, 'Error al registrar el envío');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string; envio_id?: string };
  if (!r.ok) return respuestaRegla(r.motivo ?? 'datos_invalidos');
  await registrarAccion(s, { accion: 'envio_laboratorio', recurso_tipo: 'caja', recurso_id: id, resumen: `Caja ${c.caja.codigo} enviada al laboratorio (${v.data.medio})` });
  return NextResponse.json({ ok: true, estado: 'enviada', envio_id: r.envio_id });
}
