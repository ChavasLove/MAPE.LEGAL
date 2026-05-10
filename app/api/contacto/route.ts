import { NextResponse } from 'next/server';
import { emailContactoInterno, emailContactoAcuse } from '@/services/emailService';
import { getAdminClient } from '@/services/adminSupabase';

export async function POST(req: Request) {
  try {
    const { nombre, empresa, correo, mensaje } = await req.json();

    if (!nombre || !correo || !mensaje) {
      return NextResponse.json(
        { error: 'Nombre, correo y mensaje son requeridos.' },
        { status: 400 }
      );
    }

    // 1. Persist to DB — primary record, never lost even if email fails.
    //    Silently skipped if the migration hasn't been applied yet.
    let emailSent = false;
    try {
      const admin = getAdminClient();
      await admin.from('contactos').insert({ nombre, empresa: empresa ?? null, correo, mensaje });
    } catch (dbErr) {
      console.error('[contacto] db insert failed:', dbErr);
    }

    // 2. Send emails — non-fatal. Both fire in parallel.
    try {
      await Promise.all([
        emailContactoInterno(nombre, correo, mensaje, empresa),
        emailContactoAcuse(nombre, correo),
      ]);
      emailSent = true;
    } catch (emailErr) {
      console.error('[contacto] email delivery failed:', emailErr);
    }

    // 3. Update email_sent flag if we have a DB record
    if (emailSent) {
      try {
        const admin = getAdminClient();
        await admin
          .from('contactos')
          .update({ email_sent: true })
          .eq('correo', correo)
          .order('created_at', { ascending: false })
          .limit(1);
      } catch {
        // non-critical
      }
    }

    // Always return success — the lead is captured regardless of email status.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Error al procesar tu solicitud. Escríbenos a gerencia@mape.legal.' },
      { status: 500 }
    );
  }
}
