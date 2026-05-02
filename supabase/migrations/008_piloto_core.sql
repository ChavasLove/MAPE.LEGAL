-- 008: Pilot core tables — Iriona 2026
-- Adds: clientes, minas, contratos, indice_legalidad, transacciones_oro
-- Adds: conversaciones_whatsapp, transacciones_pendientes (used by María bot)

-- ─── Clientes ─────────────────────────────────────────────────────────────────
-- Physical minero entity. Exists independently of an auth.users account;
-- user_id is linked once the client activates their portal account.
create table if not exists clientes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  nombre         text not null,
  dpi            text,
  rtn            text,
  telefono       text,
  email          text,
  municipio      text,
  departamento   text,
  tipo_minero    text not null default 'artesanal',
  activo         boolean not null default true,
  notas          text,
  created_at     timestamp with time zone default now(),
  updated_at     timestamp with time zone default now(),
  constraint clientes_tipo_minero_check check (
    tipo_minero in ('artesanal', 'pequena_escala', 'mediana_empresa')
  )
);

-- ─── Minas ────────────────────────────────────────────────────────────────────
create table if not exists minas (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references clientes(id) on delete cascade,
  nombre          text not null,
  codigo          text unique,                  -- e.g. MINA-2026-001
  latitud         numeric(10, 6),
  longitud        numeric(10, 6),
  municipio       text,
  departamento    text,
  area_hectareas  numeric(10, 2),
  tipo_mineral    text not null default 'oro',
  tipo_concesion  text not null default 'artesanal',
  estado          text not null default 'en_tramite',
  created_at      timestamp with time zone default now(),
  constraint minas_tipo_mineral_check check (
    tipo_mineral in ('oro', 'plata', 'cobre', 'zinc', 'plomo', 'otro')
  ),
  constraint minas_tipo_concesion_check check (
    tipo_concesion in ('artesanal', 'exploracion', 'explotacion')
  ),
  constraint minas_estado_check check (
    estado in ('en_tramite', 'activa', 'suspendida', 'clausurada')
  )
);

-- ─── Contratos ────────────────────────────────────────────────────────────────
create table if not exists contratos (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid references expedientes(id) on delete set null,
  cliente_id        uuid references clientes(id) on delete restrict,
  mina_id           uuid references minas(id) on delete set null,
  tipo              text not null,
  fecha_firma       date,
  fecha_vencimiento date,
  monto_total       numeric(12, 2),
  moneda            text not null default 'HNL',
  estado            text not null default 'activo',
  notas             text,
  documento_url     text,
  created_at        timestamp with time zone default now(),
  updated_at        timestamp with time zone default now(),
  constraint contratos_tipo_check check (
    tipo in ('formalizacion_mape', 'consultoria', 'representacion_legal', 'estudio_ambiental', 'otro')
  ),
  constraint contratos_moneda_check check (moneda in ('HNL', 'USD')),
  constraint contratos_estado_check check (
    estado in ('borrador', 'activo', 'completado', 'rescindido', 'vencido')
  )
);

-- ─── Índice de Legalidad ──────────────────────────────────────────────────────
-- Five-component legality index per mina with per-component scoring (0–20 each,
-- 100 max). Complements the per-expediente legalidad_items snapshot.
create table if not exists indice_legalidad (
  id              uuid primary key default gen_random_uuid(),
  mina_id         uuid references minas(id) on delete cascade,
  expediente_id   uuid references expedientes(id) on delete set null,
  componente      text not null,
  estado          text not null default 'pendiente',
  puntaje         int  not null default 0,
  notas           text,
  verificado_por  uuid references auth.users(id) on delete set null,
  verificado_en   timestamp with time zone,
  created_at      timestamp with time zone default now(),
  updated_at      timestamp with time zone default now(),
  unique (mina_id, componente),
  constraint indice_legalidad_componente_check check (
    componente in ('tierra', 'inhgeomin', 'ambiental', 'municipal', 'registro')
  ),
  constraint indice_legalidad_estado_check check (
    estado in ('pendiente', 'en_proceso', 'cumplido', 'alerta', 'incumplido')
  ),
  constraint indice_legalidad_puntaje_check check (puntaje between 0 and 20)
);

