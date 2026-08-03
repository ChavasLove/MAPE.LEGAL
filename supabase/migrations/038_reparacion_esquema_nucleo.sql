-- 038_reparacion_esquema_nucleo.sql — Plan 2, parte 1/3
-- Reparación del esquema de producción hacia el esquema del repo (hallazgo
-- 2026-08-03: la base de producción se construyó a mano con un modelo previo
-- al de las migraciones; ver REPORTE del PR #220 y CLAUDE.md §Orden 2026-08).
--
-- ESTE ARCHIVO NO ES PARTE DE LA CADENA 001-037: es el puente que lleva LA
-- BASE DE PRODUCCIÓN REAL (esquema a mano) al contrato que el código espera.
-- Un ambiente nuevo que aplique la cadena completa 001-037 NO necesita
-- 038-040. Precondición: existen public.clientes, public.expedientes,
-- public.documentos e public.indice_legalidad con el esquema a-mano
-- inventariado el 2026-08-03.
--
-- Garantías:
--   - Sin DROP de columnas, sin DELETE de filas (append-only / renames).
--   - Cada rename está gateado (solo corre si la columna vieja existe y la
--     nueva no) — re-ejecutable.
--   - Los backfills solo escriben donde hay NULL — no pisan datos.
--
-- ═══ 1. clientes ════════════════════════════════════════════════════════════
-- Producción: identidad → el código espera dpi. Faltan created_at/updated_at
-- (el reporte ejecutivo ordena por created_at; finalise() escribe updated_at),
-- departamento (el detalle de mina muestra cliente.departamento) y user_id
-- (policies "read own" del esquema del repo).

do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='clientes' and column_name='identidad')
     and not exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='clientes' and column_name='dpi') then
    alter table public.clientes rename column identidad to dpi;
  end if;
end $$;

alter table public.clientes
  add column if not exists dpi          text,
  add column if not exists departamento text,
  add column if not exists telefono     text,
  add column if not exists tipo_minero  text default 'artesanal',
  add column if not exists user_id      uuid references auth.users(id) on delete set null,
  add column if not exists created_at   timestamptz,
  add column if not exists updated_at   timestamptz;

-- Backfill desde fecha_registro (la fecha real de alta) y luego default para
-- filas nuevas. Se agrega SIN default a propósito: con default, el fast-path
-- de PostgreSQL llenaría todas las filas existentes con now() y el backfill
-- histórico nunca aplicaría.
update public.clientes set created_at = coalesce(fecha_registro, now()) where created_at is null;
update public.clientes set updated_at = coalesce(fecha_registro, now()) where updated_at is null;
alter table public.clientes alter column created_at set default now();
alter table public.clientes alter column updated_at set default now();

-- ═══ 2. expedientes ═════════════════════════════════════════════════════════
-- Renames producción → contrato del código.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('numero',                'numero_expediente'),
      ('tipo_servicio',         'tipo'),
      ('fecha_inicio',          'inicio'),
      ('fecha_estimada_cierre', 'cierre_estimado'),
      ('paso_actual',           'paso')
    ) as m(vieja, nueva)
  loop
    if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='expedientes' and column_name=r.vieja)
       and not exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='expedientes' and column_name=r.nueva) then
      execute format('alter table public.expedientes rename column %I to %I', r.vieja, r.nueva);
    end if;
  end loop;
end $$;

-- Columnas del dashboard (paridad con migración 004) + nombre/notas del
-- esquema original del repo + fase_actual_id (el FK y su backfill van en 039,
-- cuando exista la tabla fases). num_expediente_inhgeomin / num_expediente_serna
-- de producción SE CONSERVAN tal cual: son la numeración institucional del
-- expediente (el hallazgo de T2.1/034 — no se duplican ni se renombran).
alter table public.expedientes
  add column if not exists numero_expediente  text,
  add column if not exists nombre             text,
  add column if not exists cliente            text,
  add column if not exists tipo               text,
  add column if not exists municipio          text,
  add column if not exists estado             text default 'activo',
  add column if not exists fase_numero        int,
  add column if not exists paso               int  default 1,
  add column if not exists total_pasos        int  default 6,
  add column if not exists abogado_nombre     text,
  add column if not exists abogado_iniciales  text,
  add column if not exists psa_nombre         text,
  add column if not exists psa_iniciales      text,
  add column if not exists legalidad          int  default 0,
  add column if not exists inicio             date,
  add column if not exists cierre_estimado    date,
  add column if not exists notas              text,
  add column if not exists fase_actual_id     uuid;

