import { NextResponse, type NextRequest } from 'next/server';
import { parseWebhookMessages } from '@/services/whatsappService';
import { supabase } from '@/services/supabase';
import { validateMetaSignature } from '@/lib/webhookSignatures';

// GET: webhook verification handshake by Meta
export async function GET(req: NextRequest) {
  const params    = req.nextUrl.searchParams;
  const mode      = params.get('hub.mode');
  const token     = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('Forbidden', { status: 403 });
}

// POST: incoming messages and status updates from Meta
export async function POST(req: NextRequest) {
  try {
    // Read the raw body once: the X-Hub-Signature-256 HMAC must be computed over
    // the bytes exactly as received, not a re-serialized JSON.
    const raw = await req.text();

    // Enforce Meta's signature when WHATSAPP_APP_SECRET is configured. Left
    // unset, validation is skipped (logged) so the currently-working media flow
    // keeps running until the secret is intentionally added.
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const ok = validateMetaSignature({
        appSecret,
        signatureHeader: req.headers.get('x-hub-signature-256'),
        rawBody: raw,
      });
      if (!ok) {
        console.warn('[meta-webhook] signature validation failed — rejecting');
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('[meta-webhook] WHATSAPP_APP_SECRET not set — skipping signature validation');
    }

    const payload = JSON.parse(raw);
    const messages = parseWebhookMessages(payload);

    for (const msg of messages) {
      // Twilio handles text via /api/whatsapp; this Meta endpoint only stores
      // media for the admin verification queue. Log dropped non-media so
      // misrouted text is visible in function logs instead of vanishing.
      if (msg.type !== 'image' && msg.type !== 'document') {
        console.warn('[meta-webhook] dropped non-media message from', msg.from, 'type=', msg.type);
        continue;
      }

      const tipo    = msg.type === 'image' ? 'imagen' : 'PDF';
      const archivo = msg.mediaId ? `wa-media-${msg.mediaId}` : '';

      // Insert into mensajes_wa — admin assigns to an expediente later
      await supabase.from('mensajes_wa').insert({
        cliente:     msg.contactName ?? msg.from,
        hora:        msg.timestamp,
        archivo,
        tipo,
        doc_tipo:    msg.mediaFilename ?? '',
        estado:      'listo',
        campos:      [],
      });
    }

    // Always return 200 to Meta — any non-200 triggers retries
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
