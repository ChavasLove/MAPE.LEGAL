import { NextResponse } from 'next/server';
import { emailContactoInterno, emailContactoAcuse } from '@/services/emailService';

export async function POST(req: Request) {
  try {
    const { nombre, empresa, correo, mensaje } = await req.json();

    if (!nombre || !correo || !mensaje) {
      return NextResponse.json(
        { error: 'Nombre, correo y mensaje son requeridos.' },
        { status: 400 }
      );
    }

    // Send both emails concurrently — internal notification + user acknowledgment
    await Promise.all([
      emailContactoInterno(nombre, correo, mensaje, empresa),
      emailContactoAcuse(nombre, correo),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contacto]', err);
    return NextResponse.json(
      { error: 'Error al enviar el mensaje. Escríbenos a gerencia@mape.legal.' },
      { status: 500 }
    );
  }
}
