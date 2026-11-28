// /api/organizaciones/[id]/invitaciones
// GET  personal con `perfil:ver` → invitaciones de la organización (sin el hash).
// POST personal con `organizacion:gestionar` → emite una invitación: token de
//      un solo uso enviado por correo; en la base queda solo su hash.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, leerCuerpo, noEncontrado, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { INVITACION_VIGENCIA_MS, generarTokenInvitacion, validarInvitacion, venceEn } from '@/lib/organizaciones/invitaciones';
import { emailInvitacionOrganizacion } from '@/services/emailService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// El hash del token nunca sale por la API.
const COLUMNAS = 'id, organizacion_id, correo, rol_en_organizacion, expira_en, estado, aceptada_en, membresia_id, created_at';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('perfil:ver');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Organización');
  const { data, error } = await s.admin.from('invitaciones_organizacion').select(COLUMNAS).eq('organizacion_id', id).order('created_at', { ascending: false }).limit(200);
  if (error) return errorDb('[organizaciones/invitaciones GET]', error, 'Error al obtener las invitaciones');
  return NextResponse.json({ invitaciones: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionPersonal('organizacion:gestionar');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Organización');
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const v = validarInvitacion(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const org = await s.admin.from('organizaciones').select('id, activo').eq('id', id).maybeSingle();
  if (org.error) return errorDb('[organizaciones/invitaciones POST]', org.error, 'Error al validar la organización');
  if (!org.data || !(org.data as { activo: boolean }).activo) return noEncontrado('Organización');

  const { token, hash } = generarTokenInvitacion();
  const { data, error } = await s.admin.from('invitaciones_organizacion')
    .insert({ organizacion_id: id, correo: v.data.correo, rol_en_organizacion: v.data.rol_en_organizacion, token_hash: hash, expira_en: venceEn(new Date()), emitida_por: s.ctx.userId })
    .select(COLUMNAS).single();
  if (error) return errorDb('[organizaciones/invitaciones POST]', error, 'Error al emitir la invitación');

  const sitio = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal').replace(/\/+$/, '');
  // El token viaja solo en el correo; no se registra ni se devuelve por la API.
  emailInvitacionOrganizacion(v.data.correo, `${sitio}/auth/invitacion?token=${token}`, Math.round(INVITACION_VIGENCIA_MS / 86_400_000))
    .catch((err: unknown) => console.error('[organizaciones/invitaciones] correo no enviado:', err instanceof Error ? err.message : 'error'));

  const inv = data as { id: string };
  await registrarAccion(s, { accion: 'invitacion_emitida', recurso_tipo: 'invitacion', recurso_id: inv.id, resumen: 'Invitación emitida', detalle: { organizacion_id: id } });
  return NextResponse.json({ invitacion: inv }, { status: 201 });
}
