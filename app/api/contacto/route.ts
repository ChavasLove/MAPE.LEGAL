import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { nombre, empresa, correo, mensaje } = await req.json();

    if (!nombre || !correo || !mensaje) {
      return NextResponse.json(
        { error: 'Nombre, correo y mensaje son requeridos.' },
        { status: 400 }
      );
    }

    // Log the contact request server-side for now.
    // Wire up an email provider (Resend, SendGrid, etc.) here when ready.
    console.log('[contacto]', {
      nombre,
      empresa: empresa ?? '—',
      correo,
      mensaje,
      received_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Error interno. Intenta de nuevo o escribe a contacto@mape.legal.' },
      { status: 500 }
    );
  }
}
