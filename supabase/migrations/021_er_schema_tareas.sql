-- 006: Full production ER schema — MAPE.LEGAL Internal Dashboard
-- Adds: clientes, minas, asignaciones, tareas, plantillas_tareas,
--        notificaciones, transacciones_oro, contratos
-- Links expedientes to clientes + minas
-- Author: CHT Development — Briefing Willis Yang, Apr 26 2026

-- ─── CLIENTES ─────────────────────────────────────────────────────────────────
-- Miners (mineros) and landowners (propietarios) are separate records.
-- A single person can be both.
create table if not exists clientes (
  id                  uuid primary key default gen_random_uuid(),
  tipo                text    not null,
  nombre_completo     text    not null,
  rtn                 text,
  dpi                 text,
  telefono            text,
  correo              text,
  municipio           text,
  departamento        text,
  notas               text,
  activo              boolean not null default true,
  created_at          timestamp default now(),
  updated_at          timestamp default now(),
  constraint clientes_tipo_check check (tipo in ('minero', 'propietario', 'ambos'))
);

-- ─── MINAS ────────────────────────────────────────────────────────────────────
-- Central business object. Every expediente is anchored to a mina.
create table if not exists minas (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text    not null,
  cliente_id          uuid    references clientes(id) on delete set null,
  municipio           text,
  departamento        text,
  zona                text,                        -- e.g. "Iriona, Colón"
  coordenadas_utm_x   numeric,
  coordenadas_utm_y   numeric,
  zona_utm            text    default '16N',
  hectareas           numeric,
  tipo_mineral        text    default 'oro',
  categoria_ambiental text    default 'SLAS-2',
  estado_ilo_169      text    not null default 'pendiente',
  activo              boolean not null default true,
  foto_url            text,
  created_at          timestamp default now(),
  updated_at          timestamp default now(),
  constraint minas_categoria_check    check (categoria_ambiental in ('SLAS-1','SLAS-2','SLAS-3')),
  constraint minas_ilo_check          check (estado_ilo_169 in ('pendiente','en_proceso','completado'))
);

-- ─── Extend expedientes with cliente + mina links ─────────────────────────────
alter table expedientes
  add column if not exists cliente_id uuid references clientes(id) on delete set null,
  add column if not exists mina_id    uuid references minas(id)    on delete set null;

-- ─── ASIGNACIONES ─────────────────────────────────────────────────────────────
-- One record per expediente: which abogado + PSA (técnico ambiental) are assigned.
create table if not exists asignaciones (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid not null references expedientes(id) on delete cascade,
  abogado_id      uuid references perfiles_profesionales(id) on delete set null,
  psa_id          uuid references perfiles_profesionales(id) on delete set null,
  fecha_asignacion date default current_date,
  activo          boolean not null default true,
  created_at      timestamp default now(),
  unique (expediente_id)
);

-- ─── PLANTILLAS DE TAREAS ─────────────────────────────────────────────────────
-- Template rows: one per step of the Manual Operativo 2026.
-- Used to instantiate tareas when a new expediente is created.
create table if not exists plantillas_tareas (
  id                   uuid    primary key default gen_random_uuid(),
  proceso              text    not null,       -- 'formalizacion' | 'titulacion' | 'sociedad_minera'
  fase_numero          int     not null,       -- 0–4 for formalizacion, 0 for complementary
  numero_paso          int     not null,
  nombre               text    not null,
  descripcion          text,
  rol_responsable      text    not null,
  plazo_dias           int     not null default 7,
  evidencia_requerida  boolean not null default true,
  evidencia_descripcion text,
  activo               boolean not null default true,
  constraint plantillas_proceso_check check (proceso in ('formalizacion','titulacion','sociedad_minera')),
  constraint plantillas_rol_check     check (rol_responsable in ('admin','abogado','tecnico_ambiental','cliente','externo')),
  unique (proceso, numero_paso)
);

