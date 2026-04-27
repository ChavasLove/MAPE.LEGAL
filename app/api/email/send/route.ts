import { NextResponse, type NextRequest } from 'next/server';
import { sendEmail } from '@/services/emailService';
import { getAdminClient } from '@/services/adminSupabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, html, text, expediente_id } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'to, subject y html son requeridos' },
        { status: 400 }
      );
    }

    await sendEmail({ to, subject, html, text });

    // Log notification
    if (expediente_id) {
      const admin = getAdminClient();
      await admin.from('notificaciones').insert({
        expediente_id,
        tipo:       'email',
        asunto:     subject,
        cuerpo:     html,
        estado:     'enviado',
        enviado_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al enviar email';

    if (req.body) {
      // Best-effort: log failure
      try {
        const admin = getAdminClient();
        const body2 = await req.json().catch(() => ({}));
        if (body2.expediente_id) {
          await admin.from('notificaciones').insert({
            expediente_id: body2.expediente_id,
            tipo: 'email', estado: 'fallido', error: msg,
          });
        }
      } catch { /* ignore secondary error */ }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
