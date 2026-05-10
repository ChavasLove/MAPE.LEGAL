// Strip the optional `whatsapp:` prefix and trim. Mirrors the helper in
// services/userService.ts; lifted into lib/ so admin API routes can normalize
// inputs from the URL/body without importing user-creation side effects.
export function normalizePhone(raw: string): string {
  return raw.replace(/^whatsapp:/i, '').trim();
}
