-- Workflow engine schema (final state)
-- Run migrations 001 + 002 on existing databases

create table phases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null unique
);

-- Explicit transition graph — replaces linear order_index flow
-- condition encodes what must be true before the transition fires
create table phase_transitions (
  id uuid primary key default gen_random_uuid(),
  from_phase_id uuid references phases(id) on delete cascade,
  to_phase_id   uuid references phases(id) on delete cascade,
  condition     jsonb not null default '{}',
  unique (from_phase_id, to_phase_id)
);

create table expedientes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  current_phase_id uuid references phases(id),
  created_at       timestamp default now()
);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes(id),
  phase_id       uuid references phases(id),
  amount         numeric,
  status         text default 'pending',
  created_at     timestamp default now()
);

-- Full phase history per expediente
create table expediente_phases (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes(id) on delete cascade,
  phase_id       uuid references phases(id),
  entered_at     timestamp default now(),
  exited_at      timestamp,
  entered_by     uuid
);

create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid,
  user_id        uuid,
  action         text,
  metadata       jsonb,
  created_at     timestamp default now()
);

-- Default MAPE / CHT workflow phases
insert into phases (name, order_index) values
  ('INHGEOMIN',   1),
  ('Publicación', 2),
  ('Oposición',   3),
  ('SERNA',       4);

-- Seed transition graph: each phase → next, payment required to advance
insert into phase_transitions (from_phase_id, to_phase_id, condition)
select f.id, t.id, '{"requires_payment": true}'::jsonb
from phases f
join phases t on t.order_index = f.order_index + 1;
