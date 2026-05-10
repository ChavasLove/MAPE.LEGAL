-- Migration 020 — Certificados de Origen (public verification surface)
-- Phase 1 of mape.legal public surface realignment.
-- Adds the table that backs /verificar/[numero] and /api/verificar/[numero].
-- RLS: public can read only via the certificados_origen_publicos VIEW.
--
-- Notes for application:
--   * Migration number bumped from 010 → 020 because 010 is already taken by
--     010_admin_commands_onboarding.sql.
--   * The public view exposes m.codigo (e.g. MINA-2026-001) as
--     mina_codigo because public.minas does not have a column named
--     permiso_inhgeomin in the actual 008 schema.
--   * Role names match migration 005: 'admin', 'abogado', 'tecnico_ambiental'.

create extension if not exists "pgcrypto";

create table if not exists public.certificados_origen (
  id                uuid primary key default gen_random_uuid(),
  numero_certificado text not null unique,
  mina_id           uuid references public.minas(id) on delete restrict,
  expediente_id     uuid references public.expedientes(id) on delete restrict,
  fecha_emision     date not null,
  peso_oro_g        numeric(12,3) not null check (peso_oro_g > 0),
  ley_oro_kt        numeric(4,2) check (ley_oro_kt is null or (ley_oro_kt > 0 and ley_oro_kt <= 24)),
  precio_lbma_usd   numeric(12,2),
  estado            text not null check (estado in ('vigente','revocado','expirado','suspendido')),
  valido_hasta      date not null,
  hash_verificacion text not null,
  emitido_por       uuid references auth.users(id),
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_certificados_numero on public.certificados_origen (numero_certificado);
create index if not exists idx_certificados_mina   on public.certificados_origen (mina_id);
create index if not exists idx_certificados_estado on public.certificados_origen (estado);

-- updated_at trigger
create or replace function public.fn_certificados_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_certificados_updated_at on public.certificados_origen;
create trigger trg_certificados_updated_at
  before update on public.certificados_origen
  for each row execute function public.fn_certificados_set_updated_at();

-- Row Level Security
alter table public.certificados_origen enable row level security;

-- Authenticated admin / abogado / tecnico_ambiental can read the base table.
drop policy if exists "admin_abogado_read_certificados" on public.certificados_origen;
create policy "admin_abogado_read_certificados"
  on public.certificados_origen
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.activo = true
        and ur.rol in ('admin','abogado','tecnico_ambiental')
    )
  );

-- Only admin / abogado can insert/update/delete.
drop policy if exists "admin_abogado_write_certificados" on public.certificados_origen;
create policy "admin_abogado_write_certificados"
  on public.certificados_origen
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.activo = true
        and ur.rol in ('admin','abogado')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.activo = true
        and ur.rol in ('admin','abogado')
    )
  );

-- Public verification view — exposes only safe, non-PII fields.
-- mina_codigo is the closest equivalent to "INHGEOMIN permit number" available
-- in the current minas schema (column 'codigo', e.g. MINA-2026-001).
create or replace view public.certificados_origen_publicos as
select
  c.numero_certificado,
  c.fecha_emision,
  c.peso_oro_g,
  c.estado,
  c.valido_hasta,
  c.hash_verificacion,
  m.nombre        as mina_nombre,
  m.codigo        as mina_codigo,
  m.municipio     as mina_municipio,
  m.departamento  as mina_departamento
from public.certificados_origen c
left join public.minas m on m.id = c.mina_id;

grant select on public.certificados_origen_publicos to anon, authenticated;

-- Demo certificate — clearly marked, only inserted when source rows exist.
do $$
declare
  v_mina_id uuid;
  v_expediente_id uuid;
begin
  if exists (select 1 from public.certificados_origen where numero_certificado = 'CO-2026-0001-DEMO') then
    return;
  end if;

  select id into v_mina_id from public.minas order by created_at asc limit 1;
  select id into v_expediente_id from public.expedientes order by created_at asc limit 1;

  if v_mina_id is null or v_expediente_id is null then
    raise notice '[migration 020] Skipping demo certificate insert — minas or expedientes table is empty in this environment.';
    return;
  end if;

  insert into public.certificados_origen (
    numero_certificado, mina_id, expediente_id, fecha_emision,
    peso_oro_g, ley_oro_kt, estado, valido_hasta, hash_verificacion, notas
  ) values (
    'CO-2026-0001-DEMO',
    v_mina_id,
    v_expediente_id,
    current_date,
    100.000,
    22.00,
    'vigente',
    current_date + interval '365 days',
    'demo-hash-not-for-production',
    'Registro de demostración para validar el portal público de verificación. No representa una transacción real.'
  );
end $$;
