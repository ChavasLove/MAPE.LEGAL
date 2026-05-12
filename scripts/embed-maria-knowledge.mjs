/**
 * embed-maria-knowledge.mjs
 *
 * Backfill de embeddings sobre `public.maria_knowledge` para todas las filas
 * con `embedding IS NULL`. Usa OpenAI `text-embedding-3-small` (1536 dims).
 *
 * Run from project root (después de aplicar migración 024 en Supabase Studio):
 *   node scripts/embed-maria-knowledge.mjs
 *
 * Flags opcionales:
 *   --force          re-embebir TODAS las filas (no solo las que tienen embedding null)
 *   --limit N        procesar a lo sumo N filas (para pruebas)
 *   --dry-run        no escribir a Supabase, solo loggear costo aproximado
 *
 * Idempotente — re-ejecutable sin generar duplicados. Procesa en lotes para
 * minimizar round-trips a OpenAI y a Supabase.
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const oai = process.env.OPENAI_API_KEY;

if (!url || !key) {
  console.error('[embed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!oai) {
  console.error('[embed] Missing OPENAI_API_KEY');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const FORCE   = args.has('--force');
const DRY_RUN = args.has('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? Math.max(1, Number(process.argv[limitIdx + 1])) : null;

const MODEL = 'text-embedding-3-small';
const DIMS = 1536;
const BATCH_SIZE = 50;          // OpenAI permite hasta 2048 inputs por request; 50 es prudente y rápido.
const MAX_INPUT_CHARS = 8000;   // ~2-3k tokens, holgado para entries largos.

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const openai = new OpenAI({ apiKey: oai });

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function buildInputText(row) {
  // Concatenamos title + content para que el embedding capture ambos.
  // El `[category]` prefix da contexto adicional sin inflar tokens.
  const t = String(row.title ?? '').trim();
  const c = String(row.content ?? '').trim();
  const cat = String(row.category ?? '').trim();
  const prefix = cat ? `[${cat}] ` : '';
  return `${prefix}${t}\n\n${c}`.slice(0, MAX_INPUT_CHARS);
}

async function run() {
  // 1. Fetch candidate rows.
  let q = admin.from('maria_knowledge').select('id, category, title, content');
  if (!FORCE) q = q.is('embedding', null);
  q = q.order('created_at', { ascending: true });
  if (LIMIT) q = q.limit(LIMIT);

  const { data: rows, error: selectErr } = await q;
  if (selectErr) {
    console.error('[embed] select failed:', selectErr.message);
    process.exit(1);
  }
  if (!rows?.length) {
    console.log('[embed] No rows to embed. Nothing to do.');
    return;
  }

  console.log(`[embed] Will embed ${rows.length} row(s) (force=${FORCE}, dryRun=${DRY_RUN}).`);

  // Rough cost estimate: ~$0.02 / 1M tokens; assume ~250 tokens avg per row.
  const estTokens = rows.length * 250;
  const estCost = (estTokens / 1_000_000) * 0.02;
  console.log(`[embed] Approx cost: ~${estTokens.toLocaleString()} tokens / ~$${estCost.toFixed(4)} USD.`);

  if (DRY_RUN) {
    console.log('[embed] --dry-run set, skipping OpenAI + Supabase writes.');
    return;
  }

  // 2. Process in batches.
  const batches = chunk(rows, BATCH_SIZE);
  let done = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const inputs = batch.map(buildInputText);

    let embeddings;
    try {
      const res = await openai.embeddings.create({ model: MODEL, input: inputs });
      embeddings = res.data;
    } catch (e) {
      console.error(`[embed] Batch ${i + 1}/${batches.length} failed at OpenAI: ${e?.message ?? e}`);
      failed += batch.length;
      continue;
    }

    if (embeddings.length !== batch.length) {
      console.error(`[embed] Batch ${i + 1}: expected ${batch.length} embeddings, got ${embeddings.length}. Skipping.`);
      failed += batch.length;
      continue;
    }

    // 3. Update each row individually. pgvector espera el array crudo,
    //    supabase-js lo serializa correctamente cuando la columna es vector.
    const updates = batch.map((row, idx) => {
      const vec = embeddings[idx]?.embedding;
      if (!Array.isArray(vec) || vec.length !== DIMS) return null;
      return { id: row.id, vec };
    });

    for (const u of updates) {
      if (!u) { failed++; continue; }
      const { error: upErr } = await admin
        .from('maria_knowledge')
        .update({ embedding: u.vec })
        .eq('id', u.id);
      if (upErr) {
        console.error(`[embed] update failed for ${u.id}: ${upErr.message}`);
        failed++;
      } else {
        done++;
      }
    }

    console.log(`[embed] Batch ${i + 1}/${batches.length} — ${done} done, ${failed} failed.`);
  }

  console.log(`[embed] Finished. ${done} row(s) embedded, ${failed} failed.`);
  process.exit(failed > 0 ? 2 : 0);
}

run().catch(err => {
  console.error('[embed] fatal:', err?.message ?? err);
  process.exit(1);
});
