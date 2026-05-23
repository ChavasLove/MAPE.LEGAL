import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { sendWhatsAppText, WhatsAppApiError } from '@/services/whatsappService';
import { normalizePhone } from '@/lib/maria/normalizePhone';

export const dynamic = 'force-dynamic';

// GET  /api/admin/maria/conversations/[phone]
// POST /api/admin/maria/conversations/[phone]   { content: string }
//
// GET returns the full thread (last 200 messages, asc), client match, onboarding
// state, and any pending transaction. POST sends an admin take-over message via
// Meta Cloud API and logs it as role='assistant' with the [Admin] prefix so the
// thread reflects what was actually delivered to the user.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const normalized = normalizePhone(decoded);
  // Match either form ('+504…' or 'whatsapp:+504…') in conversaciones_whatsapp
  const candidates = [normalized, `whatsapp:${normalized}`];

  const admin = getAdminClient();

  const [msgsRes, clienteRes, onboardingRes, pendingTxRes] = await Promise.all([
    admin
      .from('conversaciones_whatsapp')
      .select('id, role, content, created_at, numero_whatsapp')
      .in('numero_whatsapp', candidates)
      .order('created_at', { ascending: true })
      .limit(200),
    admin
      .from('clientes')
      .select('id, nombre, dpi, municipio, situacion_tierra, tipo_mineral, telefono_whatsapp, created_at')
      .eq('telefono_whatsapp', normalized)
      .maybeSingle(),
    admin
      .from('onboarding_states')
      .select('estado, datos, created_at, updated_at')
      .eq('telefono', normalized)
      .maybeSingle(),
    admin
      .from('transacciones_pendientes')
      .select('id, estado, detalle, mensaje_original, respuesta_asistente, created_at')
      .in('numero_whatsapp', candidates)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (msgsRes.error) {
    console.error('[admin/maria/conversations/phone GET] messages fetch failed:', msgsRes.error);
    return NextResponse.json({ error: 'Error al cargar el hilo' }, { status: 500 });
  }

  return NextResponse.json({
    telefono:      normalized,
    messages:      msgsRes.data ?? [],
    cliente:       clienteRes.data ?? null,
    onboarding:    onboardingRes.data ?? null,
    transactions:  pendingTxRes.data ?? [],
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const normalized = normalizePhone(decoded);

  const body = await req.json().catch(() => ({})) as { content?: string };
  const content = (body.content ?? '').trim();

  if (!content) {
    return NextResponse.json({ error: 'content requerido' }, { status: 400 });
  }
  if (content.length > 4000) {
    return NextResponse.json({ error: 'content excede 4000 caracteres' }, { status: 400 });
  }

  // Send via Meta Cloud API
  try {
    await sendWhatsAppText(normalized, content);
  } catch (e) {
    if (e instanceof WhatsAppApiError) {
      console.error('[admin/maria/conversations/phone POST] WhatsApp send failed:', e);
      const status = e.isAuthError ? 502 : 500;
      const userMsg = e.isAuthError
        ? 'WhatsApp rechazó el envío (token expirado o sin permisos).'
        : 'No se pudo enviar el mensaje por WhatsApp.';
      return NextResponse.json(
        { error: userMsg, code: e.code, isAuthError: e.isAuthError },
        { status }
      );
    }
    console.error('[admin/maria/conversations/phone POST] send failed:', e);
    return NextResponse.json({ error: 'No se pudo enviar el mensaje.' }, { status: 500 });
  }

  // Log the admin reply so María's next history fetch sees it (avoids
  // duplicate greetings or contradictions on the next turn).
  //
  // Two things are critical here:
  //   1. `numero_whatsapp` MUST be the Twilio-style `whatsapp:+504…` form
  //      because route.js queries history with `eq('numero_whatsapp',
  //      fromNumber)` and Twilio's `fromNumber` always carries that prefix
  //      in production. We force the canonical form here instead of
  //      sampling a prior row — the prior-row sample was fragile because
  //      the first row could have been a Meta-origin (stripped) message,
  //      which would orphan all subsequent admin replies from María's view.
  //   2. The visible `[Admin · email]` prefix is for the UI thread only.
  //      route.js strips it from assistant messages before constructing the
  //      Claude prompt — otherwise Claude would parrot the bracket convention
  //      and leak the admin's email back to the customer over WhatsApp.
  const admin = getAdminClient();
  const adminEmail = auth.user.email ?? 'admin';
  const tagged = `[Admin · ${adminEmail}] ${content}`;
  const storageKey = `whatsapp:${normalized}`;

  const { error: insertErr } = await admin
    .from('conversaciones_whatsapp')
    .insert({
      numero_whatsapp: storageKey,
      role:            'assistant',
      content:         tagged,
    });

  if (insertErr) {
    // The message was sent but logging failed — surface it for visibility.
    console.error('[admin/maria/conversations/phone POST] log insert failed:', insertErr);
    return NextResponse.json(
      { ok: true, sent: true, logged: false, log_error: 'No se pudo guardar el mensaje en el hilo.' },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, sent: true, logged: true });
}
