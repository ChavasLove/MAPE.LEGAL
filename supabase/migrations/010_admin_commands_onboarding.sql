-- 010: Admin command audit log + onboarding state machine
-- Fixes missing columns on clientes used by route.js since day 1.
-- Required by: services/adminCommandService.ts, services/onboardingService.ts

-- ─── Fix clientes columns missing from migration 008 DDL ─────────────────────
-- route.js queries/inserts these columns — using IF NOT EXISTS so this is safe
-- to apply on databases where they were added manually as a hotfix.
alter table clientes add column if not exists telefono_whatsapp text;
alter table clientes add column if not exists situacion_tierra  text;
alter table clientes add column if not exists tipo_mineral      text default 'oro';

create index if not exists idx_clientes_telefono_whatsapp
  on clientes (telefono_whatsapp);

-- ─── Seed broadcast config keys (safe upsert) ────────────────────────────────
-- Keys used by configService.updateAudience() and configService.updateSchedule()
insert into configuracion_sistema (clave, valor, tipo, descripcion)
values
  ('broadcast_audience', 'minero,comprador,tecnico,admin', 'texto',
   'Roles que reciben el reporte diario (separados por coma)'),
  ('broadcast_time',     '07:00',                         'texto',
   'Hora de envio del reporte diario (HH:MM, formato 24h)')
on conflict (clave) do nothing;

-- ─── Admin action audit log ───────────────────────────────────────────────────
create table if not exists admin_actions (
  id           uuid    primary key default gen_random_uuid(),
  user_phone   text    not null,
  command_type text    not null,
  payload      jsonb   not null default '{}',
  success      boolean not null default true,
  error_msg    text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_admin_actions_user_phone
  on admin_actions (user_phone, created_at desc);
create index if not exists idx_admin_actions_command_type
  on admin_actions (command_type);

-- ─── Onboarding state machine ─────────────────────────────────────────────────
create table if not exists onboarding_states (
  id         uuid primary key default gen_random_uuid(),
  telefono   text not null unique,
  estado     text not null default 'ASK_NAME'
               constraint onboarding_estado_check
               check (estado in ('ASK_NAME','ASK_ID','ASK_LOCATION','ASK_ROLE','COMPLETE')),
  datos      jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_states_telefono
  on onboarding_states (telefono);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table admin_actions     enable row level security;
alter table onboarding_states enable row level security;

create policy "service_all_admin_actions"
  on admin_actions for all to service_role using (true) with check (true);
create policy "service_all_onboarding_states"
  on onboarding_states for all to service_role using (true) with check (true);
