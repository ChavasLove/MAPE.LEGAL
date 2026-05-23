import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import {
  embedQuery,
  toVectorText,
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
} from '@/lib/maria/embeddings';

export const dynamic = 'force-dynamic';

// GET /api/admin/maria/rag-health
// Admin-only diagnostic for the María RAG pipeline. Hit this in a browser
// when semantic retrieval looks broken to see the live state in one JSON:
//
//   - env           presence/placeholder for the 3 vars the pipeline needs
//   - rows          total rows + how many have an embedding + sample dim
//   - rpc           does each RPC (`match_maria_knowledge`,
//                   `search_maria_knowledge_fts`) respond?
//   - openai        does `embedQuery` succeed end-to-end?
//
// Modeled on `app/api/debug/auth-config/route.ts` — each probe in its own
// try/catch so one failure does not short-circuit the others.

type EnvStatus  = 'ok' | 'missing' | 'placeholder';
type ProbeState = 'ok' | 'error' | 'skipped';

function envStatus(v: string | undefined): EnvStatus {
  if (!v) return 'missing';
  const trimmed = v.trim();
  if (!trimmed) return 'missing';
  if (/placeholder|changeme|todo|xxx+/i.test(trimmed)) return 'placeholder';
  return 'ok';
}

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const env = {
    OPENAI_API_KEY:            envStatus(process.env.OPENAI_API_KEY),
    NEXT_PUBLIC_SUPABASE_URL:  envStatus(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: envStatus(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const envOk = Object.values(env).every(s => s === 'ok');

  // ── rows + RPC probes (parallelized) ──────────────────────────────────
  // All 5 probes are independent. Running them serially used to add up to
  // ~5 round-trips; Promise.all collapses to one wall-clock round-trip.
  let totalRows: number | null = null;
  let withEmbedding: number | null = null;
  let sampleDim: number | null = null;
  let rowsError: string | null = null;
  let matchRpcState: ProbeState = 'skipped';
  let matchRpcError: string | null = null;
  let ftsRpcState:   ProbeState = 'skipped';
  let ftsRpcError:   string | null = null;

  if (envOk) {
    const admin = getAdminClient();
    const zeroVec = toVectorText(new Array(EMBEDDING_DIMS).fill(0));

    const [totalRes, embeddedRes, sampleRes, matchRes, ftsRes] = await Promise.allSettled([
      admin
        .from('maria_knowledge')
        .select('id', { count: 'exact', head: true }),
      admin
        .from('maria_knowledge')
        .select('id', { count: 'exact', head: true })
        .not('embedding', 'is', null),
      admin
        .from('maria_knowledge')
        .select('embedding')
        .not('embedding', 'is', null)
        .limit(1)
        .maybeSingle(),
      // Sentinel inputs: zero vector with threshold 1.0 can't match any
      // real row, and the unique probe string for FTS won't either — both
      // prove the function exists and accepts our payload shape.
      admin.rpc('match_maria_knowledge', {
        query_embedding: zeroVec,
        match_threshold: 1.0,
        match_count: 1,
      }),
      admin.rpc('search_maria_knowledge_fts', {
        query_text: '__rag_health_probe__',
        match_count: 1,
      }),
    ]);

    if (totalRes.status === 'fulfilled') {
      const { count, error } = totalRes.value;
      if (error) rowsError = `${error.code ?? '?'}: ${error.message}`;
      else totalRows = count ?? 0;
    } else {
      rowsError = totalRes.reason instanceof Error ? totalRes.reason.message : String(totalRes.reason);
    }

    if (embeddedRes.status === 'fulfilled') {
      const { count, error } = embeddedRes.value;
      if (error && !rowsError) rowsError = `${error.code ?? '?'}: ${error.message}`;
      else if (!error) withEmbedding = count ?? 0;
    } else if (!rowsError) {
      rowsError = embeddedRes.reason instanceof Error ? embeddedRes.reason.message : String(embeddedRes.reason);
    }

    if (sampleRes.status === 'fulfilled') {
      const { data, error } = sampleRes.value;
      if (!error && data?.embedding) {
        const raw = String(data.embedding);
        const inner = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
        sampleDim = inner.length === 0 ? 0 : inner.split(',').length;
      }
    }
    // sample dim is informational — swallow on rejection.

    if (matchRes.status === 'fulfilled') {
      const { error } = matchRes.value;
      if (error) {
        matchRpcState = 'error';
        matchRpcError = `${error.code ?? '?'}: ${error.message}`;
      } else {
        matchRpcState = 'ok';
      }
    } else {
      matchRpcState = 'error';
      matchRpcError = matchRes.reason instanceof Error ? matchRes.reason.message : String(matchRes.reason);
    }

    if (ftsRes.status === 'fulfilled') {
      const { error } = ftsRes.value;
      if (error) {
        ftsRpcState = 'error';
        ftsRpcError = `${error.code ?? '?'}: ${error.message}`;
      } else {
        ftsRpcState = 'ok';
      }
    } else {
      ftsRpcState = 'error';
      ftsRpcError = ftsRes.reason instanceof Error ? ftsRes.reason.message : String(ftsRes.reason);
    }
  }

  // ── OpenAI probe ──────────────────────────────────────────────────────
  let openaiState: ProbeState = 'skipped';
  let openaiDims: number | null = null;
  let openaiError: string | null = null;

  if (env.OPENAI_API_KEY === 'ok') {
    try {
      const vec = await embedQuery('rag-health probe');
      if (Array.isArray(vec)) {
        openaiDims = vec.length;
        openaiState = vec.length === EMBEDDING_DIMS ? 'ok' : 'error';
        if (vec.length !== EMBEDDING_DIMS) {
          openaiError = `dim mismatch: got ${vec.length}, expected ${EMBEDDING_DIMS}`;
        }
      } else {
        openaiState = 'error';
        openaiError = 'embedQuery returned null (see [embeddings] logs for status)';
      }
    } catch (e) {
      openaiState = 'error';
      openaiError = e instanceof Error ? e.message : String(e);
    }
  }

  const ok =
    envOk &&
    matchRpcState === 'ok' &&
    ftsRpcState === 'ok' &&
    openaiState === 'ok' &&
    (withEmbedding ?? 0) > 0;

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      ok,
      model: EMBEDDING_MODEL,
      expected_dims: EMBEDDING_DIMS,
      env,
      rows: {
        total: totalRows,
        with_embedding: withEmbedding,
        without_embedding:
          totalRows != null && withEmbedding != null ? totalRows - withEmbedding : null,
        sample_dim: sampleDim,
        error: rowsError,
      },
      rpc: {
        match_maria_knowledge:      { state: matchRpcState, error: matchRpcError },
        search_maria_knowledge_fts: { state: ftsRpcState,   error: ftsRpcError   },
      },
      openai: { state: openaiState, dims: openaiDims, error: openaiError },
      hint: hintFor({
        envOk,
        matchRpcState,
        ftsRpcState,
        openaiState,
        withEmbedding,
        totalRows,
        sampleDim,
      }),
    },
    { status: 200 }
  );
}

