// Meta WhatsApp Business Cloud API
const META_BASE = 'https://graph.facebook.com/v21.0';

function getConfig() {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) throw new Error('WhatsApp credentials not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)');
  return { token, phoneId };
}

// ─── Typed errors ─────────────────────────────────────────────────────────────
//
// Meta returns auth failures under several shapes; the daily broadcast and any
// per-message send must distinguish them from transient/per-recipient errors so
// callers can fail fast and surface an actionable message instead of looping
// the same 401 across every subscriber.

// Meta error codes that mean "the WHATSAPP_TOKEN is invalid or expired".
// https://developers.facebook.com/docs/graph-api/guides/error-handling/
const META_AUTH_ERROR_CODES = new Set([
  102, // Session has expired
  190, // Access token has expired / been invalidated
  463, // Access token has expired
]);

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class WhatsAppApiError extends Error {
  status: number;
  code: number | null;
  subcode: number | null;
  type: string | null;
  fbtraceId: string | null;
  isAuthError: boolean;
  rawBody: string;

  constructor(status: number, rawBody: string, parsed: MetaErrorBody | null) {
    const e = parsed?.error;
    const code = typeof e?.code === 'number' ? e.code : null;
    const subcode = typeof e?.error_subcode === 'number' ? e.error_subcode : null;
    const type = typeof e?.type === 'string' ? e.type : null;
    const isAuthError =
      status === 401 ||
      type === 'OAuthException' ||
      (code !== null && META_AUTH_ERROR_CODES.has(code));

    const summary = e?.message
      ? `${e.message} (code=${code ?? '?'}${subcode ? `/${subcode}` : ''})`
      : rawBody.slice(0, 300);

    super(`WhatsApp API ${status}: ${summary}`);
    this.name = 'WhatsAppApiError';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.type = type;
    this.fbtraceId = e?.fbtrace_id ?? null;
    this.isAuthError = isAuthError;
    this.rawBody = rawBody;
  }
}

async function throwFromResponse(res: Response): Promise<never> {
  const rawBody = await res.text();
  let parsed: MetaErrorBody | null = null;
  try { parsed = JSON.parse(rawBody) as MetaErrorBody; } catch { /* not JSON */ }
  throw new WhatsAppApiError(res.status, rawBody, parsed);
}

// ─── Token health check ───────────────────────────────────────────────────────
//
// Lightweight call against the configured phone-number node. Used as a
// pre-flight before the daily broadcast and exposed via /api/admin/whatsapp/health
// so ops can verify the token without sending a real message.

export interface WhatsAppTokenHealth {
  ok: boolean;
  phoneId: string | null;
  displayPhoneNumber?: string;
  verifiedName?: string;
  isAuthError: boolean;
  error?: string;
  errorCode?: number | null;
}

export async function checkWhatsAppTokenHealth(): Promise<WhatsAppTokenHealth> {
  let token: string;
  let phoneId: string;
  try {
    ({ token, phoneId } = getConfig());
  } catch (e) {
    return {
      ok: false,
      phoneId: null,
      isAuthError: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const res = await fetch(
      `${META_BASE}/${phoneId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const rawBody = await res.text();
      let parsed: MetaErrorBody | null = null;
      try { parsed = JSON.parse(rawBody) as MetaErrorBody; } catch { /* not JSON */ }
      const err = new WhatsAppApiError(res.status, rawBody, parsed);
      return {
        ok: false,
        phoneId,
        isAuthError: err.isAuthError,
        error: err.message,
        errorCode: err.code,
      };
    }

    const data = await res.json() as { display_phone_number?: string; verified_name?: string };
    return {
      ok: true,
      phoneId,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      isAuthError: false,
    };
  } catch (e) {
    return {
      ok: false,
      phoneId,
      isAuthError: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Core send functions ──────────────────────────────────────────────────────

export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  const { token, phoneId } = getConfig();

  const res = await fetch(`${META_BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) await throwFromResponse(res);

  const data = await res.json() as { messages?: Array<{ id: string }> };
  return data.messages?.[0]?.id ?? '';
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = 'es',
  components: unknown[] = []
): Promise<string> {
  const { token, phoneId } = getConfig();

  const res = await fetch(`${META_BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    }),
  });

  if (!res.ok) await throwFromResponse(res);

  const data = await res.json() as { messages?: Array<{ id: string }> };
  return data.messages?.[0]?.id ?? '';
}

// ─── Event helpers ────────────────────────────────────────────────────────────

export function notifyExpedienteAvance(phone: string, nombre: string, expId: string, fase: string) {
  return sendWhatsAppText(
    phone,
    `*MAPE.LEGAL* — Hola ${nombre}, su expediente *${expId}* avanzó a *${fase}*. Para consultas responda este mensaje.`
  );
}

export function notifyDocumentoPendiente(phone: string, nombre: string, expId: string, documento: string) {
  return sendWhatsAppText(
    phone,
    `*MAPE.LEGAL* — ${nombre}, se requiere el documento *${documento}* para su expediente *${expId}*. Envíe una foto clara del documento por este medio.`
  );
}

export function notifyHitoPago(phone: string, nombre: string, expId: string, monto: number) {
  const fmt = new Intl.NumberFormat('es-HN').format(monto);
  return sendWhatsAppText(
    phone,
    `*MAPE.LEGAL* — ${nombre}, se ha generado un hito de pago de *L. ${fmt}* para su expediente *${expId}*. Contacte a su abogado para coordinar el pago.`
  );
}

export function notifyDocumentoVerificado(phone: string, nombre: string, expId: string, documento: string) {
  return sendWhatsAppText(
    phone,
    `*MAPE.LEGAL* — ${nombre}, el documento *${documento}* de su expediente *${expId}* ha sido verificado correctamente. ✓`
  );
}

// ─── Webhook helpers ──────────────────────────────────────────────────────────

export interface WaIncomingMessage {
  from: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  body?: string;
  mediaId?: string;
  mediaFilename?: string;
  contactName?: string;
  timestamp: string;
}

export function parseWebhookMessages(payload: unknown): WaIncomingMessage[] {
  const body = payload as Record<string, unknown>;
  const messages: WaIncomingMessage[] = [];

  const entries = (body.entry as unknown[]) ?? [];
  for (const entry of entries) {
    const changes = ((entry as Record<string, unknown>).changes as unknown[]) ?? [];
    for (const change of changes) {
      const value = (change as Record<string, unknown>).value as Record<string, unknown>;
      const incomingMsgs = (value?.messages as unknown[]) ?? [];
      const contacts = (value?.contacts as Array<{ profile: { name: string } }>) ?? [];

      for (const msg of incomingMsgs) {
        const m = msg as Record<string, unknown>;
        const type = m.type as WaIncomingMessage['type'];
        if (!['text', 'image', 'document', 'audio', 'video'].includes(type)) continue;

        const image    = m.image    as Record<string, string> | undefined;
        const document = m.document as Record<string, string> | undefined;

        messages.push({
          from:          m.from as string,
          type,
          body:          (m.text as Record<string, string> | undefined)?.body,
          mediaId:       image?.id ?? document?.id,
          mediaFilename: document?.filename,
          contactName:   contacts[0]?.profile?.name,
          timestamp:     new Date(parseInt(m.timestamp as string, 10) * 1000).toISOString(),
        });
      }
    }
  }

  return messages;
}
