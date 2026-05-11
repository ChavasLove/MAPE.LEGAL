-- Migration 023 — Concesiones Mineras: Registro Público (INHGEOMIN)
-- Base de datos pública de concesiones mineras en Honduras transcritas del
-- registro INHGEOMIN. Tres categorías:
--   * explotacion_otorgada   — Concesión Minera Otorgada para Explotación
--   * exploracion_otorgada   — Concesión Minera Otorgada para Exploración
--   * solicitud_pendiente    — Concesión o Pequeña Minería Metálica en Solicitud
--
-- Notas:
--   * El número de migración salta a 023 — 022 ya está tomada por la plantilla
--     de 54 pasos de expediente.
--   * Los datos transcritos son públicos (registro INHGEOMIN); la tabla es
--     readable por anon. Las escrituras requieren admin / abogado /
--     tecnico_ambiental.
--   * La vista `concesiones_mineras_publicas` expone el listado completo a
--     usuarios no autenticados para soporte de la futura página pública
--     /registro y para que María pueda hacer lookups públicos en su flujo de
--     WhatsApp.
--   * RPC `search_concesion_minera(query, categoria, limit)` con
--     SECURITY DEFINER — bypasea RLS al estilo de migración 019 para que el
--     asistente María pueda llamarlo desde el servicio anon-key sin depender
--     de BYPASSRLS en el service_role.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ─── Tabla principal ─────────────────────────────────────────────────────────
create table if not exists public.concesiones_mineras_registro (
  id                  uuid primary key default gen_random_uuid(),
  numero_registro     integer not null,
  codigo              text,
  nombre_zona         text not null,
  fecha_solicitud     date,
  tipo_expediente     text not null,
  solicitante         text not null,
  estado_expediente   text not null,
  clasificacion       text not null,
  categoria           text not null,
  fuente              text not null default 'INHGEOMIN',
  fuente_documento    text,
  fuente_pagina       integer,
  raw_row             jsonb,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint concesiones_categoria_check check (
    categoria in ('explotacion_otorgada', 'exploracion_otorgada', 'solicitud_pendiente')
  ),
  constraint concesiones_clasificacion_check check (
    clasificacion in ('Metálica', 'No Metálica', 'Pequeña Minería Metálica')
  )
);

-- Cada (categoría, numero_registro) es único — la numeración se reinicia por
-- categoría en los documentos fuente.
create unique index if not exists ux_concesiones_categoria_numero
  on public.concesiones_mineras_registro (categoria, numero_registro);

create index if not exists idx_concesiones_categoria
  on public.concesiones_mineras_registro (categoria);

create index if not exists idx_concesiones_estado
  on public.concesiones_mineras_registro (estado_expediente);

create index if not exists idx_concesiones_clasificacion
  on public.concesiones_mineras_registro (clasificacion);

create index if not exists idx_concesiones_solicitante_trgm
  on public.concesiones_mineras_registro using gin (solicitante gin_trgm_ops);

create index if not exists idx_concesiones_zona_trgm
  on public.concesiones_mineras_registro using gin (nombre_zona gin_trgm_ops);

create index if not exists idx_concesiones_codigo
  on public.concesiones_mineras_registro (codigo);

-- updated_at trigger
create or replace function public.fn_concesiones_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_concesiones_updated_at on public.concesiones_mineras_registro;
create trigger trg_concesiones_updated_at
  before update on public.concesiones_mineras_registro
  for each row execute function public.fn_concesiones_set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.concesiones_mineras_registro enable row level security;

-- Lectura pública — es un registro público de INHGEOMIN.
drop policy if exists "concesiones_public_read" on public.concesiones_mineras_registro;
create policy "concesiones_public_read"
  on public.concesiones_mineras_registro
  for select
  to anon, authenticated
  using (true);

-- Escritura sólo admin / abogado / tecnico_ambiental.
drop policy if exists "concesiones_admin_write" on public.concesiones_mineras_registro;
create policy "concesiones_admin_write"
  on public.concesiones_mineras_registro
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

