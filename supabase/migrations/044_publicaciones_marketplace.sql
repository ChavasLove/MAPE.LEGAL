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
--   - anon / authenticated: SOLO lectura de filas 'publicada' y vigentes
--     (vista publicaciones_marketplace_publicas + policy equivalente).
--   - personal de CHT (is_internal_staff): solo lectura (moderación); NO
--     inserta ni edita: no "carga el precio del día" ni sustituye el precio
--     informativo de la Fase 1.
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
  if tg_op = 'UPDATE' then
    -- El autor no cambia nunca.
    if new.autor_user_id is distinct from old.autor_user_id then
      raise exception 'publicaciones: autor_user_id es inmutable' using errcode = '23514';
    end if;
    -- Una publicación retirada no vuelve a publicarse: se crea una nueva.
    if old.estado = 'retirada' and new.estado is distinct from 'retirada' then
      raise exception 'publicaciones: una publicación retirada no se reactiva; cree una nueva' using errcode = '23514';
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

drop trigger if exists trg_publicaciones_touch on public.publicaciones_marketplace;
create trigger trg_publicaciones_touch
  before insert or update on public.publicaciones_marketplace
  for each row execute function public.fn_publicaciones_touch();

-- ═══ 3. Vista pública: solo publicadas y vigentes, sin autor ni notas ═══════

create or replace view public.publicaciones_marketplace_publicas
with (security_invoker = true) as
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
  'Lectura pública del marketplace: solo publicaciones en estado publicada y vigentes hoy (hora Honduras). Sin autor_user_id ni notas. security_invoker: la RLS de la tabla aplica al lector.';

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

-- anon / authenticated: SELECT (la policy filtra a publicadas vigentes). Nada más a anon.
grant select on table public.publicaciones_marketplace to anon, authenticated;
grant select on public.publicaciones_marketplace_publicas to anon, authenticated;
grant insert, update on table public.publicaciones_marketplace to authenticated;

drop policy if exists publicaciones_public_read on public.publicaciones_marketplace;
create policy publicaciones_public_read on public.publicaciones_marketplace
  for select to anon, authenticated
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
  with check (autor_user_id = auth.uid() and not public.is_internal_staff());

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
--    where table_name='publicaciones_marketplace' order by 1,2;
--   -- anon: SELECT; authenticated: SELECT, INSERT, UPDATE; service_role: SELECT, INSERT, UPDATE (sin DELETE)
--   select policyname, cmd, roles from pg_policies where tablename='publicaciones_marketplace' order by 1;
