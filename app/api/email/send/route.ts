import { NextResponse, type NextRequest } from 'next/server';
import { sendEmail } from '@/services/emailService';
import { getAdminClient } from '@/services/adminSupabase';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

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
    console.error('[email/send] failed:', error);
    return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
  }
}
