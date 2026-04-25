-- Migration: Replace status-based workflow with phase-based workflow

-- 1. Expedientes: drop status column, add current_phase_id
alter table expedientes
  add column current_phase_id uuid references phases(id);

alter table expedientes
  drop column status;

-- 2. Payments: scope payments to a specific phase
alter table payments
  add column phase_id uuid references phases(id);

-- 3. Audit logs: track which user triggered the action
alter table audit_logs
  add column user_id uuid;

-- 4. Seed default MAPE / CHT workflow phases
insert into phases (name, order_index) values
  ('INHGEOMIN',   1),
  ('Publicación', 2),
  ('Oposición',   3),
  ('SERNA',       4);
