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
export const MAX_INPUT_CHARS = 8000;

// Timeouts conservadores. El path runtime (María) es de tipo "user esperando"
// — 5 s + 2 retries vs 10 s de Vercel function. El path batch (backfill) es
// "operator esperando" — más holgado.
const QUERY_TIMEOUT_MS = 5000;
const BATCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

// pgvector requiere el texto `[f1,f2,…]` cuando la columna es `vector` (con
// o sin typmod). Pasar el array crudo hace que supabase-js lo serialice como
// JSON array y PG lo descarte sin error (UPDATE devuelve 0 filas, RPC
// retorna 0 resultados). Este helper es la única forma soportada.
export function toVectorText(vec: number[] | null | undefined): string | null {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  return '[' + vec.join(',') + ']';
}

// Construye el texto canónico que se pasa a OpenAI. `label` se renderiza
// como `[label] ` al inicio — usado por el backfill para inyectar la
// categoría de cada fila. Truncado al cap de 8000 chars defensivo.
export function buildCanonicalText(
  primary: string,
  secondary = '',
  label = ''
): string {
  const p = String(primary ?? '').trim();
  const s = String(secondary ?? '').trim();
  const prefix = label ? `[${label}] ` : '';
  const body = s ? `${p}\n\n${s}` : p;
  return `${prefix}${body}`.slice(0, MAX_INPUT_CHARS);
}

function logEmbeddingError(scope: string, e: unknown) {
  const err = e as { status?: number; message?: string; code?: string };
  const status = err?.status;
  const message = err?.message ?? String(e);
  if (status === 401) {
    console.error(`[embeddings] ${scope} INVALID API KEY:`, message);
  } else if (status === 429) {
    console.error(`[embeddings] ${scope} RATE LIMITED:`, message);
  } else if (/timeout|aborted/i.test(message)) {
    console.error(`[embeddings] ${scope} TIMEOUT:`, message);
  } else {
    console.error(`[embeddings] ${scope} failed:`, message);
  }
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) return null;

  const cleaned = String(text ?? '').trim();
  if (!cleaned) return null;

  try {
    const res = await client.embeddings.create(
      {
        model: EMBEDDING_MODEL,
        input: cleaned.slice(0, MAX_INPUT_CHARS),
      },
      { timeout: QUERY_TIMEOUT_MS, maxRetries: MAX_RETRIES }
    );
    const vec = res.data?.[0]?.embedding;
    if (!Array.isArray(vec)) return null;
    if (vec.length !== EMBEDDING_DIMS) {
      console.warn(
        `[embeddings] embedQuery dim mismatch: got ${vec.length}, expected ${EMBEDDING_DIMS}`
      );
      return null;
    }
    return vec;
  } catch (e) {
    logEmbeddingError('embedQuery', e);
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const client = getOpenAI();
  if (!client) return texts.map(() => null);

  const cleaned = texts.map(t => String(t ?? '').trim().slice(0, MAX_INPUT_CHARS));
  if (cleaned.every(t => !t)) return texts.map(() => null);

  try {
    const res = await client.embeddings.create(
      {
        model: EMBEDDING_MODEL,
        input: cleaned,
      },
      { timeout: BATCH_TIMEOUT_MS, maxRetries: MAX_RETRIES }
    );
    return cleaned.map((_, i) => {
      const vec = res.data?.[i]?.embedding;
      if (!Array.isArray(vec)) return null;
      if (vec.length !== EMBEDDING_DIMS) {
        console.warn(
          `[embeddings] embedBatch[${i}] dim mismatch: got ${vec.length}, expected ${EMBEDDING_DIMS}`
        );
        return null;
      }
      return vec;
    });
  } catch (e) {
    logEmbeddingError('embedBatch', e);
    return texts.map(() => null);
  }
}
