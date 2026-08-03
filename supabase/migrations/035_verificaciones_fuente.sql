-- 035_verificaciones_fuente.sql
-- Interoperabilidad Fase 1 (T2.2): tabla verificaciones_fuente (append-only).
--
-- Registra CONTRA QUÉ DOCUMENTO se verificó cada entidad (mina, expediente o
-- certificado): oficio INHGEOMIN, acta UMA Art. 21, resolución municipal, etc.
-- Es la base de la "frescura verificable" de /verificar: la información no es
-- en tiempo real; es información verificada contra documento.
--
-- Append-only (política no-DELETE de la plataforma, R4): la corrección de una
-- verificación es una NUEVA fila, nunca una edición. Sin UPDATE ni DELETE para
-- anon/authenticated; solo el service role conserva acceso total (escape
-- operativo, mismo criterio que 030/031).
--
-- El service_role de este proyecto NO tiene BYPASSRLS (saga 019/024/025) —
-- por eso la policy explícita FOR ALL TO service_role.
--
-- Idempotente: re-ejecutable sin efectos secundarios.

create table if not exists public.verificaciones_fuente (
  id               uuid primary key default gen_random_uuid(),
  entidad_tipo     text not null check (entidad_tipo in ('mina','expediente','certificado')),
  entidad_id       uuid not null,
  fuente           text not null,            -- ej. 'Oficio INHGEOMIN', 'Acta UMA Art. 21', 'Resolución municipal'
  referencia       text,                     -- número de oficio / acta
  fecha_documento  date,
  verificado_por   uuid references auth.users(id),
  hash_documento   text,
  notas            text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_verificaciones_fuente_entidad
  on public.verificaciones_fuente (entidad_tipo, entidad_id, created_at desc);

alter table public.verificaciones_fuente enable row level security;

-- Append-only: nadie salvo service role puede modificar o borrar.
revoke update, delete on public.verificaciones_fuente from anon, authenticated;
grant select, insert on public.verificaciones_fuente to authenticated;
grant all on public.verificaciones_fuente to service_role;

do $$
begin
  drop policy if exists "Authenticated read verificaciones"  on public.verificaciones_fuente;
  drop policy if exists "Staff insert verificaciones"        on public.verificaciones_fuente;
  drop policy if exists "Service role all verificaciones"    on public.verificaciones_fuente;

  create policy "Authenticated read verificaciones"
    on public.verificaciones_fuente for select
    to authenticated
    using (true);

  -- INSERT para roles internos — mismo patrón de user_roles que 027/028.
  create policy "Staff insert verificaciones"
    on public.verificaciones_fuente for insert
    to authenticated
    with check (
      exists (
        select 1 from public.user_roles
        where user_id = auth.uid()
          and rol in ('admin', 'abogado', 'tecnico_ambiental')
          and activo = true
      )
    );

  create policy "Service role all verificaciones"
    on public.verificaciones_fuente for all
    to service_role
    using (true)
    with check (true);
end $$;
