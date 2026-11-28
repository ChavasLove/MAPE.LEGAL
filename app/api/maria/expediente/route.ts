// POST /api/maria/expediente — María en el CANAL AUTENTICADO del panel:
// consulta de expedientes con cita de fuente. Solo lectura.
//
//   1. Sesión obligatoria (requireRole). El alcance lo fija el usuario
//      autenticado, nunca un dato del cuerpo.
//   2. Un pedido de escritura se responde con un texto fijo, sin modelo.
//   3. La búsqueda aplica la ACL por fragmento ANTES de recuperar
//      (buscar_fragmentos_acl, migración 049). Sin fragmentos → SIN_FUENTE, sin
//      llamar al modelo.
//   4. El modelo NO recibe herramientas. La respuesta sale con su cita.
//
// Por WhatsApp y en el chat público no existe esta consulta.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { errorDb, iniciarSesionRoles, leerCuerpo } from '@/lib/acceso/sesionPersonal';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { isObj } from '@/lib/cadena/validacion';
import { checkRateLimit } from '@/lib/rateLimit';
import { MARIA_SYSTEM_PROMPT } from '@/lib/maria/systemPrompt';
import {
  HERRAMIENTAS_MARIA, RESPUESTA_SOLO_LECTURA, SIN_FUENTE, asegurarCita, bloqueContextoExpediente, pideEscritura,
  type FragmentoContexto,
} from '@/lib/maria/soloLectura';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mismo modelo que los otros dos canales de María (app/api/maria/chat).
const MODELO_MARIA = 'claude-haiku-4-5-20251001';
const MAX_PREGUNTA = 1000;

export async function POST(req: Request) {
  const s = await iniciarSesionRoles('admin', 'abogado', 'tecnico_ambiental', 'verificador', 'recepcion', 'cliente');
  if (s instanceof NextResponse) return s;
  const rate = checkRateLimit(`maria-expediente:${s.ctx.userId}`, 20, 5 * 60 * 1000);
  if (!rate.ok) return NextResponse.json({ error: 'Demasiadas consultas. Intente más tarde.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } });

  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  const pregunta = isObj(body) && typeof body.pregunta === 'string' ? body.pregunta.trim() : '';
  if (!pregunta || pregunta.length > MAX_PREGUNTA) return NextResponse.json({ error: `La pregunta es obligatoria (máximo ${MAX_PREGUNTA} caracteres).` }, { status: 400 });

  // 2. María no escribe.
  if (pideEscritura(pregunta)) return NextResponse.json({ respuesta: RESPUESTA_SOLO_LECTURA, fuentes: [], solo_lectura: true });

  // 3. Recuperación con ACL previa. El usuario es el de la sesión.
  const { data, error } = await s.admin.rpc('buscar_fragmentos_acl', { p_consulta: pregunta, p_user: s.ctx.userId, p_limite: 5 });
  if (error) return errorDb('[maria/expediente]', error, 'Error al consultar el expediente');
  const fragmentos = ((data ?? []) as Array<FragmentoContexto & { documento_id: string }>);
  if (fragmentos.length === 0) return NextResponse.json({ respuesta: SIN_FUENTE, fuentes: [], solo_lectura: true });

  registrarAcceso({
    ctx: { rol: s.ctx.rol, userId: s.ctx.userId, email: null, organizacionId: s.ctx.organizacionId, clienteId: null },
    accion: 'lectura', recurso_tipo: 'documentos_fragmentos', detalle: { documentos: [...new Set(fragmentos.map((f) => f.documento_id))], canal: 'panel_autenticado' },
  });

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'El asistente no está disponible en este momento.' }, { status: 503 });
  let texto = '';
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create(
      {
        model: MODELO_MARIA,
        max_tokens: 800,
        system: `${MARIA_SYSTEM_PROMPT}\n\n${bloqueContextoExpediente(fragmentos)}`,
        messages: [{ role: 'user', content: pregunta }],
        // Sin `tools`: María no tiene herramientas (HERRAMIENTAS_MARIA es vacía).
        ...(HERRAMIENTAS_MARIA.length > 0 ? { tools: [...HERRAMIENTAS_MARIA] } : {}),
      },
      { timeout: 20_000, maxRetries: 1 },
    );
    for (const bloque of res.content) if (bloque.type === 'text') texto += bloque.text;
  } catch (err) {
    console.error('[maria/expediente] modelo no disponible:', err instanceof Anthropic.APIError ? err.status : 'error');
    return NextResponse.json({ error: 'El asistente no está disponible en este momento.' }, { status: 502 });
  }

  return NextResponse.json({
    respuesta: asegurarCita(texto, fragmentos),
    fuentes: fragmentos.map((f) => ({ titulo: f.titulo, version: f.version, fecha: f.fecha_documento })),
    solo_lectura: true,
  });
}
