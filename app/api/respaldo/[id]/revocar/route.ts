// POST /api/respaldo/[id]/revocar — { motivo } — revoca un respaldo y lo RETIRA
// del índice de consulta. Personal con `documento:revocar`. Nada se borra del
// registro de respaldos: queda marcado como no vigente, con quién y por qué.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado } from '@/lib/acceso/sesionPersonal';
import { isObj, isUuid } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('documento:revocar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Documento');
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const motivo = isObj(body) && typeof body.motivo === 'string' ? body.motivo.trim() : '';
  if (motivo.length < 5) return NextResponse.json({ error: 'El motivo es obligatorio (mínimo 5 caracteres).' }, { status: 400 });
  const { data, error } = await s.admin.rpc('retirar_documento_del_indice', { p_respaldo: id, p_actor: s.ctx.userId, p_motivo: motivo.slice(0, 500) });
  if (error) return errorDb('[respaldo/revocar]', error, 'Error al revocar el respaldo');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string; fragmentos_retirados?: number };
  if (!r.ok) return r.motivo === 'respaldo_no_existe' ? noEncontrado('Documento') : NextResponse.json({ error: 'No se pudo revocar el respaldo.', motivo: r.motivo }, { status: 409 });
  return NextResponse.json({ ok: true, fragmentos_retirados: r.fragmentos_retirados ?? 0 });
}
