// POST /api/recepcion/cajas/[id]/laboratorio — recepción de la caja en el
// laboratorio y conciliación de pesos por sobre contra el manifiesto.
// El umbral es `umbral_conciliacion_peso_pct`, SIN valor por defecto: mientras
// no esté configurado, nada se da por conciliado y queda la alerta
// `umbral_no_configurado`.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { cargarCaja } from '@/lib/recepcion/cajaServidor';
import { puedeRecibirEnLaboratorio } from '@/lib/recepcion/reglas';
import { respuestaRegla } from '@/lib/recepcion/servidor';
import { validarRecepcionLaboratorio } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('laboratorio:recibir');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const c = await cargarCaja(s, id);
  if (c instanceof NextResponse) return c;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarRecepcionLaboratorio(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const regla = puedeRecibirEnLaboratorio(c.caja);
  if (!regla.ok) return respuestaRegla(regla.motivo);
  const propios = new Set(c.sobres.map((x) => x.id));
  if (v.data.pesos.some((p) => !propios.has(p.sobre_id))) {
    return NextResponse.json({ error: 'Hay pesos de sobres que no pertenecen a esta caja.' }, { status: 400 });
  }

  const { data, error } = await s.admin.rpc('registrar_recepcion_laboratorio', {
    p_caja: id, p_fecha: v.data.fecha_recepcion, p_precinto_integro: v.data.precinto_integro, p_pesos: v.data.pesos, p_actor: s.ctx.userId,
  });
  if (error) return errorDb('[recepcion/cajas/laboratorio]', error, 'Error al registrar la recepción en laboratorio');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string; estado_conciliacion?: string; conciliada?: boolean };
  if (!r.ok) return respuestaRegla(r.motivo ?? 'datos_invalidos');
  await registrarAccion(s, {
    accion: 'recepcion_laboratorio', recurso_tipo: 'caja', recurso_id: id,
    resumen: `Caja ${c.caja.codigo} recibida en laboratorio: ${r.estado_conciliacion}`,
  });
  return NextResponse.json(r);
}