-- ─── Transacciones de Oro ─────────────────────────────────────────────────────
-- Gold sold by the client; amounts computed from weight × price × exchange rate.
create table if not exists transacciones_oro (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid references clientes(id) on delete restrict,
  mina_id          uuid references minas(id) on delete restrict,
  expediente_id    uuid references expedientes(id) on delete set null,
  fecha            date not null,
  gramos           numeric(10, 3) not null,
  precio_usd_gramo numeric(8, 4)  not null,
  tasa_cambio_hnl  numeric(8, 4)  not null,
  total_usd        numeric(12, 2) generated always as (gramos * precio_usd_gramo) stored,
  total_hnl        numeric(14, 2) generated always as (gramos * precio_usd_gramo * tasa_cambio_hnl) stored,
  estado           text not null default 'registrada',
  referencia       text,
  notas            text,
  registrado_por   uuid references auth.users(id) on delete set null,
  created_at       timestamp with time zone default now(),
  constraint transacciones_oro_gramos_positivo check (gramos > 0),
  constraint transacciones_oro_precio_positivo  check (precio_usd_gramo > 0),
  constraint transacciones_oro_tasa_positiva    check (tasa_cambio_hnl > 0),
  constraint transacciones_oro_estado_check check (
    estado in ('registrada', 'verificada', 'liquidada', 'auditada', 'impugnada')
  )
);

-- ─── Conversaciones WhatsApp ──────────────────────────────────────────────────
-- Message history for the María virtual assistant (app/api/whatsapp/route.js).
-- Accessed exclusively via service-role key — no direct client access.
create table if not exists conversaciones_whatsapp (
  id               uuid primary key default gen_random_uuid(),
  numero_whatsapp  text not null,
  role             text not null,
  content          text not null,
  created_at       timestamp with time zone default now(),
  constraint conversaciones_whatsapp_role_check check (role in ('user', 'assistant'))
);

create index if not exists idx_conversaciones_whatsapp_numero
  on conversaciones_whatsapp (numero_whatsapp, created_at desc);

-- ─── Transacciones Pendientes ─────────────────────────────────────────────────
-- Short-lived confirmation records created when María responds with "✅ Listo".
create table if not exists transacciones_pendientes (
  id               uuid primary key default gen_random_uuid(),
  numero_whatsapp  text not null,
  estado           text not null default 'pendiente_confirmacion',
  detalle          jsonb not null default '{}',
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now(),
  constraint transacciones_pendientes_estado_check check (
    estado in ('pendiente_confirmacion', 'confirmada', 'cancelada')
  )
);

-- ─── Índices de rendimiento ───────────────────────────────────────────────────
create index if not exists idx_minas_cliente_id
  on minas (cliente_id);
create index if not exists idx_contratos_cliente_id
  on contratos (cliente_id);
create index if not exists idx_contratos_expediente_id
  on contratos (expediente_id);
create index if not exists idx_indice_legalidad_mina_id
  on indice_legalidad (mina_id);
create index if not exists idx_transacciones_oro_cliente_id
  on transacciones_oro (cliente_id);
create index if not exists idx_transacciones_oro_fecha
  on transacciones_oro (fecha desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table clientes              enable row level security;
alter table minas                 enable row level security;
alter table contratos             enable row level security;
alter table indice_legalidad      enable row level security;
alter table transacciones_oro     enable row level security;
alter table conversaciones_whatsapp  enable row level security;
alter table transacciones_pendientes enable row level security;

-- clientes
create policy "Admins manage clientes"
  on clientes for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo
  ));

