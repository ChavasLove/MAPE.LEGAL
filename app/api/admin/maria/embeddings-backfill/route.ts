import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import {
  embedBatch,
  toVectorText,
  buildCanonicalText,
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
} from '@/lib/maria/embeddings';

export const dynamic = 'force-dynamic';
// Allow up to 60s — embedding 50 rows + 50 updates can take 5-15s; give margin.
export const maxDuration = 60;

// TEMPORARY ENDPOINT — delete after the first successful run in production.
//
// Backfills embeddings on public.maria_knowledge for every row where
// `embedding IS NULL`. Mirrors `scripts/embed-maria-knowledge.mjs` but runs
// inside Vercel using the deployed env vars, so the operator doesn't need
// local Node.js to bootstrap the RAG.
//
// Auth: admin only via requireRole('admin'). Idempotent: rows with an
// embedding already present are skipped.
//
// POST body (optional): { force?: boolean, limit?: number }
//   force: re-embed every row regardless of current state (default false).
//   limit: cap on rows processed (useful for canary runs). Defaults to all.

type KnowledgeRow = { id: number; category: string | null; title: string | null; content: string | null };

export async function POST(request: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY no está configurado en Vercel.' },
      { status: 500 }
    );
  }

  let body: { force?: boolean; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }
  const force = body.force === true;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 5000) : null;

  const admin = getAdminClient();

  let q = admin
    .from('maria_knowledge')
    .select('id, category, title, content')
    .order('id', { ascending: true });
  if (!force) q = q.is('embedding', null);
  if (limit) q = q.limit(limit);

  const { data: rows, error: selectErr } = await q;
  if (selectErr) {
    console.error('[admin/maria/embeddings-backfill] select failed:', selectErr);
    return NextResponse.json({ error: 'No se pudieron cargar las filas pendientes.' }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({
      ok: true,
      message: 'Sin filas por procesar.',
      done: 0,
      failed: 0,
      total_candidates: 0,
    });
  }

  const inputs = (rows as KnowledgeRow[]).map(r =>
    buildCanonicalText(r.title ?? '', r.content ?? '', r.category ?? '')
  );
  const vectors = await embedBatch(inputs);

  let done = 0;
  let failed = 0;
  const failures: Array<{ id: number; reason: string }> = [];

  // Parallelize the UPDATEs in chunks. Sequential N awaits hit the 60s
  // maxDuration past ~200 rows; running 10 at a time keeps the round-trip
  // budget bounded while reducing wall time roughly 10x. Per-row failures
  // are accumulated independently — a chunk does not abort on the first
  // bad row.
  const CHUNK_SIZE = 10;
  for (let chunkStart = 0; chunkStart < rows.length; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, rows.length);
    const chunkResults = await Promise.all(
      Array.from({ length: chunkEnd - chunkStart }, async (_, k) => {
        const i = chunkStart + k;
        const row = rows[i];
        const vec = vectors[i];
        if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
          return { ok: false, id: row.id, reason: 'embedding missing or wrong dim' };
        }
        // pgvector requires the text form `[f1,f2,...]`. `toVectorText` is the
        // canonical serializer — raw JS arrays get JSON-encoded by supabase-js
        // and PG silently rejects them (UPDATE returns 0 rows affected, no
        // error). Same root cause as the query-side bug in retrieveKnowledge.
        const vecText = toVectorText(vec);
        if (!vecText) {
          return { ok: false, id: row.id, reason: 'toVectorText returned null' };
        }
        // `.select('id')` forces `Prefer: return=representation` so PostgREST
        // returns the rows that were actually written. Without it (when only
        // `{ count: 'exact' }` is set on `.update()`), supabase-js returns
        // `count: null` regardless of what was written, which means the
        // previous `count === 0` check was dead code and silent no-op
        // updates reported as successes.
        const { data: updated, error: upErr } = await admin
          .from('maria_knowledge')
          .update({ embedding: vecText })
          .eq('id', row.id)
          .select('id');
        if (upErr) {
          return { ok: false, id: row.id, reason: upErr.message };
        }
        if (!updated || updated.length === 0) {
          // Ground truth: no row came back, so nothing was written. Surfaces
          // schema-cache staleness, RLS denials, or id-type mismatches that
          // would otherwise look like success.
          return { ok: false, id: row.id, reason: 'update affected 0 rows (verify column type, RLS grant, schema cache)' };
        }
        return { ok: true, id: row.id };
      })
    );
    for (const r of chunkResults) {
      if (r.ok) {
        done++;
      } else {
        failed++;
        failures.push({ id: r.id, reason: r.reason ?? 'unknown' });
      }
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    model: EMBEDDING_MODEL,
    total_candidates: rows.length,
    done,
    failed,
    failures: failures.slice(0, 20),
  });
}
