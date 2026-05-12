import OpenAI from 'openai';

// Lazy singleton — instanciar a nivel de módulo rompía el build de Next.js
// cuando `OPENAI_API_KEY` falta durante page-data-collection (mismo patrón
// que `_supabase` en `app/api/whatsapp/route.js`).
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) return null;
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// Modelo canónico del repo. Cambiarlo aquí implica re-embebir todo
// `public.maria_knowledge` (las dimensiones tienen que coincidir con la
// columna `vector(1536)` de migración 024 y con el seed script).
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1536;

// Hard cap defensivo — `text-embedding-3-small` admite hasta 8192 tokens.
// 8000 caracteres es una aproximación conservadora (~2-3k tokens) que cubre
// cualquier mensaje de WhatsApp sin tocar el límite.
const MAX_INPUT_CHARS = 8000;

export async function embedQuery(text: string): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) return null;

  const cleaned = String(text ?? '').trim();
  if (!cleaned) return null;

  try {
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleaned.slice(0, MAX_INPUT_CHARS),
    });
    const vec = res.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBEDDING_DIMS ? vec : null;
  } catch (e) {
    console.error('[embeddings] embedQuery failed:', (e as Error)?.message);
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const client = getOpenAI();
  if (!client) return texts.map(() => null);

  const cleaned = texts.map(t => String(t ?? '').trim().slice(0, MAX_INPUT_CHARS));
  if (cleaned.every(t => !t)) return texts.map(() => null);

  try {
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleaned,
    });
    return cleaned.map((_, i) => {
      const vec = res.data?.[i]?.embedding;
      return Array.isArray(vec) && vec.length === EMBEDDING_DIMS ? vec : null;
    });
  } catch (e) {
    console.error('[embeddings] embedBatch failed:', (e as Error)?.message);
    return texts.map(() => null);
  }
}
