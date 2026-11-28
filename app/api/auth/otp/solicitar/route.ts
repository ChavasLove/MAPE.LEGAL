// POST /api/auth/otp/solicitar — pide un código de acceso de un solo uso.
// Público. La respuesta de éxito es SIEMPRE idéntica (exista o no la cuenta).
// Reglas y pruebas: lib/auth/otpServicio.ts · tests/otp.test.ts.

import { NextResponse, type NextRequest } from 'next/server';
import { clientIpFrom } from '@/lib/rateLimit';
import { solicitarOtp } from '@/lib/auth/otpServicio';
import { dependenciasOtpReales } from '@/lib/auth/otpSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const email = (body as { email?: unknown } | null)?.email;

  const deps = dependenciasOtpReales();
  if (!deps) {
    console.error('[otp/solicitar] configuración incompleta (pepper o claves de Supabase)');
    return NextResponse.json({ error: 'Configuración de servidor incompleta', code: 'SERVER_CONFIG' }, { status: 500 });
  }

  try {
    const r = await solicitarOtp(deps, email, clientIpFrom(req));
    if (!r.ok) {
      return NextResponse.json(
        { error: r.mensaje },
        { status: r.status, headers: r.retryAfterSec ? { 'Retry-After': String(r.retryAfterSec) } : undefined },
      );
    }
    return NextResponse.json({ ok: true, mensaje: r.mensaje, esperaReenvioSeg: r.esperaReenvioSeg });
  } catch (err) {
    // Nunca se registra el correo ni el código.
    console.error('[otp/solicitar] no disponible:', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ error: 'El acceso por código no está disponible en este momento.', code: 'OTP_NO_DISPONIBLE' }, { status: 503 });
  }
}
