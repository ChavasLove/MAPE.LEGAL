-- ============================================================================
-- 030_precios_referencia.sql
-- Precio de Referencia MAPE.LEGAL
-- Registro indeleble. Las correcciones se realizan por reemplazo, nunca por
-- borrado. No existe (ni debe existir) policy ni grant de DELETE.
--
-- Idempotente: re-ejecutable en Supabase Studio sin efectos secundarios
-- (drop policy if exists / drop constraint if exists antes de cada create,
-- misma convención que las migraciones 018/019/025).
--
-- Adaptaciones respecto del script de encargo, conforme a su nota "si el
-- proyecto ya define un rol o esquema distinto para escrituras de servidor,
-- adaptar las políticas a esa convención":
--   1. Policy SELECT explícita para service_role — el service_role de este
--      proyecto NO tiene BYPASSRLS (saga documentada en migraciones 019/025/
--      026/027/028); sin esta policy el servidor no vería filas 'reemplazado'
--      (historial de auditoría del panel) porque la lectura pública filtra
--      estado = 'vigente'.
--   2. REVOKE DELETE/TRUNCATE — refuerza la indelebilidad al nivel de grants,
--      además de la ausencia de policy de DELETE.
--   3. RPC reemplazar_precio_referencia SECURITY DEFINER (patrón 019/023/025)
--      — hace atómico el par UPDATE(estado='reemplazado') + INSERT(nuevo
--      vigente); sin transacción única, un fallo del insert dejaría una fecha
--      sin precio vigente y un registro 'reemplazado' sin reemplazo.
-- ============================================================================

create table if not exists precios_referencia (
  id                          uuid primary key default gen_random_uuid(),
  fecha                       date not null,
  hora_fijacion               timestamptz not null,

  -- Insumos verificables del cálculo
  referencia_lbma_usd_oz      numeric(12,4) not null check (referencia_lbma_usd_oz > 0),
  tipo_cambio_bch             numeric(12,6) not null check (tipo_cambio_bch > 0),
  factor_comercializacion     numeric(5,4)  not null check (factor_comercializacion > 0 and factor_comercializacion <= 1),
  version_politica            text          not null,

  -- Resultado publicado
  precio_lempiras_gramo_fino  numeric(12,4) not null check (precio_lempiras_gramo_fino > 0),

  -- Trazabilidad y ciclo de vida (sin DELETE)
  estado                      text not null default 'vigente'
                              check (estado in ('vigente','reemplazado')),
  reemplaza_a                 uuid references precios_referencia(id),
  motivo_reemplazo            text,
  fijado_por                  uuid,

  created_at                  timestamptz not null default now()
);

-- Un solo precio vigente por fecha
create unique index if not exists precios_referencia_fecha_vigente_idx
  on precios_referencia (fecha)
  where estado = 'vigente';

create index if not exists precios_referencia_fecha_idx
  on precios_referencia (fecha desc);

-- Un reemplazo debe declarar motivo
alter table precios_referencia
  drop constraint if exists precios_referencia_motivo_chk;
alter table precios_referencia
  add constraint precios_referencia_motivo_chk
  check (reemplaza_a is null or (motivo_reemplazo is not null and length(trim(motivo_reemplazo)) > 0));

alter table precios_referencia enable row level security;

-- Lectura pública: solo registros vigentes
drop policy if exists precios_referencia_lectura_publica on precios_referencia;
create policy precios_referencia_lectura_publica
  on precios_referencia for select
  using (estado = 'vigente');

-- Lectura de servidor: el historial completo (incluye 'reemplazado') es
-- evidencia de auditoría y se muestra en el panel de fijación. Necesaria
-- porque service_role no tiene BYPASSRLS en este proyecto.
drop policy if exists precios_referencia_lectura_servicio on precios_referencia;
create policy precios_referencia_lectura_servicio
  on precios_referencia for select
  to service_role
  using (true);

-- Escritura: exclusivamente vía service role desde el servidor
drop policy if exists precios_referencia_escritura_servicio on precios_referencia;
create policy precios_referencia_escritura_servicio
  on precios_referencia for insert
  to service_role
  with check (true);

