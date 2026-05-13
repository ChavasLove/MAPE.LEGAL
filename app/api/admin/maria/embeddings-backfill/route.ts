import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { embedBatch, EMBEDDING_DIMS, EMBEDDING_MODEL } from '@/lib/maria/embeddings';

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
const MAX_INPUT_CHARS = 8000;

function buildInputText(row: { category: string | null; title: string | null; content: string | null }) {
  const cat = String(row.category ?? '').trim();
  const t   = String(row.title ?? '').trim();
  const c   = String(row.content ?? '').trim();
  const prefix = cat ? `[${cat}] ` : '';
  return `${prefix}${t}\n\n${c}`.slice(0, MAX_INPUT_CHARS);
}

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
    return NextResponse.json({ error: 'select failed', detail: selectErr.message }, { status: 500 });
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

  const inputs = rows.map(buildInputText);
  const vectors = await embedBatch(inputs);

  let done = 0;
  let failed = 0;
  const failures: Array<{ id: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const vec = vectors[i];
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
      failed++;
      failures.push({ id: row.id, reason: 'embedding missing or wrong dim' });
      continue;
    }
    // pgvector requires the text form `[f1,f2,...]`. When the column is
    // unbounded `vector` (no typmod), passing a raw JS number array makes
    // supabase-js JSON-serialize it as a JSON array, which PostgREST sends
    // to PG as a json value — PG silently strips it because there's no
    // implicit cast from json to vector. The UPDATE returns 0 rows affected
    // but no error. Convert to the canonical text form first so PG parses
    // it as a vector literal.
    const vecText = `[${vec.join(',')}]`;
    const { error: upErr, count } = await admin
      .from('maria_knowledge')
      .update({ embedding: vecText }, { count: 'exact' })
      .eq('id', row.id);
    if (upErr) {
      failed++;
      failures.push({ id: row.id, reason: upErr.message });
    } else if (count === 0) {
      // Defensive: should not happen if RLS + grants are right, but report
      // it explicitly instead of silently incrementing done.
      failed++;
      failures.push({ id: row.id, reason: 'update returned 0 rows affected' });
    } else {
      done++;
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
