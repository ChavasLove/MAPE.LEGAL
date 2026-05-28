const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';

// Escapes user-controlled strings before they're interpolated into HTML
// templates. Without this, `<script>` or attribute-breakout via `"` /
// onerror= in a contact-form submission lands in the gerencia inbox as
// live HTML. Covers text contexts and most attribute contexts (href,
// mailto:); escaping `&"<>'` is sufficient for both per the OWASP rules.
function esc(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  // Retry transient failures (429 rate-limit, 5xx, network/timeout) with
  // exponential backoff. Without this a single blip lost the email silently —
  // contact-form submissions and phase/payment notifications never arrived.
  // Other 4xx (bad payload, auth) are permanent and fail immediately.
  const MAX_ATTEMPTS = 3;
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(SENDGRID_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(8000),
      });
    } catch (e) {
      lastError = (e as Error)?.message ?? 'network error';
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
        continue;
      }
      throw new Error(`SendGrid request failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
    }

    if (res.ok) return;

    if (res.status === 429 || res.status >= 500) {
      lastError = `SendGrid ${res.status}`;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
        continue;
      }
    }
    // Permanent 4xx, or transient exhausted on the final attempt.
    const err = await res.text();
    throw new Error(`SendGrid ${res.status}: ${err}`);
  }
  throw new Error(`SendGrid failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ─── Shared HTML shell ────────────────────────────────────────────────────────

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF9F5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F5;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:#1F2A38;border-radius:12px 12px 0 0;padding:28px 40px">
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
          <td style="background:#ffffff;padding:40px;border-left:1px solid #E2E0D8;border-right:1px solid #E2E0D8">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#FAF9F5;border:1px solid #E2E0D8;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center">
            <p style="margin:0;color:#A3A8AB;font-size:12px">
              MAPE.LEGAL · Corporación Hondureña Tenka, S.A. de C.V.<br>
              Honduras · <a href="mailto:gerencia@mape.legal" style="color:#A3A8AB">gerencia@mape.legal</a>
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
      <p>Estimado/a <strong>${esc(nombre)}</strong>,</p>
      <p>Su expediente <strong>${esc(expId)}</strong> ha avanzado a la fase <strong>${esc(faseNueva)}</strong>.</p>
      <p>Para consultas, responda a este correo o contáctenos por WhatsApp.</p>
      <br>
      <p style="color:#5E6B7B;font-size:13px">— MAPE.LEGAL · Corporación Hondureña Tenka, S.A.</p>
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
      <p>Estimado/a <strong>${esc(nombre)}</strong>,</p>
      <p>El documento <strong>${esc(documento)}</strong> de su expediente <strong>${esc(expId)}</strong> requiere atención.</p>
      ${motivo ? `<p>Motivo: ${esc(motivo)}</p>` : ''}
      <p>Por favor envíe una versión corregida o contáctenos para asistencia.</p>
      <br>
      <p style="color:#5E6B7B;font-size:13px">— MAPE.LEGAL · Corporación Hondureña Tenka, S.A.</p>
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
      <p>Estimado/a <strong>${esc(nombre)}</strong>,</p>
      <p>Se ha generado un hito de pago en su expediente <strong>${esc(expId)}</strong>.</p>
      <ul>
        <li>Monto: <strong>${esc(montoFmt)}</strong></li>
        <li>Evento: ${esc(trigger)}</li>
      </ul>
      <p>Por favor coordine el pago con su abogado asignado.</p>
      <br>
      <p style="color:#5E6B7B;font-size:13px">— MAPE.LEGAL · Corporación Hondureña Tenka, S.A.</p>
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
      <p style="margin:0 0 6px;color:#5E6B7B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600">
        Nuevo mensaje desde el formulario de contacto
      </p>
      <h2 style="margin:0 0 24px;color:#1F2A38;font-size:20px">${esc(nombre)}</h2>

      <table cellpadding="0" cellspacing="0" width="100%"
             style="border:1px solid #E2E0D8;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <tr style="background:#FAF9F5">
          <td style="padding:10px 16px;font-size:12px;color:#5E6B7B;font-weight:600;text-transform:uppercase;letter-spacing:1px;width:140px">
            Correo
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#1F2A38">
            <a href="mailto:${esc(correo)}" style="color:#1F2A38">${esc(correo)}</a>
          </td>
        </tr>
        ${empresa ? `
        <tr>
          <td style="padding:10px 16px;font-size:12px;color:#5E6B7B;font-weight:600;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #E2E0D8">
            Empresa / Op.
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#1F2A38;border-top:1px solid #E2E0D8">
            ${esc(empresa)}
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:10px 16px;font-size:12px;color:#5E6B7B;font-weight:600;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #E2E0D8">
            Recibido
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#1F2A38;border-top:1px solid #E2E0D8">
            ${esc(fecha)}
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:12px;color:#5E6B7B;font-weight:600;text-transform:uppercase;letter-spacing:1px">
        Mensaje
      </p>
      <div style="background:#FAF9F5;border:1px solid #E2E0D8;border-radius:8px;padding:16px 20px;
                  font-size:14px;color:#1F2A38;line-height:1.6;white-space:pre-wrap">${esc(mensaje)}</div>

      <p style="margin:24px 0 0;font-size:13px;color:#A3A8AB">
        Responde directamente a <a href="mailto:${esc(correo)}" style="color:#1F2A38">${esc(correo)}</a>
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
      <p style="margin:0 0 20px;color:#1F2A38;font-size:16px">
        Hola <strong>${esc(nombre)}</strong>,
      </p>
      <p style="margin:0 0 16px;color:#5E6B7B;font-size:15px;line-height:1.6">
        Recibimos tu consulta y un miembro de nuestro equipo se comunicará contigo
        en <strong>menos de 48 horas hábiles</strong>.
      </p>
      <p style="margin:0 0 32px;color:#5E6B7B;font-size:15px;line-height:1.6">
        Si tienes información adicional que quieras compartir antes de nuestra llamada,
        responde directamente a este correo.
      </p>
      <div style="background:#F0EDE5;border-radius:10px;padding:20px 24px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:12px;color:#8B6A4A;font-weight:700;
                  text-transform:uppercase;letter-spacing:1px">¿Preguntas urgentes?</p>
        <p style="margin:0;font-size:14px;color:#1F2A38">
          Escríbenos directamente a
          <a href="mailto:gerencia@mape.legal" style="color:#2F5D50;font-weight:600">
            gerencia@mape.legal
          </a>
        </p>
      </div>
      <p style="margin:0;color:#A3A8AB;font-size:13px">
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
      <p style="margin:0 0 20px;color:#1F2A38;font-size:16px">
        Confirma tu cuenta para acceder a MAPE.LEGAL.
      </p>
      <p style="margin:0 0 28px;color:#5E6B7B;font-size:15px;line-height:1.6">
        Recibimos una solicitud de acceso para <strong>${esc(correo)}</strong>.
        Haz clic en el botón para verificar tu correo. El enlace expira en 24 horas.
      </p>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${esc(actionLink)}"
           style="display:inline-block;background:#1F2A38;color:#ffffff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px">
          Confirmar correo →
        </a>
      </div>

      <p style="margin:0 0 8px;color:#5E6B7B;font-size:13px">
        Si el botón no funciona, copia esta dirección en tu navegador:
      </p>
      <p style="margin:0 0 28px;color:#5E6B7B;font-size:12px;word-break:break-all">
        <a href="${esc(actionLink)}" style="color:#2A6BA8">${esc(actionLink)}</a>
      </p>

      <p style="margin:0;color:#A3A8AB;font-size:13px">
        Si no solicitaste este correo, ignóralo o comunícate con
        <a href="mailto:gerencia@mape.legal" style="color:#5E6B7B">gerencia@mape.legal</a>.
      </p>
    `),
  });
}

