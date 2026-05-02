-- 009: Broadcast & intelligence system
-- Adds: usuarios_broadcast, daily_report_config, precios_diarios, broadcast_log

-- ─── Broadcast subscribers (independent of clientes/auth) ────────────────────
create table if not exists usuarios_broadcast (
  id           uuid primary key default gen_random_uuid(),
  telefono     text not null unique,
  nombre       text,
  rol          text not null default 'minero'
                 constraint usuarios_broadcast_rol_check
                 check (rol in ('minero', 'comprador', 'tecnico', 'admin')),
  activo       boolean not null default true,
  suscrito     boolean not null default true,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone default now()
);

create index if not exists idx_usuarios_broadcast_telefono on usuarios_broadcast(telefono);
create index if not exists idx_usuarios_broadcast_rol on usuarios_broadcast(rol);

-- ─── Daily report metric configuration ───────────────────────────────────────
create table if not exists daily_report_config (
  id           uuid primary key default gen_random_uuid(),
  metric       text not null unique
                 constraint daily_report_config_metric_check
                 check (metric in ('gold', 'silver', 'usd_hnl', 'copper')),
  enabled      boolean not null default true,
  currency     text not null default 'USD'
                 constraint daily_report_config_currency_check
                 check (currency in ('USD', 'HNL')),
  order_index  integer not null default 0,
  updated_by   text,
  updated_at   timestamp with time zone default now()
);

-- Default config rows
insert into daily_report_config (metric, enabled, currency, order_index)
values
  ('gold',    true,  'USD', 1),
  ('silver',  true,  'USD', 2),
  ('usd_hnl', true,  'HNL', 3),
  ('copper',  false, 'USD', 4)
on conflict (metric) do nothing;

-- ─── Price history ────────────────────────────────────────────────────────────
create table if not exists precios_diarios (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null default current_date,
  oro          numeric(12, 4),          -- USD/troy oz
  plata        numeric(12, 4),          -- USD/troy oz
  usd_hnl      numeric(12, 4),          -- exchange rate
  cobre        numeric(12, 4),          -- USD/lb
  fuente       text,
  created_at   timestamp with time zone default now(),
  constraint precios_diarios_fecha_unique unique (fecha)
);

create index if not exists idx_precios_diarios_fecha on precios_diarios(fecha desc);

-- ─── Broadcast execution log ──────────────────────────────────────────────────
create table if not exists broadcast_log (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default current_date,
  precio_id       uuid references precios_diarios(id) on delete set null,
  mensaje_texto   text not null,
  total_enviados  integer not null default 0,
  total_errores   integer not null default 0,
  roles_destino   text[] not null default array['minero','comprador','tecnico','admin'],
  triggered_by    text,                  -- 'cron', 'admin:<phone>', 'manual'
  created_at      timestamp with time zone default now()
);

-- ─── RLS: service role bypasses, anon has no access ──────────────────────────
alter table usuarios_broadcast    enable row level security;
alter table daily_report_config   enable row level security;
alter table precios_diarios       enable row level security;
alter table broadcast_log         enable row level security;

-- Service role accesses all
create policy "service_all_usuarios_broadcast"
  on usuarios_broadcast for all to service_role using (true) with check (true);
create policy "service_all_daily_report_config"
  on daily_report_config for all to service_role using (true) with check (true);
create policy "service_all_precios_diarios"
  on precios_diarios for all to service_role using (true) with check (true);
create policy "service_all_broadcast_log"
  on broadcast_log for all to service_role using (true) with check (true);
