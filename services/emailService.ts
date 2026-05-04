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

// ─── Shared HTML shell ────────────────────────────────────────────────────────

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F6F7;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6F7;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:#1F2A44;border-radius:12px 12px 0 0;padding:28px 40px">
            <p style="margin:0;color:#D8C3A5;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600">
              Corporación Hondureña Tenka
            </p>
            <p style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">
              MAPE.LEGAL
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F5F6F7;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center">
            <p style="margin:0;color:#A3AAB3;font-size:12px">
              MAPE.LEGAL · Corporación Hondureña Tenka, S.A. de C.V.<br>
              Honduras · <a href="mailto:gerencia@mape.legal" style="color:#A3AAB3">gerencia@mape.legal</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

// ─── Contact form templates ───────────────────────────────────────────────────

/** Internal notification sent to gerencia@mape.legal on every contact form submission. */
export function emailContactoInterno(
  nombre: string,
  correo: string,
  mensaje: string,
  empresa?: string
): Promise<void> {
  const fecha = new Date().toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return sendEmail({
    to:      'gerencia@mape.legal',
    subject: `Nuevo contacto web — ${nombre}`,
    html: emailShell(`
      <p style="margin:0 0 6px;color:#5E6B7A;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600">
        Nuevo mensaje desde el formulario de contacto
      </p>
      <h2 style="margin:0 0 24px;color:#162033;font-size:20px">${nombre}</h2>

      <table cellpadding="0" cellspacing="0" width="100%"
             style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <tr style="background:#F5F6F7">
          <td style="padding:10px 16px;font-size:12px;color:#5E6B7A;font-weight:600;text-transform:uppercase;letter-spacing:1px;width:140px">
            Correo
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#162033">
            <a href="mailto:${correo}" style="color:#1F2A44">${correo}</a>
          </td>
        </tr>
        ${empresa ? `
        <tr>
          <td style="padding:10px 16px;font-size:12px;color:#5E6B7A;font-weight:600;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #E5E7EB">
            Empresa / Op.
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#162033;border-top:1px solid #E5E7EB">
            ${empresa}
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:10px 16px;font-size:12px;color:#5E6B7A;font-weight:600;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #E5E7EB">
            Recibido
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#162033;border-top:1px solid #E5E7EB">
            ${fecha}
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:12px;color:#5E6B7A;font-weight:600;text-transform:uppercase;letter-spacing:1px">
        Mensaje
      </p>
      <div style="background:#F5F6F7;border:1px solid #E5E7EB;border-radius:8px;padding:16px 20px;
                  font-size:14px;color:#162033;line-height:1.6;white-space:pre-wrap">${mensaje}</div>

      <p style="margin:24px 0 0;font-size:13px;color:#A3AAB3">
        Responde directamente a <a href="mailto:${correo}" style="color:#1F2A44">${correo}</a>
        para continuar la conversación.
      </p>
    `),
  });
}

/** Acknowledgment sent to the person who submitted the contact form. */
export function emailContactoAcuse(
  nombre: string,
  correo: string
): Promise<void> {
  return sendEmail({
    to:      correo,
    subject: 'Recibimos tu consulta — MAPE.LEGAL',
    html: emailShell(`
      <p style="margin:0 0 20px;color:#162033;font-size:16px">
        Hola <strong>${nombre}</strong>,
      </p>
      <p style="margin:0 0 16px;color:#5E6B7A;font-size:15px;line-height:1.6">
        Recibimos tu consulta y un miembro de nuestro equipo se comunicará contigo
        en <strong>menos de 48 horas hábiles</strong>.
      </p>
      <p style="margin:0 0 32px;color:#5E6B7A;font-size:15px;line-height:1.6">
        Si tienes información adicional que quieras compartir antes de nuestra llamada,
        responde directamente a este correo.
      </p>
      <div style="background:#F0EDE8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:12px;color:#8C6A4A;font-weight:700;
                  text-transform:uppercase;letter-spacing:1px">¿Preguntas urgentes?</p>
        <p style="margin:0;font-size:14px;color:#162033">
          Escríbenos directamente a
          <a href="mailto:gerencia@mape.legal" style="color:#2F5D50;font-weight:600">
            gerencia@mape.legal
          </a>
        </p>
      </div>
      <p style="margin:0;color:#A3AAB3;font-size:13px">
        — Equipo MAPE.LEGAL · Corporación Hondureña Tenka
      </p>
    `),
  });
}

// ─── Email confirmation + admin invite templates ─────────────────────────────

const ROL_LABELS: Record<string, string> = {
  admin:             'Administrador',
  abogado:           'Abogado',
  tecnico_ambiental: 'Técnico Ambiental',
  cliente:           'Cliente',
};

/** Confirmation link sent when a user signs up or requests a resend.
 *  `actionLink` is a Supabase-signed URL from auth.admin.generateLink('signup'). */
export function emailConfirmacionCorreo(
  correo: string,
  actionLink: string
): Promise<void> {
  return sendEmail({
    to:      correo,
    subject: 'Confirma tu correo · MAPE.LEGAL',
    html: emailShell(`
      <p style="margin:0 0 20px;color:#162033;font-size:16px">
        Confirma tu cuenta para acceder a MAPE.LEGAL.
      </p>
      <p style="margin:0 0 28px;color:#5E6B7A;font-size:15px;line-height:1.6">
        Recibimos una solicitud de acceso para <strong>${correo}</strong>.
        Haz clic en el botón para verificar tu correo. El enlace expira en 24 horas.
      </p>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${actionLink}"
           style="display:inline-block;background:#1F2A44;color:#ffffff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px">
          Confirmar correo →
        </a>
      </div>

      <p style="margin:0 0 8px;color:#5E6B7A;font-size:13px">
        Si el botón no funciona, copia esta dirección en tu navegador:
      </p>
      <p style="margin:0 0 28px;color:#5E6B7A;font-size:12px;word-break:break-all">
        <a href="${actionLink}" style="color:#3A6EA5">${actionLink}</a>
      </p>

      <p style="margin:0;color:#A3AAB3;font-size:13px">
        Si no solicitaste este correo, ignóralo o comunícate con
        <a href="mailto:gerencia@mape.legal" style="color:#5E6B7A">gerencia@mape.legal</a>.
      </p>
    `),
  });
}

/** Invitation sent when an admin creates a user. The recipient sets their own
 *  password via the link — admins never see or transmit plaintext passwords. */
export function emailInvitacionUsuario(
  correo: string,
  rol: string,
  actionLink: string
): Promise<void> {
  const rolLabel = ROL_LABELS[rol] ?? rol;
  return sendEmail({
    to:      correo,
    subject: 'Te han invitado a MAPE.LEGAL',
    html: emailShell(`
      <p style="margin:0 0 20px;color:#162033;font-size:16px">
        Te han invitado a usar MAPE.LEGAL.
      </p>
      <p style="margin:0 0 24px;color:#5E6B7A;font-size:15px;line-height:1.6">
        Se creó una cuenta para <strong>${correo}</strong> con el perfil de
        <strong>${rolLabel}</strong>. Configura tu contraseña para iniciar sesión.
        El enlace expira en 24 horas.
      </p>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${actionLink}"
           style="display:inline-block;background:#1F2A44;color:#ffffff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px">
          Configurar contraseña →
        </a>
      </div>

      <p style="margin:0 0 8px;color:#5E6B7A;font-size:13px">
        Si el botón no funciona, copia esta dirección en tu navegador:
      </p>
      <p style="margin:0 0 28px;color:#5E6B7A;font-size:12px;word-break:break-all">
        <a href="${actionLink}" style="color:#3A6EA5">${actionLink}</a>
      </p>

      <p style="margin:0;color:#A3AAB3;font-size:13px">
        Si no esperabas este correo, comunícate con
        <a href="mailto:gerencia@mape.legal" style="color:#5E6B7A">gerencia@mape.legal</a>.
      </p>
    `),
  });
}
