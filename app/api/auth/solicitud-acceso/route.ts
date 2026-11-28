// POST /api/auth/solicitud-acceso — la página pública ya NO crea cuentas: deja
// una solicitud (correo y nombre de contacto, nada más) para que el personal
// haga el alta. La respuesta no revela si el correo ya tiene acceso.
// [POR CONFIRMAR — WILLIS] mantener la solicitud pública o solo invitación.

import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { normalizarCorreo } from '@/lib/auth/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE = 3;
const VENTANA_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { correo: correoCrudo, nombre } = (body ?? {}) as { correo?: unknown; nombre?: unknown };
  const correo = normalizarCorreo(correoCrudo);
  if (!correo) return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 });
  let nombreContacto: string | null = null;
  if (nombre !== undefined && nombre !== null && nombre !== '') {
    if (typeof nombre !== 'string' || nombre.trim().length > 120) {
      return NextResponse.json({ error: 'El nombre de contacto supera 120 caracteres.' }, { status: 400 });
    }
    nombreContacto = nombre.trim() || null;
  }

  const rate = checkRateLimit(`solicitud-acceso:${clientIpFrom(req)}`, LIMITE, VENTANA_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intente de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  try {
    const { error } = await getAdminClient().from('solicitudes_acceso').insert({ correo, nombre_contacto: nombreContacto });
    if (error) {
      console.error('[solicitud-acceso] no registrada:', error.code);
      return NextResponse.json({ error: 'No se pudo registrar la solicitud. Escriba a gerencia@mape.legal.' }, { status: 503 });
    }
  } catch (err) {
    console.error('[solicitud-acceso] no disponible:', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ error: 'No se pudo registrar la solicitud. Escriba a gerencia@mape.legal.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, mensaje: 'Solicitud recibida. El equipo le escribirá al correo indicado.' });
}
