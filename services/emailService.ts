const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY not configured');

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@mape.legal';
  const fromName  = process.env.SENDGRID_FROM_NAME  ?? 'MAPE.LEGAL';

  const to = Array.isArray(payload.to)
    ? payload.to.map(email => ({ email }))
    : [{ email: payload.to }];

  const body = {
    personalizations: [{ to }],
    from: { email: payload.from ?? fromEmail, name: payload.fromName ?? fromName },
    subject: payload.subject,
    content: [
      ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
      { type: 'text/html', value: payload.html },
    ],
  };

  const res = await fetch(SENDGRID_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid ${res.status}: ${err}`);
  }
}

// ─── Pre-built event templates ────────────────────────────────────────────────

export function emailExpedienteAvance(
  to: string, nombre: string, expId: string, faseNueva: string
): Promise<void> {
  return sendEmail({
    to,
    subject: `Expediente ${expId} — Avance a ${faseNueva}`,
    html: `
      <p>Estimado/a <strong>${nombre}</strong>,</p>
      <p>Su expediente <strong>${expId}</strong> ha avanzado a la fase <strong>${faseNueva}</strong>.</p>
      <p>Para consultas, responda a este correo o contáctenos por WhatsApp.</p>
      <br>
      <p style="color:#5E6B7A;font-size:13px">— MAPE.LEGAL · Corporación Hondureña Tenka, S.A.</p>
    `,
  });
}

export function emailDocumentoRechazado(
  to: string, nombre: string, expId: string, documento: string, motivo?: string
): Promise<void> {
  return sendEmail({
    to,
    subject: `Documento requerido — ${expId}`,
    html: `
      <p>Estimado/a <strong>${nombre}</strong>,</p>
      <p>El documento <strong>${documento}</strong> de su expediente <strong>${expId}</strong> requiere atención.</p>
      ${motivo ? `<p>Motivo: ${motivo}</p>` : ''}
      <p>Por favor envíe una versión corregida o contáctenos para asistencia.</p>
      <br>
      <p style="color:#5E6B7A;font-size:13px">— MAPE.LEGAL · Corporación Hondureña Tenka, S.A.</p>
    `,
  });
}

export function emailHitoPago(
  to: string, nombre: string, expId: string, monto: number, trigger: string
): Promise<void> {
  const montoFmt = new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(monto);
  return sendEmail({
    to,
    subject: `Hito de pago generado — ${expId}`,
    html: `
      <p>Estimado/a <strong>${nombre}</strong>,</p>
      <p>Se ha generado un hito de pago en su expediente <strong>${expId}</strong>.</p>
      <ul>
        <li>Monto: <strong>${montoFmt}</strong></li>
        <li>Evento: ${trigger}</li>
      </ul>
      <p>Por favor coordine el pago con su abogado asignado.</p>
      <br>
      <p style="color:#5E6B7A;font-size:13px">— MAPE.LEGAL · Corporación Hondureña Tenka, S.A.</p>
    `,
  });
}
