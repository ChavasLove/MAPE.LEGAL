// POST /api/organizaciones/invitaciones/aceptar — { token }
// Cualquier usuario autenticado. Un solo uso, con vencimiento, y solo para la
// cuenta del correo invitado. Aceptar NO da derechos de escritura ni activa la
// membresía: queda pendiente hasta que un verificador la active.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionRoles, leerCuerpo } from '@/lib/acceso/sesionPersonal';
import { isObj } from '@/lib/cadena/validacion';
import { checkRateLimit } from '@/lib/rateLimit';
import { INVITACION_MENSAJE, esTokenBienFormado, hashTokenInvitacion } from '@/lib/organizaciones/invitaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const s = await iniciarSesionRoles(); // cualquier rol con sesión válida
  if (s instanceof NextResponse) return s;
  const rate = checkRateLimit(`invitacion:${s.ctx.userId}`, 10, 15 * 60 * 1000);
  if (!rate.ok) return NextResponse.json({ error: 'Demasiados intentos. Intente más tarde.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } });

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const token = isObj(body) ? body.token : null;
  if (!esTokenBienFormado(token)) return NextResponse.json({ error: INVITACION_MENSAJE.invitacion_invalida, motivo: 'invitacion_invalida' }, { status: 400 });

  const { data, error } = await s.admin.rpc('aceptar_invitacion_organizacion', { p_token_hash: hashTokenInvitacion(token), p_user: s.ctx.userId });
  if (error) return errorDb('[organizaciones/invitaciones/aceptar]', error, 'Error al aceptar la invitación');
  const r = (data ?? {}) as { ok?: boolean; motivo?: string };
  if (!r.ok) {
    const motivo = r.motivo ?? 'invitacion_invalida';
    return NextResponse.json({ error: INVITACION_MENSAJE[motivo] ?? INVITACION_MENSAJE.invitacion_invalida, motivo }, { status: motivo === 'correo_no_coincide' ? 403 : 409 });
  }
  return NextResponse.json({ ok: true, estado_membresia: 'pendiente', mensaje: 'Invitación aceptada. Su pertenencia queda pendiente de verificación por el equipo.' });
}
