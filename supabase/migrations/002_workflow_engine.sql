-- Migration: Add explicit transition graph and phase history

-- 1. Explicit transition graph
create table phase_transitions (
  id            uuid primary key default gen_random_uuid(),
  from_phase_id uuid references phases(id) on delete cascade,
  to_phase_id   uuid references phases(id) on delete cascade,
  condition     jsonb not null default '{}',
  unique (from_phase_id, to_phase_id)
);

-- 2. Phase history per expediente
create table expediente_phases (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references expedientes(id) on delete cascade,
  phase_id      uuid references phases(id),
  entered_at    timestamp default now(),
  exited_at     timestamp,
  entered_by    uuid
);

-- 3. Seed transition graph from existing order_index relationships
insert into phase_transitions (from_phase_id, to_phase_id, condition)
select f.id, t.id, '{"requires_payment": true}'::jsonb
from phases f
join phases t on t.order_index = f.order_index + 1;