create policy "Profesionales read clientes"
  on clientes for select
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.rol in ('abogado', 'tecnico_ambiental')
      and ur.activo
  ));

create policy "Clientes read own record"
  on clientes for select
  using (user_id = auth.uid());

-- minas
create policy "Admins manage minas"
  on minas for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo
  ));

create policy "Profesionales read minas"
  on minas for select
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.rol in ('abogado', 'tecnico_ambiental')
      and ur.activo
  ));

create policy "Clientes read own minas"
  on minas for select
  using (exists (
    select 1 from clientes c
    where c.id = cliente_id and c.user_id = auth.uid()
  ));

-- contratos
create policy "Admins manage contratos"
  on contratos for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo
  ));

create policy "Abogados read contratos"
  on contratos for select
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'abogado' and ur.activo
  ));

create policy "Clientes read own contratos"
  on contratos for select
  using (exists (
    select 1 from clientes c
    where c.id = cliente_id and c.user_id = auth.uid()
  ));

-- indice_legalidad
create policy "Admins manage indice_legalidad"
  on indice_legalidad for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo
  ));

create policy "Profesionales manage indice_legalidad"
  on indice_legalidad for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.rol in ('abogado', 'tecnico_ambiental')
      and ur.activo
  ));

create policy "Clientes read own indice_legalidad"
  on indice_legalidad for select
  using (exists (
    select 1 from minas m
    join clientes c on c.id = m.cliente_id
    where m.id = mina_id and c.user_id = auth.uid()
  ));

-- transacciones_oro
create policy "Admins manage transacciones_oro"
  on transacciones_oro for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo
  ));

create policy "Profesionales read transacciones_oro"
  on transacciones_oro for select
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.rol in ('abogado', 'tecnico_ambiental')
      and ur.activo
  ));

create policy "Clientes read own transacciones_oro"
  on transacciones_oro for select
  using (exists (
    select 1 from clientes c
    where c.id = cliente_id and c.user_id = auth.uid()
  ));

-- WhatsApp tables: service-role key only (bot access); no direct auth.uid() path
create policy "Sin acceso directo a conversaciones_whatsapp"
  on conversaciones_whatsapp for all
  using (false);

create policy "Sin acceso directo a transacciones_pendientes"
  on transacciones_pendientes for all
  using (false);

