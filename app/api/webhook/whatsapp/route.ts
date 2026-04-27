import { NextResponse, type NextRequest } from 'next/server';
import { parseWebhookMessages } from '@/services/whatsappService';
import { supabase } from '@/services/supabase';

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
    const payload = await req.json();
    const messages = parseWebhookMessages(payload);

    for (const msg of messages) {
      // Skip non-media messages (only store documents and images as pending verification)
      if (msg.type !== 'image' && msg.type !== 'document') continue;

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
