// Shared RAG + concesiones context primitives for María. Both the WhatsApp
// webhook (app/api/whatsapp/route.js) and the web widget endpoint
// (app/api/maria/chat/route.ts) import from here so the two channels can't
// drift — previously these constants and the formatter were copy-pasted into
// both files and a change to one silently diverged the other.
//
// Only the pure, side-effect-free pieces live here. buildConcesionContext and
// retrieveKnowledge stay per-route because they bind to different Supabase
// client handles (the webhook passes a client in; the widget uses the module
// proxy) and emit channel-specific log prefixes.

export const RAG_MATCH_COUNT = 3;
export const RAG_MATCH_THRESHOLD = 0.7;

// Fires the concesiones lookup. Only the `i` flag (no `g`), so `.test()` is
// stateless and safe to share across calls.
export const CONCESION_TRIGGERS =
  /\b(concesi[oó]n(?:es)?|inhgeomin|permiso\s+(?:de\s+)?(?:exploraci[oó]n|explotaci[oó]n|miner[oa])|registro\s+(?:de\s+)?(?:concesi[oó]n|miner[oa])|otorgad[ao]\s+para|en\s+solicitud|pendiente\s+de\s+aprobaci[oó]n|qui[eé]n\s+tiene\s+(?:la\s+)?concesi[oó]n|empresa\s+miner|d[oó]nde\s+est[aá]\s+ubicad)/i;

// Strips trigger/stopword tokens before the trigram search. Has the `g` flag,
// but is only ever consumed via String.replace(), which resets lastIndex on
// completion — so sharing one instance across calls is safe.
export const CONCESION_STOPWORDS =
  /\b(concesi[oó]n(?:es)?|inhgeomin|permiso|exploraci[oó]n|explotaci[oó]n|miner[oa]?|registro|otorgad[ao]|para|en|solicitud|pendiente|de|aprobaci[oó]n|qui[eé]n|tiene|la|el|empresa|d[oó]nde|est[aá]|ubicad[ao]?|hay|alguna|alguien|los|las|del|al|si|me|por|favor|gracias)\b/gi;

export type KnowledgeRow = { category: string; title: string; content: string };

export function formatKnowledgeRows(rows: KnowledgeRow[]): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.map((c) => `[${c.category}] ${c.title}: ${c.content}`).join('\n\n');
}
