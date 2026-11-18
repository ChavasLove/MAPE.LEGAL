// /api/cadena/consentimientos — consentimiento informado del minero para que
// una organización (planta) acceda a su expediente/documentos/lotes.
//
// GET  staff | auditor → todos; planta → los otorgados a su organización;
//      cliente → los suyos. ?cliente_id= opcional (staff/auditor).
// POST admin | abogado → { cliente_id, otorgado_a_org_id, documento_path,
//      hash_sha256 (64 hex), fecha_firma, alcance: { expediente?, documentos?, lotes? } }.
//      El documento firmado se registra como ruta de Storage + huella SHA-256
//      (sin subida de archivos en esta etapa, igual que /api/certificados).
// Revocación: POST /api/cadena/consentimientos/[id]/revocar.

import { NextResponse } from 'next/server';
import { iniciarSesionCadena, leerJson, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { veTodo } from '@/lib/cadena/acceso';
import type { Consentimiento } from '@/lib/cadena/types';
import { isUuid, parseLimit, validarBodyConsentimiento } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'auditor', 'planta', 'cliente');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const url = new URL(req.url);
  const clienteId = url.searchParams.get('cliente_id');
  if (clienteId !== null && !isUuid(clienteId)) {
    return NextResponse.json({ error: 'cliente_id inválido (uuid).' }, { status: 400 });
  }
  const limit = parseLimit(url.searchParams.get('limit'), 200, 1000);

  let query = admin.from('consentimientos').select('*').order('created_at', { ascending: false }).limit(limit);
  if (veTodo(ctx.rol)) {
    if (clienteId) query = query.eq('cliente_id', clienteId);
  } else if (ctx.rol === 'planta') {
    if (!ctx.organizacionId) return NextResponse.json({ consentimientos: [] });
    query = query.eq('otorgado_a_org_id', ctx.organizacionId);
    if (clienteId) query = query.eq('cliente_id', clienteId);
  } else {
    // cliente: solo los propios; el filtro cliente_id del query se ignora.
    if (!ctx.clienteId) return NextResponse.json({ consentimientos: [] });
    query = query.eq('cliente_id', ctx.clienteId);
  }

  const { data, error } = await query;
  if (error) return respuestaErrorDb('[cadena/consentimientos GET]', error, { generico: 'Error al obtener consentimientos' });

  const consentimientos = (data ?? []) as Consentimiento[];
  registrarAcceso({ ctx, accion: 'lectura', recurso_tipo: 'consentimientos', detalle: { total: consentimientos.length, cliente_id: clienteId } });
  return NextResponse.json({ consentimientos });
}

export async function POST(req: Request) {
  const s = await iniciarSesionCadena('admin', 'abogado');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const body = await leerJson(req);
  if (body instanceof NextResponse) return body;
  const v = validarBodyConsentimiento(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.data;

  const [cliRes, orgRes] = await Promise.all([
    admin.from('clientes').select('id').eq('id', d.cliente_id).maybeSingle(),
    admin.from('organizaciones').select('id, activo').eq('id', d.otorgado_a_org_id).maybeSingle(),
  ]);
  if (cliRes.error) return respuestaErrorDb('[cadena/consentimientos POST]', cliRes.error, { generico: 'Error al validar el cliente' });
  if (orgRes.error) return respuestaErrorDb('[cadena/consentimientos POST]', orgRes.error, { generico: 'Error al validar la organización' });
  if (!cliRes.data) return NextResponse.json({ error: 'Cliente (minero) no encontrado.' }, { status: 400 });
  const org = orgRes.data as { activo: boolean } | null;
  if (!org || !org.activo) return NextResponse.json({ error: 'Organización no encontrada o inactiva.' }, { status: 400 });

  const fila = {
    cliente_id: d.cliente_id,
    otorgado_a_org_id: d.otorgado_a_org_id,
    documento_path: d.documento_path,
    hash_sha256: d.hash_sha256,
    fecha_firma: d.fecha_firma,
    alcance: d.alcance,
    estado: 'vigente',
    registrado_por: ctx.userId,
  };

  const { data, error } = await admin.from('consentimientos').insert(fila).select('*').single();
  if (error) {
    return respuestaErrorDb('[cadena/consentimientos POST]', error, {
      conflicto: 'Ya existe un consentimiento con ese documento o huella.',
      generico: 'Error al registrar el consentimiento',
    });
  }
  return NextResponse.json({ consentimiento: data as Consentimiento }, { status: 201 });
}
