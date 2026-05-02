// Meta WhatsApp Business Cloud API
const META_BASE = 'https://graph.facebook.com/v21.0';

function getConfig() {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) throw new Error('WhatsApp credentials not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)');
  return { token, phoneId };
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${err}`);
  }

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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${err}`);
  }

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
