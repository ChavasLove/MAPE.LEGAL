-- Migration 026 — Mining Junior Venture Marketplace: Document Management (Phase 1, admin-only)
--
-- Tables: projects, project_documents, document_chunks, document_tables,
--         investor_project_access, document_access_log
-- Depends: 024 (pgvector extension + the vector(1536) convention).
--
-- Notas operativas (mismas que 023/024/025):
--   * El `service_role` de este proyecto NO tiene BYPASSRLS. Por eso cada
--     tabla lleva una policy `<t>_service_all` (FOR ALL TO service_role) y los
--     RPCs son `SECURITY DEFINER` con owner = `postgres`. Sin esto, los writes
--     del cliente service-role (subida de documentos, inserción de chunks)
--     fallarían en silencio (UPDATE/INSERT afecta 0 filas).
--   * Embeddings: OpenAI `text-embedding-3-small` → vector(1536) (igual que
--     `maria_knowledge`). El serializador canónico es `toVectorText()` en
--     `lib/maria/embeddings.ts`.
--   * Fase 1 es admin-only: TODO acceso pasa por rutas `/api/admin/marketplace/*`
--     gateadas con `requireRole('admin')` y el cliente service-role. Por eso las
--     policies de lectura pública/registrada/inversionista quedan DIFERIDAS —
--     se agregan cuando se construyan esas superficies. Hoy solo service_role lee.
--   * Vercel NO aplica migraciones — correr este archivo a mano en Supabase
--     Studio → SQL Editor. La sección de Storage al final también es manual.

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ============================================================
-- 1. PROJECTS (Mining Junior Ventures)
-- ============================================================
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  country         text default 'Honduras',
  region          text,
  municipality    text,
  latitude        decimal(10, 8),
  longitude       decimal(11, 8),
  commodity       text[],
  project_stage   text check (project_stage in (
                    'exploration', 'pre_feasibility', 'feasibility',
                    'development', 'production', 'closure'
                  )),
  tenement_status text check (tenement_status in (
                    'application', 'granted', 'renewal',
                    'surrendered', 'revoked'
                  )),
  company_name    text,
  status          text default 'active' check (status in ('active', 'inactive', 'archived')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_projects_status    on public.projects(status);
create index if not exists idx_projects_stage      on public.projects(project_stage);
create index if not exists idx_projects_commodity   on public.projects using gin(commodity);
create index if not exists idx_projects_location    on public.projects(country, region);

-- ============================================================
-- 2. PROJECT DOCUMENTS
-- ============================================================
create table if not exists public.project_documents (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  title               text not null,
  description         text,
  document_type       text not null check (document_type in (
                        'corporate_governance',
                        'technical_report_43101',
                        'exploration_geological',
                        'permit_license',
                        'environmental_social',
                        'financial',
                        'metallurgy_processing',
                        'maps_spatial'
                      )),
  document_subtype    text,
  original_filename   text not null,
  file_size_bytes     bigint,
  page_count          integer,
  language            text default 'es' check (language in ('es', 'en', 'mixed')),
  storage_bucket      text default 'project-documents',
  storage_path        text not null,
  file_hash           text,
  permit_number       text,
  report_date         date,
  effective_date      date,
  expiry_date         date,
  ocr_status          text default 'pending' check (ocr_status in (
                        'pending', 'queued', 'processing', 'completed',
                        'failed', 'retrying', 'skipped'
                      )),
  ocr_engine          text default 'mistral_ocr3',
  ocr_confidence      decimal(5,4),
  ocr_text            text,
  processing_metadata jsonb default '{}',
  content_summary     text,
  keywords            text[],
  access_tier         text default 'registered' check (access_tier in (
                        'public', 'registered', 'nda_required', 'authorized'
                      )),
  version             text default '1.0',
  version_notes       text,
  uploaded_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(project_id, storage_path)
);
create index if not exists idx_project_docs_project on public.project_documents(project_id);
create index if not exists idx_project_docs_type    on public.project_documents(document_type);
create index if not exists idx_project_docs_status  on public.project_documents(ocr_status);
create index if not exists idx_project_docs_access  on public.project_documents(access_tier);
create index if not exists idx_project_docs_permit  on public.project_documents(permit_number);
create index if not exists idx_project_docs_date    on public.project_documents(report_date);
-- FTS GIN sobre title+description. `to_tsvector('spanish', ...)` con regconfig
-- constante es IMMUTABLE (mismo patrón que el índice FTS de 024).
create index if not exists idx_project_docs_fts on public.project_documents
    using gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, '')));

