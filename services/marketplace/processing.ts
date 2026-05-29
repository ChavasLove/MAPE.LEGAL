// ─── Marketplace document processing (server-only) ──────────────────────────
// Replaces the two Deno edge functions from the original script with a single
// Node path that fits the repo's stack:
//   1. Mistral OCR over a short-lived Storage signed URL (no base64 — avoids the
//      stack overflow of spreading a 100 MB Uint8Array).
//   2. Chunk the OCR markdown, embed with OpenAI (lib/maria/embeddings), and
//      insert into document_chunks (vectors serialized via toVectorText).
//
// All DB access uses the service-role admin client (document_chunks /
// project_documents have a service_role FOR ALL policy in migration 026).

import { getAdminClient } from '@/services/adminSupabase';
import { embedBatch, buildCanonicalText, toVectorText } from '@/lib/maria/embeddings';
import { chunkText, cleanChunkText } from '@/lib/marketplace/chunking';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const MISTRAL_OCR_MODEL = 'mistral-ocr-latest';
const OCR_TIMEOUT_MS = 120_000;          // OCR of large PDFs is slow
const SIGNED_URL_TTL_S = 600;            // 10 min — long enough for Mistral to fetch
const EMBED_BATCH = 96;                  // inputs per OpenAI embeddings call
const INSERT_BATCH = 200;                // rows per Supabase insert

export interface ProcessResult {
  documentId: string;
  pageCount: number;
  totalChunks: number;
  chunksInserted: number;
  embeddedChunks: number;
}

interface MistralOcrResult {
  fullText: string;
  pageCount: number;
  confidence: number | null;
}

class ProcessingError extends Error {}

// Public entry point. Throws ProcessingError on failure (after marking the row
// `failed`); the caller maps that to a 4xx/5xx with a generic message.
export async function processDocument(documentId: string): Promise<ProcessResult> {
  const admin = getAdminClient();

  const { data: doc, error: docErr } = await admin
    .from('project_documents')
    .select('id, project_id, title, document_type, storage_bucket, storage_path')
    .eq('id', documentId)
    .maybeSingle();

  if (docErr) {
    console.error('[marketplace/processing] doc fetch failed:', docErr);
    throw new ProcessingError('No se pudo leer el documento');
  }
  if (!doc) throw new ProcessingError('Documento no encontrado');

  await admin
    .from('project_documents')
    .update({ ocr_status: 'processing' })
    .eq('id', documentId);

  try {
    // ── 1. OCR via signed URL ────────────────────────────────────────────────
    const bucket = (doc.storage_bucket as string) || 'project-documents';
    const { data: signed, error: signErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL_S);

    if (signErr || !signed?.signedUrl) {
      throw new ProcessingError('No se pudo firmar el archivo para OCR');
    }

    const ocr = await runMistralOcr(signed.signedUrl);

    await admin
      .from('project_documents')
      .update({
        ocr_status:          'completed',
        ocr_engine:          'mistral_ocr3',
        ocr_confidence:      ocr.confidence,
        ocr_text:            ocr.fullText,
        page_count:          ocr.pageCount,
        processing_metadata: { pages: ocr.pageCount, ocr_chars: ocr.fullText.length },
      })
      .eq('id', documentId);

    // ── 2. Chunk + embed + insert ────────────────────────────────────────────
    // Reprocess idempotency: clear any chunks from a previous run first.
    await admin.from('document_chunks').delete().eq('document_id', documentId);

    const title = (doc.title as string) ?? '';
    const docType = (doc.document_type as string) ?? '';
    const chunks = chunkText(ocr.fullText);

    let chunksInserted = 0;
    let embeddedChunks = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const inputs = batch.map((c) => buildCanonicalText(title, c.text, docType));
      const vectors = await embedBatch(inputs);

      const rows = batch.map((c, k) => {
        const vecText = toVectorText(vectors[k]);
        if (vecText) embeddedChunks++;
        return {
          document_id:   documentId,
          project_id:    doc.project_id as string,
          chunk_index:   c.index,
          total_chunks:  chunks.length,
          content:       c.text,
          content_clean: cleanChunkText(c.text),
          embedding:     vecText,
          breadcrumb:    `${title} > Fragmento ${c.index + 1}`,
          page_number:   c.estimatedPage,
          chunk_type:    c.isTable ? 'table' : 'text',
          is_table:      c.isTable,
          language:      'es',
        };
      });

      for (let j = 0; j < rows.length; j += INSERT_BATCH) {
        const slice = rows.slice(j, j + INSERT_BATCH);
        const { error: insErr } = await admin.from('document_chunks').insert(slice);
        if (insErr) {
          console.error('[marketplace/processing] chunk insert failed:', insErr);
          throw new ProcessingError('No se pudieron guardar los fragmentos del documento');
        }
        chunksInserted += slice.length;
      }
    }

    return {
      documentId,
      pageCount: ocr.pageCount,
      totalChunks: chunks.length,
      chunksInserted,
      embeddedChunks,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[marketplace/processing] ${documentId} failed:`, msg);
    await admin
      .from('project_documents')
      .update({ ocr_status: 'failed', processing_metadata: { error: msg } })
      .eq('id', documentId);
    throw e instanceof ProcessingError ? e : new ProcessingError('Error procesando el documento');
  }
}

async function runMistralOcr(documentUrl: string): Promise<MistralOcrResult> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) throw new ProcessingError('OCR no configurado (falta MISTRAL_API_KEY)');

  let response: Response;
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MISTRAL_OCR_MODEL,
        document: {
          type: 'document_url',
          document_url: documentUrl,
          document_name: 'document.pdf',
        },
        include_image_data: false,
      }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[marketplace/processing] Mistral fetch error:', msg);
    throw new ProcessingError('No se pudo contactar el servicio de OCR');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[marketplace/processing] Mistral OCR HTTP', response.status, body.slice(0, 500));
    throw new ProcessingError(`Servicio de OCR respondió ${response.status}`);
  }

  const result = await response.json().catch(() => null) as { pages?: { markdown?: string }[]; confidence?: unknown } | null;
  const pages = Array.isArray(result?.pages) ? result!.pages : [];
  const fullText = pages.map((p) => p?.markdown ?? '').join('\n\n---\n\n').trim();

  if (!fullText) throw new ProcessingError('El OCR no devolvió texto');

  return {
    fullText,
    pageCount: pages.length,
    confidence: typeof result?.confidence === 'number' ? result.confidence : null,
  };
}
