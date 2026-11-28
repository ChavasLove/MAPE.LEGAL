// POST /api/recepcion/cajas/[id]/cerrar — cierra la caja con su manifiesto.
// El manifiesto se genera en el servidor de forma determinista a partir del
// contenido real de la caja (JSON canónico + SHA-256); la base lo vuelve a
// verificar. No se cierra una caja vacía, sin precinto, con sobres sin pesar o
// sin etiquetar, ni con sobres de más de un titular de origen.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { cargarCaja } from '@/lib/recepcion/cajaServidor';
import { construirManifiesto } from '@/lib/recepcion/manifiesto';
import { respuestaRegla } from '@/lib/recepcion/servidor';
import { validarCierre } from '@/lib/recepcion/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('caja:cerrar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const c = await cargarCaja(s, id);
  if (c instanceof NextResponse) return c;
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarCierre(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (c.caja.estado !== 'abierta') return respuestaRegla('caja_no_abierta');

  const m = construirManifiesto({ ...c.caja, precinto: v.data.precinto }, c.sobres);
  if (!m.ok) return respuestaRegla(m.motivo, 409, { sobres: m.sobres ?? [] });

  const { data, error } = await s.admin.rpc('cerrar_caja', {
    p_caja: id, p_precinto: v.data.precinto, p_manifiesto_canonico: m.canonico, p_manifiesto_hash: m.hash, p_actor: s.ctx.userId,
  });
  if (error) return errorDb('[recepcion/cajas/cerrar]', error, 'Error al cerrar la caja');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string };
  if (!r.ok) return respuestaRegla(r.motivo ?? 'datos_invalidos');
  await registrarAccion(s, {
    accion: 'caja_cerrada', recurso_tipo: 'caja', recurso_id: id,
    resumen: `Caja ${c.caja.codigo} cerrada con manifiesto (${m.manifiesto.total_sobres} sobres)`, detalle: { manifiesto_hash: m.hash },
  });
  return NextResponse.json({ ok: true, estado: 'cerrada', manifiesto_hash: m.hash, manifiesto: m.manifiesto });
}
