// Inbound webhook authenticity. Neither the Twilio (text) nor the Meta (media)
// webhook validated signatures before this, so anyone who knew the URL could
// forge messages, drive up Anthropic/OpenAI cost, and poison the conversation
// store. Pure crypto + no extra dependency (the routes run on the Node runtime).

import crypto from 'node:crypto';

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  // timingSafeEqual throws on length mismatch — short-circuit first.
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ── Twilio (X-Twilio-Signature) ──────────────────────────────────────────────
// Twilio signs the full request URL followed by every POST param appended in
// alphabetical order as key immediately followed by value (no separators),
// HMAC-SHA1 with the account auth token, base64.
// https://www.twilio.com/docs/usage/security#validating-requests
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

export function validateTwilioSignature(opts: {
  authToken: string;
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  if (!opts.authToken || !opts.signature) return false;
  const expected = computeTwilioSignature(opts.authToken, opts.url, opts.params);
  return timingSafeEqual(expected, opts.signature);
}

// ── Meta / WhatsApp Cloud API (X-Hub-Signature-256) ──────────────────────────
// Meta signs the raw request body with HMAC-SHA256 keyed by the App Secret and
// sends `X-Hub-Signature-256: sha256=<hex>`. The body must be hashed exactly as
// received — hash the raw text, never a re-serialized JSON.
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
export function validateMetaSignature(opts: {
  appSecret: string;
  signatureHeader: string | null;
  rawBody: string;
}): boolean {
  if (!opts.appSecret || !opts.signatureHeader) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', opts.appSecret).update(opts.rawBody, 'utf-8').digest('hex');
  return timingSafeEqual(expected, opts.signatureHeader);
}
