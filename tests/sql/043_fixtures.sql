-- tests/sql/043_fixtures.sql — esquema MÍNIMO para probar la migración 043
-- contra un PostgreSQL local/CI (NO es Supabase, NO toca producción).
--
-- Stubs de lo que 043 asume ya existente: auth.users + auth.uid() (lee la
-- GUC app.uid que el test fija con set_config), los roles de PostgREST
-- (anon / authenticated / service_role, NOLOGIN), user_roles (005), clientes
-- (008/038), minas (040), expedientes + documentos (004/038/011),
-- configuracion_sistema + roles (006) y public.is_internal_staff() copiada
-- textualmente de 041. Se ejecuta UNA vez; después el test aplica 043 dos
-- veces (idempotencia) y carga tests/sql/043_seed.sql.
--
-- Parte de cero: borra public y auth para que cada corrida sea reproducible.

drop schema if exists public cascade;
create schema public;
grant usage on schema public to public;

drop schema if exists auth cascade;
create schema auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

-- auth.users (solo id) y auth.uid() que lee la sesión simulada.
create table auth.users (
  id    uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.uid', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- 005: user_roles (CHECK original de 4 roles — 043 lo reemplaza).
create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rol        text not null default 'cliente',
  perfil_id  uuid,
  activo     boolean not null default true,
  created_at timestamp default now(),
  constraint user_roles_rol_check check (
    rol in ('admin', 'abogado', 'tecnico_ambiental', 'cliente')
  )
);
alter table public.user_roles enable row level security;
create policy "Users can read own role" on public.user_roles for select using (user_id = auth.uid());
grant select on public.user_roles to authenticated, service_role;

-- 006: roles + configuracion_sistema.
create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  nombre       text unique not null,
  descripcion  text,
  permisos     jsonb not null default '[]',
  es_sistema   boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamp default now()
);
insert into public.roles (nombre, descripcion, permisos, es_sistema) values
  ('admin', 'Administrador', '["*"]', true),
  ('abogado', 'Abogado', '[]', true),
  ('tecnico_ambiental', 'Técnico', '[]', true),
  ('cliente', 'Cliente', '["portal:read"]', true);

create table public.configuracion_sistema (
  clave       text primary key,
  valor       text,
  tipo        text not null default 'texto',
  descripcion text,
  updated_at  timestamp default now()
);
alter table public.configuracion_sistema enable row level security;

-- 008/038: clientes (id, user_id) con la policy de lectura propia de 008.
create table public.clientes (
  id       uuid primary key default gen_random_uuid(),
  nombre   text,
  dpi      text,
  user_id  uuid references auth.users(id) on delete set null
);
alter table public.clientes enable row level security;
create policy "Clientes read own" on public.clientes for select to authenticated using (user_id = auth.uid());
grant select on public.clientes to authenticated;

-- 040: minas.
create table public.minas (
  id     uuid primary key default gen_random_uuid(),
  nombre text
);

-- 004/038 + 011: expedientes + documentos (RLS como deja 041: solo staff;
-- aquí sin policies de staff — basta para probar la policy de planta).
create table public.expedientes (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  nombre     text
);
alter table public.expedientes enable row level security;
grant select on public.expedientes to authenticated;

create table public.documentos (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references public.expedientes(id) on delete cascade,
  nombre        text
);
alter table public.documentos enable row level security;
grant select on public.documentos to authenticated;

-- 041: is_internal_staff() (copia textual).
create or replace function public.is_internal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.activo
       and ur.rol in ('admin', 'abogado', 'tecnico_ambiental')
  );
$$;
alter function public.is_internal_staff() owner to postgres;
revoke execute on function public.is_internal_staff() from public;
grant  execute on function public.is_internal_staff() to authenticated, service_role;
