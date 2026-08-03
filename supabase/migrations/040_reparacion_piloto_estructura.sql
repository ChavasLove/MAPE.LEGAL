-- 040_reparacion_piloto_estructura.sql — Plan 2, parte 3/3
-- Estructura del piloto core (migración 008) que nunca existió en producción:
-- minas, contratos, transacciones_oro y el indice_legalidad del modelo del
-- repo (el de producción quedó preservado como indice_legalidad_legacy en
-- 038). DDL idéntica a 008 con dos diferencias deliberadas:
--   1. SIN datos demo (008 sembraba 4 clientes y 4 minas ficticios — con
--      autoridades visitando la plataforma, los estados vacíos son honestos).
--   2. Policies con drop-if-exists (008 no las gateaba) y SIN las policies de
--      las tablas de María (032 es la canónica para esas).
--
-- Requiere: 038 y 039 aplicadas. Idempotente.

-- ═══ Minas ══════════════════════════════════════════════════════════════════
create table if not exists public.minas (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references public.clientes(id) on delete cascade,
  nombre          text not null,
  codigo          text unique,
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

-- ═══ Contratos ══════════════════════════════════════════════════════════════
create table if not exists public.contratos (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid references public.expedientes(id) on delete set null,
  cliente_id        uuid references public.clientes(id) on delete restrict,
  mina_id           uuid references public.minas(id) on delete set null,
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

-- ═══ Índice de Legalidad (modelo del repo: mina_id + componente) ════════════
create table if not exists public.indice_legalidad (
  id              uuid primary key default gen_random_uuid(),
  mina_id         uuid references public.minas(id) on delete cascade,
  expediente_id   uuid references public.expedientes(id) on delete set null,
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

-- ═══ Transacciones de Oro ═══════════════════════════════════════════════════
create table if not exists public.transacciones_oro (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid references public.clientes(id) on delete restrict,
  mina_id          uuid references public.minas(id) on delete restrict,
  expediente_id    uuid references public.expedientes(id) on delete set null,
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

-- ═══ Índices (migración 008) ════════════════════════════════════════════════
create index if not exists idx_minas_cliente_id            on public.minas (cliente_id);
create index if not exists idx_contratos_cliente_id        on public.contratos (cliente_id);
create index if not exists idx_contratos_expediente_id     on public.contratos (expediente_id);
create index if not exists idx_indice_legalidad_mina_id    on public.indice_legalidad (mina_id);
create index if not exists idx_transacciones_oro_cliente_id on public.transacciones_oro (cliente_id);
create index if not exists idx_transacciones_oro_fecha     on public.transacciones_oro (fecha desc);

-- Grants explícitos (la RLS de abajo restringe encima de ellos; sin grant,
-- hasta el service_role quedaría fuera — no depender de defaults).
grant all on public.minas, public.contratos, public.indice_legalidad,
             public.transacciones_oro
  to anon, authenticated, service_role;

-- ═══ RLS + policies (migración 008, con guards) ═════════════════════════════
alter table public.minas             enable row level security;
alter table public.contratos         enable row level security;
alter table public.indice_legalidad  enable row level security;
alter table public.transacciones_oro enable row level security;

do $$
begin
  -- minas
  drop policy if exists "Admins manage minas"        on public.minas;
  drop policy if exists "Profesionales read minas"   on public.minas;
  drop policy if exists "Clientes read own minas"    on public.minas;
  drop policy if exists "Service role all minas"     on public.minas;

  create policy "Admins manage minas" on public.minas for all
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo));
  create policy "Profesionales read minas" on public.minas for select
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid()
                      and ur.rol in ('abogado', 'tecnico_ambiental') and ur.activo));
  create policy "Clientes read own minas" on public.minas for select
    using (exists (select 1 from public.clientes c
                    where c.id = cliente_id and c.user_id = auth.uid()));
  -- El service_role de este proyecto no tiene BYPASSRLS (saga 019/024/025) —
  -- las rutas admin de minas usan getAdminClient(); sin esta policy quedarían
  -- bloqueadas. 008 no la necesitaba en su época; hoy es obligatoria.
  create policy "Service role all minas" on public.minas for all
    to service_role using (true) with check (true);

  -- contratos
  drop policy if exists "Admins manage contratos"      on public.contratos;
  drop policy if exists "Abogados read contratos"      on public.contratos;
  drop policy if exists "Clientes read own contratos"  on public.contratos;
  drop policy if exists "Service role all contratos"   on public.contratos;

  create policy "Admins manage contratos" on public.contratos for all
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo));
  create policy "Abogados read contratos" on public.contratos for select
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid() and ur.rol = 'abogado' and ur.activo));
  create policy "Clientes read own contratos" on public.contratos for select
    using (exists (select 1 from public.clientes c
                    where c.id = cliente_id and c.user_id = auth.uid()));
  create policy "Service role all contratos" on public.contratos for all
    to service_role using (true) with check (true);

  -- indice_legalidad
  drop policy if exists "Admins manage indice_legalidad"        on public.indice_legalidad;
  drop policy if exists "Profesionales manage indice_legalidad" on public.indice_legalidad;
  drop policy if exists "Clientes read own indice_legalidad"    on public.indice_legalidad;
  drop policy if exists "Service role all indice_legalidad"     on public.indice_legalidad;

  create policy "Admins manage indice_legalidad" on public.indice_legalidad for all
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo));
  create policy "Profesionales manage indice_legalidad" on public.indice_legalidad for all
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid()
                      and ur.rol in ('abogado', 'tecnico_ambiental') and ur.activo));
  create policy "Clientes read own indice_legalidad" on public.indice_legalidad for select
    using (exists (select 1 from public.minas m
                    join public.clientes c on c.id = m.cliente_id
                    where m.id = mina_id and c.user_id = auth.uid()));
  create policy "Service role all indice_legalidad" on public.indice_legalidad for all
    to service_role using (true) with check (true);

  -- transacciones_oro
  drop policy if exists "Admins manage transacciones_oro"       on public.transacciones_oro;
  drop policy if exists "Profesionales read transacciones_oro"  on public.transacciones_oro;
  drop policy if exists "Clientes read own transacciones_oro"   on public.transacciones_oro;
  drop policy if exists "Service role all transacciones_oro"    on public.transacciones_oro;

  create policy "Admins manage transacciones_oro" on public.transacciones_oro for all
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo));
  create policy "Profesionales read transacciones_oro" on public.transacciones_oro for select
    using (exists (select 1 from public.user_roles ur
                    where ur.user_id = auth.uid()
                      and ur.rol in ('abogado', 'tecnico_ambiental') and ur.activo));
  create policy "Clientes read own transacciones_oro" on public.transacciones_oro for select
    using (exists (select 1 from public.clientes c
                    where c.id = cliente_id and c.user_id = auth.uid()));
  create policy "Service role all transacciones_oro" on public.transacciones_oro for all
    to service_role using (true) with check (true);
end $$;