/** Password reset link sent when a user requests recovery via /auth/recuperar-password.
 *  `actionLink` is a Supabase-signed URL from auth.admin.generateLink('recovery'). */
export function emailResetPassword(
  correo: string,
  actionLink: string
): Promise<void> {
  return sendEmail({
    to:      correo,
    subject: 'Restablecer tu contraseña · MAPE.LEGAL',
    html: emailShell(`
      <p style="margin:0 0 20px;color:#1F2A38;font-size:16px">
        Solicitaste restablecer tu contraseña.
      </p>
      <p style="margin:0 0 28px;color:#5E6B7B;font-size:15px;line-height:1.6">
        Recibimos una solicitud para <strong>${esc(correo)}</strong>.
        Haz clic en el botón para crear una nueva contraseña. El enlace expira en 1 hora.
      </p>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${esc(actionLink)}"
           style="display:inline-block;background:#1F2A38;color:#ffffff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px">
          Restablecer contraseña →
        </a>
      </div>

      <p style="margin:0 0 8px;color:#5E6B7B;font-size:13px">
        Si el botón no funciona, copia esta dirección en tu navegador:
      </p>
      <p style="margin:0 0 28px;color:#5E6B7B;font-size:12px;word-break:break-all">
        <a href="${esc(actionLink)}" style="color:#2A6BA8">${esc(actionLink)}</a>
      </p>

      <p style="margin:0 0 16px;color:#B23A3A;font-size:13px">
        Si no solicitaste este correo, ignóralo. Tu contraseña no cambiará.
      </p>
      <p style="margin:0;color:#A3A8AB;font-size:13px">
        En caso de dudas, contacta a
        <a href="mailto:gerencia@mape.legal" style="color:#5E6B7B">gerencia@mape.legal</a>.
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
      <p style="margin:0 0 20px;color:#1F2A38;font-size:16px">
        Te han invitado a usar MAPE.LEGAL.
      </p>
      <p style="margin:0 0 24px;color:#5E6B7B;font-size:15px;line-height:1.6">
        Se creó una cuenta para <strong>${esc(correo)}</strong> con el perfil de
        <strong>${esc(rolLabel)}</strong>. Configura tu contraseña para iniciar sesión.
        El enlace expira en 24 horas.
      </p>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${esc(actionLink)}"
           style="display:inline-block;background:#1F2A38;color:#ffffff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px">
          Configurar contraseña →
        </a>
      </div>

      <p style="margin:0 0 8px;color:#5E6B7B;font-size:13px">
        Si el botón no funciona, copia esta dirección en tu navegador:
      </p>
      <p style="margin:0 0 28px;color:#5E6B7B;font-size:12px;word-break:break-all">
        <a href="${esc(actionLink)}" style="color:#2A6BA8">${esc(actionLink)}</a>
      </p>

      <p style="margin:0;color:#A3A8AB;font-size:13px">
        Si no esperabas este correo, comunícate con
        <a href="mailto:gerencia@mape.legal" style="color:#5E6B7B">gerencia@mape.legal</a>.
      </p>
    `),
  });
}
