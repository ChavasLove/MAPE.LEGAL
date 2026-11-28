-- 044_publicaciones_marketplace.sql — Marketplace abierto de PUBLICACIONES de
-- los participantes (DEC-2026-11-27-2): cada participante publica su
-- producción estimada y sus precios de compra y venta. CHT NO carga esos
-- precios ni los usa para sustituir el precio informativo del oro.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ NO APLICAR. Esta migración NO se aplica hasta que Willis lo decida.      ║
-- ║ Vercel no ejecuta SQL. Si se aprueba, la aplica un humano en Supabase    ║
-- ║ Studio → SQL Editor, DESPUÉS de 041 (necesita is_internal_staff()) y     ║
-- ║ 043 (no la referencia, pero es el siguiente número de la cadena), de un  ║
-- ║ RESPALDO (el proyecto no tiene backups automáticos — ver                 ║
-- ║ docs/plan2-runbook-produccion.md) y de la aprobación expresa de Willis.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- QUÉ NO ES. No es el mercado de documentos de ventures (026, project_*), ni el
-- mercado de equipos (027, equipos_mercado), ni precios_diarios / precios_referencia
-- (precio informativo del oro, que sigue siendo oro × tipo de compra del BCH ÷
-- 31.1034768, sin factor). No se reutilizan ni se alteran esas tablas.
--
-- CONTRATO. Estados, tipos, unidades y monedas son los de
-- lib/publicaciones/types.ts (fuente única en TypeScript; las reglas puras se
-- prueban en tests/publicaciones.test.ts). Si cambiás uno, cambiá los dos.
--
-- MODELO MÍNIMO Y SOBRIO.
--   publicaciones_marketplace
--     autor (auth.users) + nombre público del participante y su tipo
--     tipo de publicación: produccion | compra | venta | mixta
--     producción estimada (cantidad + unidad) — opcional
--     precio de compra y precio de venta (cantidad + moneda + unidad) — opcionales
--     ley en kilates a la que refiere el precio — opcional
--     vigencia (desde / hasta), estado (borrador | publicada | retirada), timestamps
--   Al menos un dato (producción, precio de compra o precio de venta) es obligatorio.
--   Nada de márgenes de CHT, nada de compradores nombrados por CHT: el nombre
--   lo escribe el propio participante en SU publicación.
--
-- RLS (sin BYPASSRLS en el service_role del proyecto — patrón 019/025/030/043):
--   - autor (authenticated, NO personal de CHT): inserta, lee y edita SOLO lo
--     suyo (autor_user_id = auth.uid()); "retirar" = estado 'retirada'.
--   - todo INSERT nace en estado 'borrador'. El BEFORE INSERT reescribe el
--     estado aunque el cliente envíe 'publicada' (un CHECK no puede
--     reescribir el valor; la policy de INSERT exige estado = 'borrador'
--     por si el trigger no corriera). Pasar a 'publicada' solo mediante
--     publicar_publicacion_marketplace(), SECURITY DEFINER con search_path
--     fijo y EXECUTE únicamente del rol moderador_publicaciones (NOLOGIN,
--     sin miembros: quién modera es decisión de Willis; esta migración no
--     asigna el rol). Tope: 10 publicaciones por autor cada 24 horas.
--   - anon: SIN privilegios sobre la tabla base (ni SELECT de tabla ni por
--     columna, así la API REST no puede pedir autor_user_id ni notas). Solo
--     lee la vista publicaciones_marketplace_publicas, con security_invoker
--     = false (corre con el dueño; el WHERE deja publicadas vigentes y la
--     lista de columnas no incluye autor_user_id ni notas).
--   - authenticated: lee la tabla según RLS (lo suyo, lo público vigente y,
--     si es personal de CHT, todo) y también la vista.
--   - personal de CHT (is_internal_staff): solo lectura. No inserta, no edita
--     y no publica: publicar no es un permiso de staff. No "carga el precio
--     del día" ni sustituye el precio informativo de la Fase 1.
--   - service_role: FOR ALL, pero sin DELETE/TRUNCATE para nadie: el retiro es
--     un estado, igual que en precios_referencia (030).
--
-- Idempotente (create if not exists, drop policy/trigger if exists,
-- constraints gateadas por pg_constraint, create or replace view/function).
-- search_path fijo en toda función SECURITY DEFINER (patrón 019/033/041/043).

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.is_internal_staff()') is null then
    raise exception '044: falta public.is_internal_staff() — aplicar 041_rls_tablas_operativas.sql primero';
  end if;
