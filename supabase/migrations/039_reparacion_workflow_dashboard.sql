-- 039_reparacion_workflow_dashboard.sql — Plan 2, parte 2/3
-- Crea el motor de workflow (fases, transiciones, historial, auditoría,
-- pagos) y las tablas hijas del dashboard (hitos, mensajes_wa,
-- legalidad_items, progress_fases, progress_subpasos) que nunca existieron en
-- producción. Equivale a 001-004 adaptado: los nombres nacen ya en español
-- (producción nunca tuvo las tablas en inglés que 003 renombraba).
--
-- Requiere: 038 aplicada (expedientes ya con numero_expediente / paso /
-- fase_numero / fase_actual_id). Idempotente; sin seeds demo.

-- ═══ 1. Motor de workflow ═══════════════════════════════════════════════════

create table if not exists public.fases (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden  int  not null unique
);

create table if not exists public.transiciones_fase (
  id              uuid primary key default gen_random_uuid(),
  fase_origen_id  uuid references public.fases(id) on delete cascade,
  fase_destino_id uuid references public.fases(id) on delete cascade,
  condicion       jsonb not null default '{}',
  unique (fase_origen_id, fase_destino_id)
);

create table if not exists public.expediente_fases (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references public.expedientes(id) on delete cascade,
  fase_id       uuid references public.fases(id),
  entrada_en    timestamp default now(),
  salida_en     timestamp,
  ingresado_por uuid
);

create table if not exists public.registro_auditoria (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid,
  accion        text not null,
  metadata      jsonb not null default '{}',
  user_id       uuid,
  created_at    timestamptz not null default now()
);

create table if not exists public.pagos (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references public.expedientes(id) on delete cascade,
  fase_id       uuid references public.fases(id),
  monto         numeric(12,2),
  estado        text not null default 'pendiente',
  referencia    text,
  created_at    timestamptz not null default now(),
  constraint pagos_estado_check check (estado in ('pendiente','completado','anulado'))
);

create index if not exists idx_expediente_fases_expediente
  on public.expediente_fases (expediente_id, fase_id);
create index if not exists idx_registro_auditoria_expediente
  on public.registro_auditoria (expediente_id, created_at desc);

-- Seed de fases: las 5 del proceso real (0-4), alineadas con FASE_NOMBRES del
-- dashboard/route.js y con expedientes.fase_actual (int 0-4) de producción.
insert into public.fases (nombre, orden) values
  ('Onboarding',                            0),
  ('Solicitud INHGEOMIN',                   1),
  ('Licencia Ambiental SERNA',              2),
  ('Resolución y Título INHGEOMIN',         3),
  ('Permiso Municipal y Comercializador',   4)
on conflict (orden) do nothing;

-- Grafo secuencial 0→1→2→3→4. condicion '{}' DELIBERADO: aún no existe UI que
-- registre filas en pagos; sembrar {"requiere_pago": true} congelaría todo
-- avance. Endurecer después es un UPDATE a transiciones_fase.condicion.
insert into public.transiciones_fase (fase_origen_id, fase_destino_id, condicion)
select o.id, d.id, '{}'::jsonb
  from public.fases o
  join public.fases d on d.orden = o.orden + 1
on conflict (fase_origen_id, fase_destino_id) do nothing;

-- Backfill de expedientes.fase_actual_id desde el entero fase_actual de
-- producción (vía fase_numero que 038 ya pobló), + FK, + historial inicial.
update public.expedientes e
   set fase_actual_id = f.id
  from public.fases f
 where e.fase_actual_id is null
   and f.orden = e.fase_numero;

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'expedientes_fase_actual_id_fkey'
                    and conrelid = 'public.expedientes'::regclass) then
    alter table public.expedientes
      add constraint expedientes_fase_actual_id_fkey
      foreign key (fase_actual_id) references public.fases(id);
  end if;
end $$;

-- Registro de historial abierto para expedientes que ya están en una fase y
-- no tienen historial (todos, en la primera corrida).
insert into public.expediente_fases (expediente_id, fase_id)
select e.id, e.fase_actual_id
  from public.expedientes e
 where e.fase_actual_id is not null
   and not exists (select 1 from public.expediente_fases ef
                    where ef.expediente_id = e.id);

-- ═══ 2. Tablas hijas del dashboard (migración 004, estructura sin seeds) ════

create table if not exists public.hitos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references public.expedientes(id) on delete cascade,
  numero         int  not null,
  monto          numeric not null,
  porcentaje     int  not null,
  trigger_evento text not null,
  estado         text default 'pendiente',
  referencia     text,
  fecha_cobro    date,
  created_at     timestamp default now(),
  constraint hitos_estado_check check (estado in ('pendiente','cobrado','bloqueado'))
);

create table if not exists public.mensajes_wa (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references public.expedientes(id) on delete cascade,
  cliente        text,
  hora           text,
  archivo        text,
  tipo           text,
  doc_tipo       text,
  estado         text default 'listo',
  documento_id   uuid references public.documentos(id),
  campos         jsonb default '[]',
  created_at     timestamp default now(),
  constraint mensajes_wa_estado_check check (estado in ('listo','procesando','ilegible','verificado','rechazado'))
);

create table if not exists public.legalidad_items (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references public.expedientes(id) on delete cascade,
  nombre         text not null,
  estado         text default 'pendiente',
  orden          int  not null,
  unique (expediente_id, orden)
);

create table if not exists public.progress_fases (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid references public.expedientes(id) on delete cascade,
  nombre            text not null,
  estado            text default 'pendiente',
  pasos             int  default 0,
  total_pasos       int  default 0,
  responsable       text,
  fecha_vencimiento date,
  orden             int  not null
);

create table if not exists public.progress_subpasos (
  id               uuid primary key default gen_random_uuid(),
  progress_fase_id uuid references public.progress_fases(id) on delete cascade,
  nombre           text not null,
  estado           text default 'pendiente',
  orden            int  not null
);

create index if not exists idx_hitos_expediente          on public.hitos (expediente_id);
create index if not exists idx_mensajes_wa_expediente    on public.mensajes_wa (expediente_id);
create index if not exists idx_legalidad_items_expediente on public.legalidad_items (expediente_id);
create index if not exists idx_progress_fases_expediente on public.progress_fases (expediente_id);

-- Grants explícitos (no depender de los default privileges de Supabase —
-- patrón 026/028/035). Paridad con el comportamiento del repo: estas tablas
-- no tienen RLS y dashboardService las lee con el cliente anon.
grant all on public.fases, public.transiciones_fase, public.expediente_fases,
             public.registro_auditoria, public.pagos, public.hitos,
             public.mensajes_wa, public.legalidad_items, public.progress_fases,
             public.progress_subpasos
  to anon, authenticated, service_role;
