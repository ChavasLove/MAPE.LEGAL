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

// ─── User welcome template ────────────────────────────────────────────────────

/** Welcome email sent to a new user when their account is created from the admin panel. */
export function emailBienvenidaUsuario(
  correo: string,
  password: string,
  rol: string,
  loginUrl?: string
): Promise<void> {
  const roleLabels: Record<string, string> = {
    admin:             'Administrador',
    abogado:           'Abogado',
    tecnico_ambiental: 'Técnico Ambiental',
    cliente:           'Cliente',
  };
  const rolLabel = roleLabels[rol] ?? rol;
  const url = loginUrl ?? 'https://mape.legal/login';

  return sendEmail({
    to:      correo,
    subject: 'Tu acceso a MAPE.LEGAL está listo',
    html: emailShell(`
      <p style="margin:0 0 20px;color:#162033;font-size:16px">
        Bienvenido/a al sistema MAPE.LEGAL.
      </p>
      <p style="margin:0 0 24px;color:#5E6B7A;font-size:15px;line-height:1.6">
        Tu cuenta ha sido creada con el perfil de <strong>${rolLabel}</strong>.
        Estos son tus datos de acceso:
      </p>

      <table cellpadding="0" cellspacing="0" width="100%"
             style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:28px">
        <tr style="background:#F5F6F7">
          <td style="padding:12px 16px;font-size:12px;color:#5E6B7A;font-weight:600;
                     text-transform:uppercase;letter-spacing:1px;width:130px">
            Correo
          </td>
          <td style="padding:12px 16px;font-size:14px;color:#162033;font-weight:600">
            ${correo}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:12px;color:#5E6B7A;font-weight:600;
                     text-transform:uppercase;letter-spacing:1px;border-top:1px solid #E5E7EB">
            Contraseña
          </td>
          <td style="padding:12px 16px;font-size:14px;color:#162033;font-weight:600;
                     font-family:monospace;border-top:1px solid #E5E7EB">
            ${password}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:12px;color:#5E6B7A;font-weight:600;
                     text-transform:uppercase;letter-spacing:1px;border-top:1px solid #E5E7EB">
            Perfil
          </td>
          <td style="padding:12px 16px;font-size:14px;color:#162033;border-top:1px solid #E5E7EB">
            ${rolLabel}
          </td>
        </tr>
      </table>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${url}"
           style="display:inline-block;background:#1F2A44;color:#ffffff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px">
          Iniciar sesión →
        </a>
      </div>

      <div style="background:#F8E5E4;border-radius:8px;padding:14px 18px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#A94442;font-weight:600">
          Por seguridad, cambia tu contraseña después de tu primer acceso.
        </p>
      </div>

      <p style="margin:0;color:#A3AAB3;font-size:13px">
        Si no esperabas este correo, comunícate con
        <a href="mailto:gerencia@mape.legal" style="color:#5E6B7A">gerencia@mape.legal</a>.
      </p>
    `),
  });
}