-- ============================================================
-- 3. DOCUMENT CHUNKS (extiende el patrón de maria_knowledge)
-- ============================================================
create table if not exists public.document_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.project_documents(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  chunk_index     integer not null,
  total_chunks    integer not null,
  content         text not null,
  content_clean   text,
  embedding       vector(1536),
  is_table        boolean default false,
  table_data      jsonb,
  table_html      text,
  section_title   text,
  breadcrumb      text,
  page_number     integer,
  page_range      integer[],
  parent_chunk_id uuid references public.document_chunks(id) on delete set null,
  parent_content  text,
  chunk_type      text default 'text' check (chunk_type in (
                    'text', 'table', 'heading', 'figure_caption', 'summary'
                  )),
  language        text default 'es',
  metadata        jsonb default '{}',
  search_vector   tsvector,
  created_at      timestamptz default now(),
  unique(document_id, chunk_index)
);
create index if not exists idx_doc_chunks_document on public.document_chunks(document_id);
create index if not exists idx_doc_chunks_project  on public.document_chunks(project_id);
create index if not exists idx_doc_chunks_embedding on public.document_chunks
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_doc_chunks_search   on public.document_chunks using gin(search_vector);
create index if not exists idx_doc_chunks_parent   on public.document_chunks(parent_chunk_id);

-- Auto-update search_vector (FTS ponderado por breadcrumb > section > content)
create or replace function public.fn_document_chunks_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('spanish', coalesce(new.breadcrumb, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(new.section_title, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.content, '')), 'C');
  return new;
end;
$$;
drop trigger if exists trg_doc_chunk_search_vector on public.document_chunks;
create trigger trg_doc_chunk_search_vector
  before insert or update on public.document_chunks
  for each row execute function public.fn_document_chunks_search_vector();

-- ============================================================
-- 4. EXTRACTED TABLES (datos estructurados; población diferida a Fase 2)
-- ============================================================
create table if not exists public.document_tables (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.project_documents(id) on delete cascade,
  chunk_id        uuid references public.document_chunks(id) on delete set null,
  table_index     integer not null,
  page_number     integer,
  caption         text,
  headers         text[] not null,
  rows            jsonb not null,
  row_count       integer,
  column_count    integer,
  html            text,
  table_type      text check (table_type in (
                    'assay', 'drill_log', 'financial',
                    'resource_estimate', 'general'
                  )),
  drill_hole_id   text,
  depth_from      numeric,
  depth_to        numeric,
  assay_elements  jsonb,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);
create index if not exists idx_doc_tables_document on public.document_tables(document_id);
create index if not exists idx_doc_tables_type     on public.document_tables(table_type);
create index if not exists idx_doc_tables_drill    on public.document_tables(drill_hole_id);

-- ============================================================
-- 5. INVESTOR PROJECT ACCESS CONTROL (creada para Fase 2; sin uso en Fase 1)
-- ============================================================
create table if not exists public.investor_project_access (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  access_granted  boolean default false,
  nda_signed      boolean default false,
  nda_signed_at   timestamptz,
  access_level    text default 'read' check (access_level in ('read', 'download', 'full')),
  granted_by      uuid references auth.users(id),
  granted_at      timestamptz default now(),
  expires_at      timestamptz,
  unique(user_id, project_id)
);
create index if not exists idx_investor_access_user    on public.investor_project_access(user_id);
create index if not exists idx_investor_access_project on public.investor_project_access(project_id);

