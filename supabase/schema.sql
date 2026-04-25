-- Phase-based schema (final state)
-- Run migration 001 on existing databases

create table phases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null unique
);

create table expedientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  current_phase_id uuid references phases(id),
  created_at timestamp default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid references expedientes(id),
  phase_id uuid references phases(id),
  amount numeric,
  status text default 'pending',
  created_at timestamp default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid,
  user_id uuid,
  action text,
  metadata jsonb,
  created_at timestamp default now()
);

-- Default MAPE / CHT workflow phases
insert into phases (name, order_index) values
  ('INHGEOMIN',   1),
  ('Publicación', 2),
  ('Oposición',   3),
  ('SERNA',       4);