end $$;

-- ═══ 1. Tabla ═══════════════════════════════════════════════════════════════

create table if not exists public.publicaciones_marketplace (
  id                    uuid primary key default gen_random_uuid(),

  -- Autor y participante (el nombre público lo declara el propio participante).
  autor_user_id         uuid not null references auth.users (id),
  participante_nombre   text not null,
  participante_tipo     text not null,

  -- Qué publica.
  tipo                  text not null,
  produccion_estimada   numeric(14,4) null,
  produccion_unidad     text null,
  precio_compra         numeric(14,4) null,
  precio_venta          numeric(14,4) null,
  moneda                text not null default 'HNL',
  precio_unidad         text null,
  ley_kilates           numeric(4,1) null,
  notas                 text null,

  -- Vigencia y ciclo de vida (sin DELETE: el retiro es un estado).
  vigente_desde         date not null default (now() at time zone 'America/Tegucigalpa')::date,
  vigente_hasta         date not null,
  estado                text not null default 'borrador',
  publicada_en          timestamptz null,
  retirada_en           timestamptz null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.publicaciones_marketplace is
  'Marketplace abierto (DEC-2026-11-27-2): publicaciones de producción estimada y precios de compra/venta de cada participante. CHT no carga ni edita estos precios; no sustituyen al precio informativo del oro. Sin DELETE: retirar = estado retirada.';

-- Constraints gateadas (idempotentes).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_participante_tipo_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_participante_tipo_check
      check (participante_tipo in ('productor', 'comprador', 'planta', 'otro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_tipo_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_tipo_check
      check (tipo in ('produccion', 'compra', 'venta', 'mixta'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_estado_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_estado_check
      check (estado in ('borrador', 'publicada', 'retirada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_moneda_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_moneda_check
      check (moneda in ('HNL', 'USD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_produccion_unidad_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_produccion_unidad_check
      check (produccion_unidad is null or produccion_unidad in ('g', 'kg', 'oz_troy', 'dwt'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_precio_unidad_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_precio_unidad_check
      check (precio_unidad is null or precio_unidad in ('g_fino', 'g_material', 'oz_troy', 'dwt'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_valores_positivos_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_valores_positivos_check
      check ((produccion_estimada is null or produccion_estimada >= 0)
         and (precio_compra is null or precio_compra > 0)
         and (precio_venta  is null or precio_venta  > 0)
         and (ley_kilates   is null or (ley_kilates > 0 and ley_kilates <= 24)));
  end if;
  -- Al menos un dato publicable.
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_algun_dato_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_algun_dato_check
      check (produccion_estimada is not null or precio_compra is not null or precio_venta is not null);
  end if;
  -- Un precio exige unidad; una producción exige unidad.
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_unidades_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_unidades_check
      check ((precio_compra is null and precio_venta is null) or precio_unidad is not null)
      ;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_produccion_con_unidad_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_produccion_con_unidad_check
      check (produccion_estimada is null or produccion_unidad is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_vigencia_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_vigencia_check
      check (vigente_hasta >= vigente_desde);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_nombre_check') then
    alter table public.publicaciones_marketplace
      add constraint publicaciones_nombre_check
      check (length(btrim(participante_nombre)) between 2 and 120);
  end if;
end $$;

create index if not exists idx_publicaciones_vigentes
  on public.publicaciones_marketplace (estado, vigente_desde, vigente_hasta);
create index if not exists idx_publicaciones_autor
  on public.publicaciones_marketplace (autor_user_id);

-- ═══ 2. Triggers (updated_at + sellos de estado) ════════════════════════════

create or replace function public.fn_publicaciones_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    -- Forzado: aunque el cliente (o service_role) envíe 'publicada'.
    -- Un CHECK solo rechazaría la fila; aquí el estado que queda es borrador.
    new.estado := 'borrador';
    new.publicada_en := null;
    new.retirada_en := null;
    if new.autor_user_id is not null then
      -- Serializa los altas del mismo autor para que el tope no se pase en paralelo.
      perform pg_advisory_xact_lock(hashtextextended(new.autor_user_id::text, 0));
      if (
        select count(*)
          from public.publicaciones_marketplace p
         where p.autor_user_id = new.autor_user_id
           and p.created_at > now() - interval '24 hours'
      ) >= 10 then
        raise exception 'publicaciones: límite de 10 publicaciones por usuario cada 24 horas'
          using errcode = '23514';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- El autor no cambia nunca.
    if new.autor_user_id is distinct from old.autor_user_id then
      raise exception 'publicaciones: autor_user_id es inmutable' using errcode = '23514';
    end if;
    -- Una publicación retirada no vuelve a publicarse: se crea una nueva.
    if old.estado = 'retirada' and new.estado is distinct from 'retirada' then
      raise exception 'publicaciones: una publicación retirada no se reactiva; cree una nueva' using errcode = '23514';
    end if;
    -- Pasar a publicada solo si la función moderadora dejó el token de esta
    -- transacción. Un GUC suelto no alcanza: el cliente puede hacer set_config.
    -- El token vive en una tabla sin GRANT; solo estas funciones (dueño) lo leen.
    if new.estado = 'publicada' and old.estado is distinct from 'publicada' then
      if old.estado is distinct from 'borrador' then
        raise exception 'publicaciones: solo un borrador puede pasar a publicada' using errcode = '23514';
      end if;
      if current_setting('publicaciones.publicar_token', true)
         is distinct from (
           select t.token::text from public.publicaciones_publicacion_token t where t.id
         ) then
        raise exception 'publicaciones: pasar a publicada solo mediante publicar_publicacion_marketplace()'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if new.estado = 'publicada' and (tg_op = 'INSERT' or old.estado is distinct from 'publicada') then
    new.publicada_en := coalesce(new.publicada_en, now());
  end if;
  if new.estado = 'retirada' and (tg_op = 'INSERT' or old.estado is distinct from 'retirada') then
    new.retirada_en := coalesce(new.retirada_en, now());
  end if;
  return new;
end;
$$;
alter function public.fn_publicaciones_touch() owner to postgres;

-- Token de un solo uso lógico por transacción. Sin GRANT y con RLS sin
-- policies: anon, authenticated y service_role no lo leen. El dueño
-- (funciones SECURITY DEFINER) sí. Re-aplicar esta migración no asigna
-- ni revoca miembros del rol moderador.
create table if not exists public.publicaciones_publicacion_token (
  id boolean primary key default true,
  token uuid not null default gen_random_uuid(),
  constraint publicaciones_publicacion_token_singleton check (id)
);
insert into public.publicaciones_publicacion_token (id)
select true
where not exists (select 1 from public.publicaciones_publicacion_token where id);
alter table public.publicaciones_publicacion_token owner to postgres;
alter table public.publicaciones_publicacion_token enable row level security;
revoke all on table public.publicaciones_publicacion_token from public, anon, authenticated, service_role;
comment on table public.publicaciones_publicacion_token is
  'Token interno para publicar_publicacion_marketplace(). No es una publicación y no se expone por la API.';

-- Rol moderador. NOLOGIN. Esta migración no hace GRANT del rol a nadie:
-- quién puede publicar es decisión de Willis.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'moderador_publicaciones') then
    create role moderador_publicaciones nologin;
  end if;
end $$;
alter role moderador_publicaciones nologin;
comment on role moderador_publicaciones is
  'EXECUTE de publicar_publicacion_marketplace(). Sin miembros asignados por la migración 044.';

create or replace function public.publicar_publicacion_marketplace(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tok uuid := gen_random_uuid();
  fila_id uuid;
begin
  if p_id is null then
    raise exception 'publicaciones: id requerido' using errcode = '23514';
  end if;
  update public.publicaciones_publicacion_token
     set token = tok
   where id;
  if not found then
    raise exception 'publicaciones: falta la fila de token de publicación' using errcode = '55000';
  end if;
  -- is_local = true: el token muere al cerrar la transacción.
  perform set_config('publicaciones.publicar_token', tok::text, true);
  update public.publicaciones_marketplace
     set estado = 'publicada'
   where id = p_id
     and estado = 'borrador'
  returning id into fila_id;
  if fila_id is null then
    raise exception 'publicaciones: solo se publica un borrador existente' using errcode = '23514';
  end if;
  return fila_id;
end;
$$;
alter function public.publicar_publicacion_marketplace(uuid) owner to postgres;
revoke all on function public.publicar_publicacion_marketplace(uuid) from public, anon, authenticated, service_role;
grant execute on function public.publicar_publicacion_marketplace(uuid) to moderador_publicaciones;
comment on function public.publicar_publicacion_marketplace(uuid) is
  'Pasa un borrador a publicada. SECURITY DEFINER, search_path fijo. EXECUTE solo de moderador_publicaciones.';

drop trigger if exists trg_publicaciones_touch on public.publicaciones_marketplace;
create trigger trg_publicaciones_touch
  before insert or update on public.publicaciones_marketplace
  for each row execute function public.fn_publicaciones_touch();

-- ═══ 3. Vista pública: solo publicadas y vigentes, sin autor ni notas ═══════

-- security_invoker = false (explícito): anon no tiene GRANT sobre la tabla
-- base, así que una vista security_invoker = true le fallaría con
-- permission denied. Con false la vista corre con los privilegios del dueño
-- (postgres, que crea la tabla en esta misma migración) y el WHERE es el
-- filtro. No se otorgan columnas sueltas a anon: la tabla no es legible.
create or replace view public.publicaciones_marketplace_publicas
with (security_invoker = false) as
  select p.id,
         p.participante_nombre,
         p.participante_tipo,
         p.tipo,
         p.produccion_estimada,
         p.produccion_unidad,
         p.precio_compra,
         p.precio_venta,
         p.moneda,
         p.precio_unidad,
         p.ley_kilates,
         p.vigente_desde,
         p.vigente_hasta,
         p.publicada_en,
         p.updated_at
    from public.publicaciones_marketplace p
   where p.estado = 'publicada'
     and (now() at time zone 'America/Tegucigalpa')::date between p.vigente_desde and p.vigente_hasta;

comment on view public.publicaciones_marketplace_publicas is
  'Lectura pública del marketplace. security_invoker = false: anon no tiene GRANT sobre la tabla base y la vista corre con el dueño. Solo filas en estado publicada y vigentes hoy (hora Honduras). Columnas sin autor_user_id ni notas.';

-- ═══ 4. RLS y grants ════════════════════════════════════════════════════════

alter table public.publicaciones_marketplace enable row level security;
revoke all on table public.publicaciones_marketplace from public, anon, authenticated, service_role;
revoke all on public.publicaciones_marketplace_publicas from public, anon, authenticated, service_role;

-- service_role: FOR ALL pero SIN DELETE/TRUNCATE (retirar = estado).
grant select, insert, update on table public.publicaciones_marketplace to service_role;
grant select on public.publicaciones_marketplace_publicas to service_role;
drop policy if exists publicaciones_service_all on public.publicaciones_marketplace;
create policy publicaciones_service_all on public.publicaciones_marketplace
  for all to service_role using (true) with check (true);

-- anon: cero privilegios sobre la tabla base (el revoke de arriba ya lo cubre;
-- se repite para que un grant posterior en este archivo no lo reintroduzca).
-- No hay GRANT por columna: anon solo lee la vista.
revoke all on table public.publicaciones_marketplace from anon;
grant select on table public.publicaciones_marketplace to authenticated;
grant select on public.publicaciones_marketplace_publicas to anon, authenticated;
grant insert, update on table public.publicaciones_marketplace to authenticated;

-- La policy de lectura pública no incluye a anon. Sin GRANT y sin policy,
-- anon no lee la tabla aunque alguien reabra el GRANT por error sin esta policy.
drop policy if exists publicaciones_public_read on public.publicaciones_marketplace;
create policy publicaciones_public_read on public.publicaciones_marketplace
  for select to authenticated
  using (estado = 'publicada'
         and (now() at time zone 'America/Tegucigalpa')::date between vigente_desde and vigente_hasta);

-- autor: lo suyo (lee también sus borradores y retiradas). El personal de CHT
-- NO entra por aquí (is_internal_staff), así nunca carga precios en el marketplace.
drop policy if exists publicaciones_autor_read_own on public.publicaciones_marketplace;
create policy publicaciones_autor_read_own on public.publicaciones_marketplace
  for select to authenticated
  using (autor_user_id = auth.uid());

drop policy if exists publicaciones_autor_insert_own on public.publicaciones_marketplace;
create policy publicaciones_autor_insert_own on public.publicaciones_marketplace
  for insert to authenticated
  with check (
    autor_user_id = auth.uid()
    and estado = 'borrador'
    and not public.is_internal_staff()
  );

drop policy if exists publicaciones_autor_update_own on public.publicaciones_marketplace;
create policy publicaciones_autor_update_own on public.publicaciones_marketplace
  for update to authenticated
  using (autor_user_id = auth.uid() and not public.is_internal_staff())
  with check (autor_user_id = auth.uid() and not public.is_internal_staff());

-- personal de CHT: SOLO lectura (moderación / soporte). Sin INSERT ni UPDATE.
drop policy if exists publicaciones_staff_read on public.publicaciones_marketplace;
create policy publicaciones_staff_read on public.publicaciones_marketplace
  for select to authenticated
  using (public.is_internal_staff());

-- Nadie borra: ni policy de DELETE ni grant (service_role incluido).
revoke delete, truncate on table public.publicaciones_marketplace from public, anon, authenticated, service_role;

-- ═══ 5. Verificación post-aplicación (ejecutar a mano en Studio) ════════════
--   select rowsecurity from pg_tables where schemaname='public' and tablename='publicaciones_marketplace';  -- true
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema='public' and table_name='publicaciones_marketplace' order by 1,2;
--   -- anon: 0 filas. authenticated: SELECT, INSERT, UPDATE. service_role: SELECT, INSERT, UPDATE (sin DELETE).
--   select column_name from information_schema.column_privileges
--    where table_schema='public' and table_name='publicaciones_marketplace' and grantee='anon';
--   -- 0 filas: anon no tiene ni autor_user_id ni ninguna otra columna.
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='publicaciones_marketplace_publicas'
--      and column_name in ('autor_user_id', 'notas');
--   -- 0 filas.
--   select policyname, cmd, roles from pg_policies where tablename='publicaciones_marketplace' order by 1;
--
--   -- Como rol anon (no imprime secretos). Debe fallar la tabla y funcionar la vista:
--   begin;
--   set local role anon;
--   select autor_user_id from public.publicaciones_marketplace;          -- ERROR: permission denied
--   select * from public.publicaciones_marketplace_publicas limit 1;     -- OK, sin autor_user_id ni notas
--   rollback;
--
--   Cómo verificar que anon no lee autor_user_id por la API REST (PostgREST).
--   Sustituir <PROJECT> por la URL del proyecto. La anon key se manda en el
--   header apikey / Authorization y NO se pega en este archivo ni en logs:
--     GET https://<PROJECT>.supabase.co/rest/v1/publicaciones_marketplace?select=autor_user_id
--       → 401 ó 42501 (permission denied). No hay GRANT SELECT a anon sobre la tabla.
--     GET https://<PROJECT>.supabase.co/rest/v1/publicaciones_marketplace?select=*
--       → el mismo rechazo.
--     GET https://<PROJECT>.supabase.co/rest/v1/publicaciones_marketplace_publicas?select=autor_user_id
--       → 400: la columna no existe en la vista.
--     GET https://<PROJECT>.supabase.co/rest/v1/publicaciones_marketplace_publicas?select=notas
--       → 400: la columna no existe en la vista.
--     GET https://<PROJECT>.supabase.co/rest/v1/publicaciones_marketplace_publicas?select=id,participante_nombre
--       → 200, solo filas en estado publicada y vigentes.
