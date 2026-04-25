-- Workflow engine schema (final state)
-- Run migrations 001, 002, 003 on existing databases

create table fases (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden  int not null unique
);

-- Explicit transition graph — each edge carries a condition blob
create table transiciones_fase (
  id               uuid primary key default gen_random_uuid(),
  fase_origen_id   uuid references fases(id) on delete cascade,
  fase_destino_id  uuid references fases(id) on delete cascade,
  condicion        jsonb not null default '{}',
  unique (fase_origen_id, fase_destino_id)
);

create table expedientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  fase_actual_id uuid references fases(id),
  created_at     timestamp default now()
);

create table pagos (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references expedientes(id),
  fase_id       uuid references fases(id),
  monto         numeric,
  estado        text default 'pendiente',
  created_at    timestamp default now()
);

-- Full phase history per expediente
create table expediente_fases (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references expedientes(id) on delete cascade,
  fase_id       uuid references fases(id),
  entrada_en    timestamp default now(),
  salida_en     timestamp,
  ingresado_por uuid
);

create table registro_auditoria (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid,
  user_id       uuid,
  accion        text,
  metadata      jsonb,
  created_at    timestamp default now()
);

-- Default MAPE / CHT workflow fases
insert into fases (nombre, orden) values
  ('INHGEOMIN',   1),
  ('Publicación', 2),
  ('Oposición',   3),
  ('SERNA',       4);

-- Seed transition graph: payment required on every edge
insert into transiciones_fase (fase_origen_id, fase_destino_id, condicion)
select f.id, t.id, '{"requiere_pago": true}'::jsonb
from fases f
join fases t on t.orden = f.orden + 1;