-- ─── Seed — Piloto Iriona 2026 ────────────────────────────────────────────────
-- Creates clientes, minas, contratos, and indice_legalidad rows that match
-- the demo expedientes seeded in 004. Idempotent via unique constraints.
do $$
declare
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  m1 uuid; m2 uuid; m3 uuid; m4 uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid;
begin

  -- look up existing demo expedientes
  select id into e1 from expedientes where numero_expediente = 'EXP-2026-001';
  select id into e2 from expedientes where numero_expediente = 'EXP-2026-007';
  select id into e3 from expedientes where numero_expediente = 'EXP-2026-003';
  select id into e4 from expedientes where numero_expediente = 'EXP-2026-008';

  -- ── Clientes ─────────────────────────────────────────────────────────────────
  insert into clientes (id, nombre, dpi, rtn, telefono, email, municipio, departamento, tipo_minero)
  values
    (gen_random_uuid(), 'Juan Antonio Zelaya',   '0801-1985-01234', '08011985012340', '+504 9901-2345', 'jzelaya@correo.hn',    'Iriona',      'Colón',    'artesanal'),
    (gen_random_uuid(), 'María Isabel López',    '0801-1980-05678', '08011980056780', '+504 9902-3456', 'milopez@correo.hn',   'Trujillo',    'Colón',    'pequena_escala'),
    (gen_random_uuid(), 'Carlos Eduardo Mejía',  '0501-1990-09012', '05011990090120', '+504 9903-4567', 'cemejia@correo.hn',   'El Paraíso',  'Copán',    'artesanal'),
    (gen_random_uuid(), 'Roberto Paz Andino',    '0801-1978-03456', '08011978034560', '+504 9904-5678', 'rpaz@correo.hn',      'Iriona',      'Colón',    'artesanal')
  on conflict do nothing;

  select id into c1 from clientes where email = 'jzelaya@correo.hn';
  select id into c2 from clientes where email = 'milopez@correo.hn';
  select id into c3 from clientes where email = 'cemejia@correo.hn';
  select id into c4 from clientes where email = 'rpaz@correo.hn';

  -- ── Minas ─────────────────────────────────────────────────────────────────────
  if c1 is not null then
    insert into minas (id, cliente_id, nombre, codigo, latitud, longitud, municipio, departamento, area_hectareas, tipo_mineral, tipo_concesion, estado)
    values (gen_random_uuid(), c1, 'Quebrada La Unión', 'MINA-2026-001', 15.2134, -83.7852, 'Iriona', 'Colón', 4.50, 'oro', 'exploracion', 'en_tramite')
    on conflict (codigo) do nothing;
    select id into m1 from minas where codigo = 'MINA-2026-001';
  end if;

  if c2 is not null then
    insert into minas (id, cliente_id, nombre, codigo, latitud, longitud, municipio, departamento, area_hectareas, tipo_mineral, tipo_concesion, estado)
    values (gen_random_uuid(), c2, 'Cerro El Carbón',   'MINA-2026-002', 15.9281, -85.9847, 'Trujillo', 'Colón', 6.80, 'oro', 'explotacion', 'en_tramite')
    on conflict (codigo) do nothing;
    select id into m2 from minas where codigo = 'MINA-2026-002';
  end if;

  if c3 is not null then
    insert into minas (id, cliente_id, nombre, codigo, latitud, longitud, municipio, departamento, area_hectareas, tipo_mineral, tipo_concesion, estado)
    values (gen_random_uuid(), c3, 'Aluvial Copán Norte', 'MINA-2026-003', 15.1023, -89.1445, 'El Paraíso', 'Copán', 2.20, 'oro', 'artesanal', 'en_tramite')
    on conflict (codigo) do nothing;
    select id into m3 from minas where codigo = 'MINA-2026-003';
  end if;

  if c4 is not null then
    insert into minas (id, cliente_id, nombre, codigo, latitud, longitud, municipio, departamento, area_hectareas, tipo_mineral, tipo_concesion, estado)
    values (gen_random_uuid(), c4, 'Río Tinto Norte',   'MINA-2026-004', 15.3390, -83.9104, 'Iriona', 'Colón', 3.10, 'oro', 'exploracion', 'en_tramite')
    on conflict (codigo) do nothing;
    select id into m4 from minas where codigo = 'MINA-2026-004';
  end if;

  -- ── Contratos ─────────────────────────────────────────────────────────────────
  if c1 is not null and e1 is not null and m1 is not null
    and not exists (select 1 from contratos where expediente_id = e1) then
    insert into contratos (expediente_id, cliente_id, mina_id, tipo, fecha_firma, fecha_vencimiento, monto_total, moneda, estado)
    values (e1, c1, m1, 'formalizacion_mape', '2026-04-12', '2027-04-12', 1600000.00, 'HNL', 'activo');
  end if;

  if c2 is not null and e2 is not null and m2 is not null
    and not exists (select 1 from contratos where expediente_id = e2) then
    insert into contratos (expediente_id, cliente_id, mina_id, tipo, fecha_firma, fecha_vencimiento, monto_total, moneda, estado)
    values (e2, c2, m2, 'formalizacion_mape', '2026-02-03', '2027-02-03', 1600000.00, 'HNL', 'activo');
  end if;

  if c3 is not null and e3 is not null and m3 is not null
    and not exists (select 1 from contratos where expediente_id = e3) then
    insert into contratos (expediente_id, cliente_id, mina_id, tipo, fecha_firma, fecha_vencimiento, monto_total, moneda, estado)
    values (e3, c3, m3, 'formalizacion_mape', '2026-04-01', '2027-04-01', 533000.00, 'HNL', 'activo');
  end if;

  if c4 is not null and e4 is not null and m4 is not null
    and not exists (select 1 from contratos where expediente_id = e4) then
    insert into contratos (expediente_id, cliente_id, mina_id, tipo, fecha_firma, fecha_vencimiento, monto_total, moneda, estado)
    values (e4, c4, m4, 'formalizacion_mape', '2026-04-22', '2027-04-22', 1600000.00, 'HNL', 'borrador');
  end if;

  -- ── Índice de legalidad ───────────────────────────────────────────────────────
  -- EXP-2026-001 · Zelaya: tierra=ok(20), inhgeomin=en_proceso(10), rest=pendiente(0)
  if m1 is not null then
    insert into indice_legalidad (mina_id, expediente_id, componente, estado, puntaje) values
      (m1, e1, 'tierra',    'cumplido',   20),
      (m1, e1, 'inhgeomin', 'en_proceso', 10),
      (m1, e1, 'ambiental', 'pendiente',   0),
      (m1, e1, 'municipal', 'pendiente',   0),
      (m1, e1, 'registro',  'pendiente',   0)
    on conflict (mina_id, componente) do nothing;
  end if;

  -- EXP-2026-007 · López: tierra=ok, inhgeomin=alerta, rest=pendiente
  if m2 is not null then
    insert into indice_legalidad (mina_id, expediente_id, componente, estado, puntaje) values
      (m2, e2, 'tierra',    'cumplido',  20),
      (m2, e2, 'inhgeomin', 'alerta',     8),
      (m2, e2, 'ambiental', 'pendiente',  0),
      (m2, e2, 'municipal', 'pendiente',  0),
      (m2, e2, 'registro',  'pendiente',  0)
    on conflict (mina_id, componente) do nothing;
  end if;

  -- EXP-2026-003 · Mejía: all pending (just onboarding)
  if m3 is not null then
    insert into indice_legalidad (mina_id, expediente_id, componente, estado, puntaje) values
      (m3, e3, 'tierra',    'pendiente', 0),
      (m3, e3, 'inhgeomin', 'pendiente', 0),
      (m3, e3, 'ambiental', 'pendiente', 0),
      (m3, e3, 'municipal', 'pendiente', 0),
      (m3, e3, 'registro',  'pendiente', 0)
    on conflict (mina_id, componente) do nothing;
  end if;

  -- EXP-2026-008 · Paz: all pending (just started)
  if m4 is not null then
    insert into indice_legalidad (mina_id, expediente_id, componente, estado, puntaje) values
      (m4, e4, 'tierra',    'pendiente', 0),
      (m4, e4, 'inhgeomin', 'pendiente', 0),
      (m4, e4, 'ambiental', 'pendiente', 0),
      (m4, e4, 'municipal', 'pendiente', 0),
      (m4, e4, 'registro',  'pendiente', 0)
    on conflict (mina_id, componente) do nothing;
  end if;

  -- ── Transacciones de oro de muestra (Zelaya — única mina activa) ─────────────
  if c1 is not null and m1 is not null and e1 is not null
    and not exists (select 1 from transacciones_oro where cliente_id = c1) then
    insert into transacciones_oro (cliente_id, mina_id, expediente_id, fecha, gramos, precio_usd_gramo, tasa_cambio_hnl, estado, referencia)
    values
      (c1, m1, e1, '2026-03-15', 12.500, 85.2500, 24.75, 'liquidada',  'BCH-2026-0142'),
      (c1, m1, e1, '2026-04-01', 18.750, 87.1000, 24.80, 'verificada', 'BCH-2026-0178'),
      (c1, m1, e1, '2026-04-20',  9.300, 86.4000, 24.82, 'registrada', null);
  end if;

end $$;
