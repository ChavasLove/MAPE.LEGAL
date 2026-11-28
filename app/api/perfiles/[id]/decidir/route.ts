// POST /api/perfiles/[id]/decidir — aprobar, rechazar o suspender UN perfil.
// `verificador` o `admin`. No existe aprobación masiva: la ruta recibe un id.
// Separación de funciones: quien creó o editó el perfil no decide (se valida
// aquí con el predicado puro y otra vez en la base, dentro de decidir_perfil).

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado } from '@/lib/acceso/sesionPersonal';
import { separacionDeFunciones } from '@/lib/acceso/personal';
import { isObj, isUuid } from '@/lib/cadena/validacion';
import { MOTIVO_DECISION_MENSAJE, validarDecision, type EstadoPerfil } from '@/lib/perfiles/estados';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('perfil:decidir');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Perfil');

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  if (!isObj(body)) return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  if (Array.isArray(body.ids) || Array.isArray(body.perfiles)) {
    return NextResponse.json({ error: 'Los perfiles se deciden uno por uno.' }, { status: 400 });
  }

  const actual = await s.admin.from('perfiles').select('id, estado, creado_por, editado_por').eq('id', id).maybeSingle();
  if (actual.error) return errorDb('[perfiles/decidir]', actual.error, 'Error al obtener el perfil');
  const p = actual.data as { id: string; estado: EstadoPerfil; creado_por: string | null; editado_por: string | null } | null;
  if (!p) return noEncontrado('Perfil');

  const d = validarDecision(p.estado, body.decision, body.motivo);
  if (!d.ok) return NextResponse.json({ error: MOTIVO_DECISION_MENSAJE[d.motivo], motivo: d.motivo }, { status: d.motivo === 'transicion_invalida' ? 409 : 400 });
  const sep = separacionDeFunciones(s.ctx.userId, p);
  if (!sep.ok) return NextResponse.json({ error: MOTIVO_DECISION_MENSAJE[sep.motivo], motivo: sep.motivo }, { status: 403 });

  const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim().slice(0, 1000) : null;
  const { data, error } = await s.admin.rpc('decidir_perfil', {
    p_perfil: id, p_decision: d.estado, p_motivo: motivo, p_actor: s.ctx.userId,
  });
  if (error) return errorDb('[perfiles/decidir]', error, 'Error al registrar la decisión');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string; estado?: string; version?: number };
  if (!r.ok) {
    const clave = r.motivo ?? 'transicion_invalida';
    const status = clave === 'es_creador' || clave === 'es_editor' || clave === 'rol_no_autorizado' ? 403 : 409;
    return NextResponse.json({ error: MOTIVO_DECISION_MENSAJE[clave] ?? 'No se pudo registrar la decisión.', motivo: clave }, { status });
  }
  // decidir_perfil ya asentó aprobaciones_perfil y bitacora_acciones en la misma transacción.
  return NextResponse.json({ ok: true, estado: r.estado, version: r.version });
}
