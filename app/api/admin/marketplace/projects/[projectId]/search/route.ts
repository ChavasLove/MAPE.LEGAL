import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { embedQuery, toVectorText } from '@/lib/maria/embeddings';
import type { SearchResultChunk } from '@/lib/marketplace/types';

export const dynamic = 'force-dynamic';

const FTS_COLUMNS = 'id, document_id, content, breadcrumb, section_title, page_number, is_table';

// GET ?q=&limit= — hybrid semantic + FTS search over a project's chunks.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50);

  if (query.length < 2) {
    return NextResponse.json({ error: 'La búsqueda debe tener al menos 2 caracteres.' }, { status: 400 });
  }

  const admin = getAdminClient();

  // Semantic path (when an embedding is available); else FTS fallback.
  const embedding = await embedQuery(query);
  const vecText = toVectorText(embedding);

  if (vecText) {
    const { data, error } = await admin.rpc('search_document_chunks', {
      p_project_id:      projectId,
      p_query_embedding: vecText,
      p_query_text:      query,
      p_match_threshold: 0.5,
      p_match_count:     limit,
    });
    if (!error) {
      return NextResponse.json({ results: (data ?? []) as SearchResultChunk[], mode: 'hybrid' });
    }
    console.error('[admin/marketplace/search] RPC failed, falling back to FTS:', error);
  }

  // FTS-only fallback (no OPENAI_API_KEY, embedding error, or RPC error).
  const { data, error } = await admin
    .from('document_chunks')
    .select(FTS_COLUMNS)
    .eq('project_id', projectId)
    .textSearch('search_vector', query, { type: 'websearch', config: 'spanish' })
    .limit(limit);

  if (error) {
    console.error('[admin/marketplace/search] FTS failed:', error);
    return NextResponse.json({ error: 'Error en la búsqueda.' }, { status: 500 });
  }

  const results = (data ?? []).map((r: Record<string, unknown>) => ({
    chunk_id:      r.id as string,
    document_id:   r.document_id as string,
    content:       r.content as string,
    breadcrumb:    (r.breadcrumb as string) ?? null,
    section_title: (r.section_title as string) ?? null,
    page_number:   (r.page_number as number) ?? null,
    similarity:    0,
    rank:          null,
    combined_score: 0,
    is_table:      (r.is_table as boolean) ?? null,
  }));

  return NextResponse.json({ results, mode: 'fts' });
}
