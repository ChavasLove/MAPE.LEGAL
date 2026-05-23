import { NextResponse, type NextRequest } from 'next/server';
import { sendWhatsAppText } from '@/services/whatsappService';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const { to, body: msgBody, expediente_id } = await req.json();

    if (!to || !msgBody) {
      return NextResponse.json({ error: 'to y body son requeridos' }, { status: 400 });
    }

    // Strip non-digit chars except leading +
    const phone = to.replace(/[^\d]/g, '');
    const messageId = await sendWhatsAppText(phone, msgBody);

    if (expediente_id) {
      const admin = getAdminClient();
      await admin.from('notificaciones').insert({
        expediente_id,
        tipo:       'whatsapp',
        cuerpo:     msgBody,
        estado:     'enviado',
        enviado_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, message_id: messageId });
  } catch (error) {
    console.error('[whatsapp/send] failed:', error);
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 });
  }
}