-- ============================================================
-- 6. DOCUMENT ACCESS AUDIT LOG
-- ============================================================
create table if not exists public.document_access_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id),
  document_id     uuid not null references public.project_documents(id),
  project_id      uuid not null references public.projects(id),
  action          text not null check (action in (
                    'view', 'download', 'search', 'ai_query'
                  )),
  ip_address      inet,
  watermark_id    text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);
create index if not exists idx_access_log_document on public.document_access_log(document_id);
create index if not exists idx_access_log_user     on public.document_access_log(user_id);
create index if not exists idx_access_log_project  on public.document_access_log(project_id);
create index if not exists idx_access_log_created  on public.document_access_log(created_at);

-- ============================================================
-- 7. RLS — Fase 1 admin-only: solo service_role (las rutas usan service-role).
--    Las policies de lectura pública/registrada/inversionista se agregan
--    cuando se construyan esas superficies (deferido por decisión de scope).
-- ============================================================
alter table public.projects                enable row level security;
alter table public.project_documents       enable row level security;
alter table public.document_chunks         enable row level security;
alter table public.document_tables         enable row level security;
alter table public.investor_project_access enable row level security;
alter table public.document_access_log     enable row level security;

drop policy if exists "projects_service_all" on public.projects;
create policy "projects_service_all" on public.projects
  for all to service_role using (true) with check (true);

drop policy if exists "project_documents_service_all" on public.project_documents;
create policy "project_documents_service_all" on public.project_documents
  for all to service_role using (true) with check (true);

drop policy if exists "document_chunks_service_all" on public.document_chunks;
create policy "document_chunks_service_all" on public.document_chunks
  for all to service_role using (true) with check (true);

drop policy if exists "document_tables_service_all" on public.document_tables;
create policy "document_tables_service_all" on public.document_tables
  for all to service_role using (true) with check (true);

drop policy if exists "investor_project_access_service_all" on public.investor_project_access;
create policy "investor_project_access_service_all" on public.investor_project_access
  for all to service_role using (true) with check (true);

drop policy if exists "document_access_log_service_all" on public.document_access_log;
create policy "document_access_log_service_all" on public.document_access_log
  for all to service_role using (true) with check (true);

-- ============================================================
-- 8. RPC: Hybrid Search for Document Chunks (SECURITY DEFINER)
-- ============================================================
-- DROP defensivo de todos los overloads previos (mismo patrón que 024).
do $$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args, p.proname
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname in ('search_document_chunks', 'get_parent_document_chunks')
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;