drop policy if exists precios_referencia_actualizacion_servicio on precios_referencia;
create policy precios_referencia_actualizacion_servicio
  on precios_referencia for update
  to service_role
  using (true);

-- No existe policy de DELETE. Se revoca además el privilegio para que ni
-- siquiera una policy futura accidental habilite el borrado sin revertir
-- explícitamente este revoke.
revoke delete, truncate on table precios_referencia from anon, authenticated, service_role;

grant select on table precios_referencia to anon, authenticated;
grant select, insert, update on table precios_referencia to service_role;

comment on table precios_referencia is
  'Precio de Referencia MAPE.LEGAL. Registro indeleble: prohibido DELETE. Correcciones por reemplazo (estado = reemplazado + reemplaza_a).';

-- ─── RPC atómico de reemplazo ────────────────────────────────────────────────
-- Marca el registro vigente anterior como 'reemplazado' e inserta el nuevo
-- registro vigente en una sola transacción. SECURITY DEFINER, owner postgres
-- (patrón de las migraciones 019/023/025 — funciona aunque service_role no
-- tenga BYPASSRLS). Ejecutable únicamente por service_role.
drop function if exists public.reemplazar_precio_referencia(
  uuid, date, timestamptz, numeric, numeric, numeric, text, numeric, text, uuid
);
create or replace function public.reemplazar_precio_referencia(
  p_anterior_id                uuid,
  p_fecha                      date,
  p_hora_fijacion              timestamptz,
  p_referencia_lbma_usd_oz     numeric,
  p_tipo_cambio_bch            numeric,
  p_factor_comercializacion    numeric,
  p_version_politica           text,
  p_precio_lempiras_gramo_fino numeric,
  p_motivo_reemplazo           text,
  p_fijado_por                 uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo_id uuid;
begin
  if p_motivo_reemplazo is null or length(trim(p_motivo_reemplazo)) = 0 then
    raise exception 'motivo_reemplazo es obligatorio para reemplazar un precio vigente'
      using errcode = '23514';
  end if;

  update public.precios_referencia
     set estado = 'reemplazado'
   where id = p_anterior_id
     and fecha = p_fecha
     and estado = 'vigente';

  if not found then
    -- El registro ya fue reemplazado por otra operación concurrente, o el id
    -- no corresponde al vigente de esa fecha. El caller mapea a 409.
    raise exception 'el precio vigente de la fecha ya fue modificado por otra operación'
      using errcode = '40001';
  end if;

  insert into public.precios_referencia (
    fecha, hora_fijacion,
    referencia_lbma_usd_oz, tipo_cambio_bch, factor_comercializacion,
    version_politica, precio_lempiras_gramo_fino,
    estado, reemplaza_a, motivo_reemplazo, fijado_por
  ) values (
    p_fecha, p_hora_fijacion,
    p_referencia_lbma_usd_oz, p_tipo_cambio_bch, p_factor_comercializacion,
    p_version_politica, p_precio_lempiras_gramo_fino,
    'vigente', p_anterior_id, p_motivo_reemplazo, p_fijado_por
  )
  returning id into v_nuevo_id;

  return v_nuevo_id;
end;
$$;

alter function public.reemplazar_precio_referencia(
  uuid, date, timestamptz, numeric, numeric, numeric, text, numeric, text, uuid
) owner to postgres;

revoke all on function public.reemplazar_precio_referencia(
  uuid, date, timestamptz, numeric, numeric, numeric, text, numeric, text, uuid
) from public, anon, authenticated;

grant execute on function public.reemplazar_precio_referencia(
  uuid, date, timestamptz, numeric, numeric, numeric, text, numeric, text, uuid
) to service_role;

comment on function public.reemplazar_precio_referencia(
  uuid, date, timestamptz, numeric, numeric, numeric, text, numeric, text, uuid
) is
  'Reemplazo atómico del Precio de Referencia: marca el vigente anterior como reemplazado e inserta el nuevo vigente con reemplaza_a + motivo. Solo service_role.';
