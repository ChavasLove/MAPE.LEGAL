-- Migration 024 — María RAG: vector embeddings + semantic retrieval
--
-- Habilita búsqueda semántica sobre `public.maria_knowledge` con pgvector.
-- Mantiene el RPC FTS existente (`search_maria_knowledge_fts`) como fallback
-- determinístico para queries con keywords claros o cuando no hay
-- `OPENAI_API_KEY` configurada en producción.
--
-- Notas operativas:
--   * Modelo de embeddings: OpenAI `text-embedding-3-small` → vector(1536).
--   * RLS al estilo de migración 023: read público, write admin/abogado/
--     tecnico_ambiental, ALL para service_role (seed/ingest scripts no
--     dependen de BYPASSRLS).
--   * RPCs `SECURITY DEFINER` con owner = `postgres` al estilo de migración
--     019 — bypasean RLS sin depender de BYPASSRLS en el service_role.
--   * `maria_knowledge` no tenía migración previa (se creó manualmente en
--     Supabase Studio cuando se agregó el RAG inicial). Este archivo es
--     idempotente: la tabla se crea sólo si no existe, y la columna
--     `embedding` se agrega con `add column if not exists`.

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ─── Tabla principal ─────────────────────────────────────────────────────────
create table if not exists public.maria_knowledge (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  title       text not null,
  content     text not null,
  embedding   vector(1536),
  source      text,
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Si la tabla ya existía sin la columna embedding (caso producción actual),
-- añadirla sin destruir contenido.
alter table public.maria_knowledge
  add column if not exists embedding vector(1536);

alter table public.maria_knowledge
  add column if not exists source text;

alter table public.maria_knowledge
  add column if not exists metadata jsonb;

alter table public.maria_knowledge
  add column if not exists created_at timestamptz not null default now();

alter table public.maria_knowledge
  add column if not exists updated_at timestamptz not null default now();

-- ─── Índices ─────────────────────────────────────────────────────────────────
-- Full-text search (español) para el fallback determinístico.
create index if not exists idx_maria_knowledge_fts
  on public.maria_knowledge
  using gin (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, '')));

-- IVFFLAT para cosine similarity sobre el vector de 1536 dims.
-- `lists = 100` es un default razonable para tablas <100k filas; tunear
-- después si el dataset crece.
create index if not exists idx_maria_knowledge_embedding
  on public.maria_knowledge
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_maria_knowledge_category
  on public.maria_knowledge (category);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.fn_maria_knowledge_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_maria_knowledge_updated_at on public.maria_knowledge;
create trigger trg_maria_knowledge_updated_at
  before update on public.maria_knowledge
  for each row execute function public.fn_maria_knowledge_set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.maria_knowledge enable row level security;

drop policy if exists "maria_knowledge_public_read" on public.maria_knowledge;
create policy "maria_knowledge_public_read"
  on public.maria_knowledge
  for select
  to anon, authenticated
  using (true);

drop policy if exists "maria_knowledge_admin_write" on public.maria_knowledge;
create policy "maria_knowledge_admin_write"
  on public.maria_knowledge
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.activo = true
        and ur.rol in ('admin', 'abogado', 'tecnico_ambiental')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.activo = true
        and ur.rol in ('admin', 'abogado', 'tecnico_ambiental')
    )
  );

drop policy if exists "maria_knowledge_service_all" on public.maria_knowledge;
create policy "maria_knowledge_service_all"
  on public.maria_knowledge
  for all
  to service_role
  using (true)
  with check (true);

-- ─── RPC: FTS fallback (mantiene compatibilidad con código existente) ───────
create or replace function public.search_maria_knowledge_fts(
  query_text text,
  match_count int default 3
)
returns table (
  id          uuid,
  category    text,
  title       text,
  content     text,
  rank        real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.id,
    k.category,
    k.title,
    k.content,
    ts_rank(
      to_tsvector('spanish', coalesce(k.title, '') || ' ' || coalesce(k.content, '')),
      plainto_tsquery('spanish', coalesce(query_text, ''))
    ) as rank
  from public.maria_knowledge k
  where to_tsvector('spanish', coalesce(k.title, '') || ' ' || coalesce(k.content, ''))
        @@ plainto_tsquery('spanish', coalesce(query_text, ''))
  order by rank desc
  limit greatest(1, least(coalesce(match_count, 3), 10));
$$;

alter function public.search_maria_knowledge_fts(text, int) owner to postgres;

grant execute on function public.search_maria_knowledge_fts(text, int)
  to anon, authenticated, service_role;

-- ─── RPC: semantic search vía embeddings ─────────────────────────────────────
-- `query_embedding` lo genera el caller (en este repo: `lib/maria/embeddings.ts`
-- → OpenAI `text-embedding-3-small`). `match_threshold` 0.7 filtra ruido;
-- bajar a 0.5 si el recall queda demasiado restrictivo en producción.
create or replace function public.match_maria_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 3
)
returns table (
  id          uuid,
  category    text,
  title       text,
  content     text,
  similarity  float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.id,
    k.category,
    k.title,
    k.content,
    (1 - (k.embedding <=> query_embedding))::float as similarity
  from public.maria_knowledge k
  where k.embedding is not null
    and (1 - (k.embedding <=> query_embedding)) > match_threshold
  order by k.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 3), 10));
$$;

alter function public.match_maria_knowledge(vector, float, int) owner to postgres;

grant execute on function public.match_maria_knowledge(vector, float, int)
  to anon, authenticated, service_role;