-- service_role debe poder hacer upsert masivo (seed) sin depender de BYPASSRLS.
drop policy if exists "concesiones_service_all" on public.concesiones_mineras_registro;
create policy "concesiones_service_all"
  on public.concesiones_mineras_registro
  for all
  to service_role
  using (true)
  with check (true);

-- ─── Vista pública ───────────────────────────────────────────────────────────
-- Expone el listado canónico para verificación y futura página /registro.
create or replace view public.concesiones_mineras_publicas as
select
  id,
  numero_registro,
  codigo,
  nombre_zona,
  fecha_solicitud,
  tipo_expediente,
  solicitante,
  estado_expediente,
  clasificacion,
  categoria,
  fuente,
  notas
from public.concesiones_mineras_registro;

grant select on public.concesiones_mineras_publicas to anon, authenticated;

-- ─── RPC de búsqueda para María / portal público ─────────────────────────────
-- SECURITY DEFINER al estilo de migración 019: bypasea RLS sin depender de
-- BYPASSRLS en el service_role. María lo llama vía anon-key.
create or replace function public.search_concesion_minera(
  p_query text,
  p_categoria text default null,
  p_clasificacion text default null,
  p_limit int default 10
)
returns table (
  id                  uuid,
  numero_registro     integer,
  codigo              text,
  nombre_zona         text,
  fecha_solicitud     date,
  tipo_expediente     text,
  solicitante         text,
  estado_expediente   text,
  clasificacion       text,
  categoria           text,
  match_rank          real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.numero_registro, c.codigo, c.nombre_zona, c.fecha_solicitud,
    c.tipo_expediente, c.solicitante, c.estado_expediente, c.clasificacion,
    c.categoria,
    greatest(
      similarity(coalesce(c.nombre_zona, ''), coalesce(p_query, '')),
      similarity(coalesce(c.solicitante, ''), coalesce(p_query, ''))
    ) as match_rank
  from public.concesiones_mineras_registro c
  where (
    p_query is null
    or p_query = ''
    or c.nombre_zona ilike '%' || p_query || '%'
    or c.solicitante ilike '%' || p_query || '%'
    or coalesce(c.codigo, '') ilike '%' || p_query || '%'
    or c.numero_registro::text = p_query
  )
  and (p_categoria is null or c.categoria = p_categoria)
  and (p_clasificacion is null or c.clasificacion = p_clasificacion)
  order by match_rank desc nulls last, c.numero_registro asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

alter function public.search_concesion_minera(text, text, text, int) owner to postgres;

grant execute on function public.search_concesion_minera(text, text, text, int)
  to anon, authenticated, service_role;

-- ─── RPC de estadísticas (para el dashboard admin) ───────────────────────────
create or replace function public.concesiones_minera_stats()
returns table (
  total                       bigint,
  explotacion_otorgada        bigint,
  exploracion_otorgada        bigint,
  solicitud_pendiente         bigint,
  metalicas                   bigint,
  no_metalicas                bigint,
  pequena_mineria             bigint,
  ultima_solicitud            date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint                                                              as total,
    count(*) filter (where categoria = 'explotacion_otorgada')::bigint            as explotacion_otorgada,
    count(*) filter (where categoria = 'exploracion_otorgada')::bigint            as exploracion_otorgada,
    count(*) filter (where categoria = 'solicitud_pendiente')::bigint             as solicitud_pendiente,
    count(*) filter (where clasificacion = 'Metálica')::bigint                    as metalicas,
    count(*) filter (where clasificacion = 'No Metálica')::bigint                 as no_metalicas,
    count(*) filter (where clasificacion = 'Pequeña Minería Metálica')::bigint    as pequena_mineria,
    max(fecha_solicitud)                                                          as ultima_solicitud
  from public.concesiones_mineras_registro;
$$;

alter function public.concesiones_minera_stats() owner to postgres;

grant execute on function public.concesiones_minera_stats()
  to anon, authenticated, service_role;