-- fase_numero desde la fase_actual (int) de producción. Solo si sigue vacío —
-- una re-ejecución posterior a avances reales no pisa nada.
do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='expedientes' and column_name='fase_actual') then
    update public.expedientes
       set fase_numero = fase_actual
     where fase_numero is null and fase_actual is not null;
  end if;
end $$;
update public.expedientes set fase_numero = 0 where fase_numero is null;

-- cliente (texto) y nombre (título del caso) desde el join real.
update public.expedientes e
   set cliente = c.nombre
  from public.clientes c
 where e.cliente_id = c.id
   and e.cliente is null;

update public.expedientes e
   set nombre = coalesce(
         nullif(concat_ws(' — ', e.cliente, e.tipo), ''),
         e.numero_expediente,
         e.id::text)
 where e.nombre is null;

-- Unique de numero_expediente (contrato de dashboardService) — solo si no hay
-- duplicados; si los hay, se reporta por NOTICE y se resuelve a mano.
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'expedientes_numero_expediente_key'
                    and conrelid = 'public.expedientes'::regclass) then
    if exists (select 1 from public.expedientes
                where numero_expediente is not null
                group by numero_expediente having count(*) > 1) then
      raise notice 'expedientes.numero_expediente tiene duplicados — constraint UNIQUE no creada; resolver duplicados y re-ejecutar.';
    else
      alter table public.expedientes
        add constraint expedientes_numero_expediente_key unique (numero_expediente);
    end if;
  end if;
end $$;

-- ═══ 3. documentos ══════════════════════════════════════════════════════════
-- Producción: nombre_archivo + verificado(boolean). El código pide nombre +
-- estado('faltante'|'pendiente'|'verificado'|'rechazado') + info. Aditivo:
-- las columnas viejas se conservan.
alter table public.documentos
  add column if not exists nombre     text,
  add column if not exists estado     text,
  add column if not exists info       text,
  add column if not exists created_at timestamp,
  add column if not exists updated_at timestamp;

update public.documentos set nombre = coalesce(nombre, nombre_archivo, tipo, 'Documento') where nombre is null;
update public.documentos
   set estado = case when verificado is true then 'verificado' else 'pendiente' end
 where estado is null;
update public.documentos set created_at = coalesce(fecha_recepcion, now()) where created_at is null;
update public.documentos set updated_at = coalesce(fecha_recepcion, now()) where updated_at is null;

alter table public.documentos alter column estado set default 'faltante';
alter table public.documentos alter column created_at set default now();
alter table public.documentos alter column updated_at set default now();

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'documentos_estado_check'
                    and conrelid = 'public.documentos'::regclass) then
    alter table public.documentos
      add constraint documentos_estado_check
      check (estado in ('faltante','pendiente','verificado','rechazado'));
  end if;
end $$;

-- ═══ 4. indice_legalidad → legacy ═══════════════════════════════════════════
-- El modelo de producción (5 booleanos por expediente) es incompatible con el
-- del repo (filas mina_id+componente con puntaje 0-20; migración 008 / API
-- /api/admin/indice-legalidad). Se PRESERVA renombrada; la tabla nueva la
-- crea 040. Gate por forma (columna tierra_titulada), no por nombre —
-- re-ejecutable.
do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='indice_legalidad'
                and column_name='tierra_titulada') then
    alter table public.indice_legalidad rename to indice_legalidad_legacy;
  end if;
end $$;