function hintFor(args: {
  envOk:          boolean;
  matchRpcState:  ProbeState;
  ftsRpcState:    ProbeState;
  openaiState:    ProbeState;
  withEmbedding:  number | null;
  totalRows:      number | null;
  sampleDim:      number | null;
}): string {
  if (!args.envOk) {
    return 'One or more required env vars are missing/placeholder. Set them in Vercel → Project → Settings → Environment Variables, then redeploy.';
  }
  if (args.matchRpcState !== 'ok') {
    return 'match_maria_knowledge RPC is not callable. Apply migration 024 in Supabase Studio, then NOTIFY pgrst, "reload schema".';
  }
  if (args.ftsRpcState !== 'ok') {
    return 'search_maria_knowledge_fts RPC is not callable. Apply migration 024 in Supabase Studio.';
  }
  if (args.openaiState !== 'ok') {
    return 'OpenAI embedding call failed. Check the OPENAI_API_KEY value (401), rate limits (429), or network (timeout). Vercel logs tag the cause with [embeddings] INVALID API KEY / RATE LIMITED / TIMEOUT.';
  }
  if ((args.withEmbedding ?? 0) === 0) {
    return 'RPCs are up but no rows have embeddings. POST to /api/admin/maria/embeddings-backfill (admin) to backfill — the response will tell you exactly how many rows were written or what failed.';
  }
  if (args.sampleDim != null && args.sampleDim !== EMBEDDING_DIMS) {
    return `Sample embedding has ${args.sampleDim} dims but the column is declared vector(${EMBEDDING_DIMS}). Verify the column type in SQL Editor: SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid='public.maria_knowledge'::regclass AND attname='embedding'.`;
  }
  return `RAG is healthy. ${args.withEmbedding}/${args.totalRows} rows embedded with ${EMBEDDING_MODEL}.`;
}