create or replace function public.search_document_chunks(
    p_project_id uuid,
    p_query_embedding vector(1536),
    p_query_text text,
    p_match_threshold float default 0.7,
    p_match_count int default 10,
    p_document_types text[] default null
)
returns table (
    chunk_id uuid,
    document_id uuid,
    content text,
    breadcrumb text,
    section_title text,
    page_number integer,
    similarity float,
    rank real,
    combined_score float,
    is_table boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  semantic_weight float := 0.6;
  fts_weight float := 0.4;
  max_fts_rank real := 1.0;
begin
  select max(ts_rank(dc.search_vector, websearch_to_tsquery('spanish', p_query_text)))
  into max_fts_rank
  from document_chunks dc
  where dc.project_id = p_project_id
    and dc.search_vector @@ websearch_to_tsquery('spanish', p_query_text);

  if max_fts_rank is null or max_fts_rank = 0 then
    max_fts_rank := 1.0;
  end if;

  return query
  with semantic_matches as (
    select
      dc.id, dc.document_id, dc.content, dc.breadcrumb,
      dc.section_title, dc.page_number,
      (1 - (dc.embedding <=> p_query_embedding))::float as similarity,
      dc.is_table
    from document_chunks dc
    where dc.project_id = p_project_id
      and dc.embedding is not null
      and (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
      and (p_document_types is null or
           dc.document_id in (
             select pd.id from project_documents pd
             where pd.document_type = any(p_document_types)
           ))
    order by dc.embedding <=> p_query_embedding
    limit p_match_count * 3
  ),
  fts_matches as (
    select
      dc.id, dc.document_id, dc.content, dc.breadcrumb,
      dc.section_title, dc.page_number,
      0.0::float as similarity,
      ts_rank(dc.search_vector, websearch_to_tsquery('spanish', p_query_text)) as rank_val,
      dc.is_table
    from document_chunks dc
    where dc.project_id = p_project_id
      and dc.search_vector @@ websearch_to_tsquery('spanish', p_query_text)
      and (p_document_types is null or
           dc.document_id in (
             select pd.id from project_documents pd
             where pd.document_type = any(p_document_types)
           ))
    order by rank_val desc
    limit p_match_count * 3
  ),
  combined as (
    select sm.id, sm.document_id, sm.content, sm.breadcrumb,
           sm.section_title, sm.page_number, sm.similarity,
           0.0::real as rank_val, sm.is_table
    from semantic_matches sm
    union all
    select fm.id, fm.document_id, fm.content, fm.breadcrumb,
           fm.section_title, fm.page_number, fm.similarity,
           fm.rank_val::real, fm.is_table
    from fts_matches fm
  )
  -- GROUP BY c.id colapsa los duplicados semantic/fts del mismo chunk; NO se
  -- usa DISTINCT ON (rompería con ORDER BY combined_score).
  select
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.breadcrumb,
    c.section_title,
    c.page_number,
    max(c.similarity) as similarity,
    max(c.rank_val) as rank,
    (semantic_weight * max(c.similarity)) +
    (fts_weight * coalesce(max(c.rank_val), 0) / max_fts_rank) as combined_score,
    c.is_table
  from combined c
  group by c.id, c.document_id, c.content, c.breadcrumb,
           c.section_title, c.page_number, c.is_table
  order by combined_score desc
  limit p_match_count;
end;
$$;

alter function public.search_document_chunks(uuid, vector, text, float, int, text[]) owner to postgres;
grant execute on function public.search_document_chunks(uuid, vector, text, float, int, text[])
  to anon, authenticated, service_role;

-- Parent-document retrieval (chunks vecinos por sección)
create or replace function public.get_parent_document_chunks(p_chunk_id uuid)
returns table (
  chunk_id uuid, content text, breadcrumb text,
  section_title text, chunk_index integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with target as (
    select dc.document_id, dc.section_title, dc.parent_chunk_id
    from document_chunks dc where dc.id = p_chunk_id
  )
  select dc.id, dc.content, dc.breadcrumb, dc.section_title, dc.chunk_index
  from document_chunks dc
  join target t on dc.document_id = t.document_id
  where dc.section_title = t.section_title
     or dc.parent_chunk_id = t.parent_chunk_id
     or dc.id = p_chunk_id
  order by dc.chunk_index;
end;
$$;

alter function public.get_parent_document_chunks(uuid) owner to postgres;
grant execute on function public.get_parent_document_chunks(uuid)
  to anon, authenticated, service_role;

-- ============================================================
-- 9. updated_at trigger
-- ============================================================
create or replace function public.fn_marketplace_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.fn_marketplace_set_updated_at();

drop trigger if exists trg_project_docs_updated_at on public.project_documents;
create trigger trg_project_docs_updated_at
  before update on public.project_documents
  for each row execute function public.fn_marketplace_set_updated_at();

-- ============================================================
-- 10. STORAGE BUCKET (correr en Supabase Studio — privilegios de postgres)
-- ============================================================
-- Bucket privado para PDFs (100 MB/archivo). En Fase 1 todo acceso es
-- server-mediated vía el cliente service-role (subida directa + signed URLs
-- generadas tras requireRole('admin')), así que basta con una policy
-- service_role sobre storage.objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  104857600,  -- 100MB
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

drop policy if exists "marketplace_objects_service_all" on storage.objects;
create policy "marketplace_objects_service_all" on storage.objects
  for all to service_role
  using (bucket_id = 'project-documents')
  with check (bucket_id = 'project-documents');