-- ─── TAREAS ───────────────────────────────────────────────────────────────────
-- Instantiated from plantillas_tareas when an expediente is created.
-- One record per step per expediente.
create table if not exists tareas (
  id                    uuid    primary key default gen_random_uuid(),
  expediente_id         uuid    not null references expedientes(id) on delete cascade,
  plantilla_id          uuid    references plantillas_tareas(id),
  proceso               text    not null,
  fase_numero           int     not null,
  numero_paso           int     not null,
  nombre                text    not null,
  descripcion           text,
  rol_responsable       text    not null,
  estado                text    not null default 'pendiente',
  plazo_dias            int,
  fecha_limite          date,
  evidencia_requerida   boolean not null default true,
  evidencia_descripcion text,
  evidencia_url         text,
  completado_por_id     uuid    references perfiles_profesionales(id),
  completado_en         timestamp,
  notas                 text,
  created_at            timestamp default now(),
  updated_at            timestamp default now(),
  constraint tareas_estado_check   check (estado in ('pendiente','en_progreso','completado','bloqueado')),
  constraint tareas_proceso_check  check (proceso in ('formalizacion','titulacion','sociedad_minera')),
  constraint tareas_rol_check      check (rol_responsable in ('admin','abogado','tecnico_ambiental','cliente','externo')),
  unique (expediente_id, proceso, numero_paso)
);

-- ─── CONTRATOS ────────────────────────────────────────────────────────────────
create table if not exists contratos (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid references expedientes(id) on delete cascade,
  tipo            text not null,
  fecha_firma     date,
  monto_total     numeric,
  moneda          text default 'HNL',
  estado          text not null default 'borrador',
  notas           text,
  documento_url   text,
  created_at      timestamp default now(),
  updated_at      timestamp default now(),
  constraint contratos_tipo_check   check (tipo in ('formalizacion','titulacion','sociedad_minera')),
  constraint contratos_estado_check check (estado in ('borrador','firmado','activo','completado','cancelado'))
);

-- ─── NOTIFICACIONES ───────────────────────────────────────────────────────────
create table if not exists notificaciones (
  id              uuid    primary key default gen_random_uuid(),
  expediente_id   uuid    references expedientes(id) on delete cascade,
  tarea_id        uuid    references tareas(id) on delete set null,
  usuario_id      uuid    references auth.users(id),
  tipo            text    not null,
  titulo          text    not null,
  cuerpo          text,
  leida           boolean not null default false,
  created_at      timestamp default now(),
  constraint notificaciones_tipo_check check (tipo in ('wa','sistema','email','tarea'))
);

-- ─── TRANSACCIONES DE ORO ────────────────────────────────────────────────────
create table if not exists transacciones_oro (
  id                 uuid    primary key default gen_random_uuid(),
  expediente_id      uuid    references expedientes(id) on delete set null,
  mina_id            uuid    references minas(id) on delete set null,
  cliente_id         uuid    references clientes(id) on delete set null,
  fecha_transaccion  date    not null,
  peso_gramos        numeric not null,
  ley_quilates       numeric,
  precio_por_gramo   numeric,
  monto_total        numeric,
  moneda             text    default 'HNL',
  coordenadas_utm_x  numeric,
  coordenadas_utm_y  numeric,
  foto_url           text,
  numero_serie       text    unique,
  estado             text    not null default 'pendiente',
  verificado_por_id  uuid    references perfiles_profesionales(id),
  verificado_en      timestamp,
  created_at         timestamp default now(),
  constraint transacciones_estado_check check (estado in ('pendiente','verificado','rechazado'))
);

-- ─── RLS — enable on all new tables ──────────────────────────────────────────
alter table clientes            enable row level security;
alter table minas               enable row level security;
alter table asignaciones        enable row level security;
alter table plantillas_tareas   enable row level security;
alter table tareas              enable row level security;
alter table contratos           enable row level security;
alter table notificaciones      enable row level security;
alter table transacciones_oro   enable row level security;

-- CHT staff (admin, abogado, tecnico_ambiental) can do everything.
-- The helper function checks user_roles table.
create or replace function is_cht_staff()
returns boolean language sql security definer as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and rol in ('admin','abogado','tecnico_ambiental')
      and activo = true
  );
$$;

do $$ declare tbl text; begin
  foreach tbl in array array[
    'clientes','minas','asignaciones','plantillas_tareas',
    'tareas','contratos','notificaciones','transacciones_oro'
  ] loop
    execute format(
      'create policy "CHT staff full access on %1$I"
       on %1$I for all using (is_cht_staff())', tbl
    );
  end loop;
end $$;

-- Own notifications
create policy "Users read own notifications"
  on notificaciones for select
  using (usuario_id = auth.uid());
