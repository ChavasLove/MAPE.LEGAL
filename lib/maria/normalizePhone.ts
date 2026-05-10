// Aggressive phone normalization for admin lookups.
//
// Handles every form we've seen in the wild:
//   - `whatsapp:+50497373139`    (Twilio webhook)
//   - `+50497373139`             (Meta Cloud / clientes.telefono_whatsapp)
//   - `tel:+504 9737-3139`       (link header)
//   - `50497373139`              (URL param without leading +)
//   - URL-encoded variants from `[phone]` route params
//
// Output is always `+<digits>` or '' for empty input. Callers expand to both
// `normalized` and `whatsapp:${normalized}` when querying conversaciones_whatsapp,
// since legacy rows exist in both forms (Twilio inserts prefixed; Meta inserts
// stripped).
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  let p = raw.trim();
  // Decode once; if the input wasn't URL-encoded this is a no-op.
  try { p = decodeURIComponent(p); } catch { /* ignore malformed */ }
  // Strip protocol prefix (whatsapp:, tel:, sms:).
  p = p.replace(/^(whatsapp|tel|sms):/i, '').trim();
  // Keep digits only, then prepend a single `+`. We always force the `+`
  // so downstream `'whatsapp:' + normalized` queries hit Twilio rows.
  const digits = p.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}
