-- 047_recepcion_custodia.sql
-- NO APLICAR. Escrita en el PR de la reestructura de recepción, acceso y cadena
-- de custodia (28-nov-2026, apilado sobre el #245); la aplica Willis tras revisión.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, con RESPALDO previo ║
-- ║ y aprobación expresa de Willis. Orden: … → 046 → 047.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- TEMA: recepción física y cadena de custodia hasta el laboratorio.
--   llegada → recepción → pesaje → análisis → etiquetado → sobres por mina →
--   caja con manifiesto → envío al laboratorio → recepción en laboratorio con
--   conciliación de pesos contra el manifiesto.
-- Todo lo registra el PERSONAL. El titular y las organizaciones solo ven.
--
-- QUÉ NO HACE (a propósito):
--   · No hay pagos, recibos, montos, medios de pago ni precio en ninguna tabla
--     ni función de esta migración. `pagos_lote`, `registrar_pago_lote` y el
--     evento `pago` de la 043 no se usan, no se extienden y no se borran.
--   · No toca `fundicion` ni `refinado` (fuera de alcance).
--   · No decide quién opera la recepción ni quién es la parte compradora:
--     son filas de `partes_flujo`, configurables por lote o por punto.
--     [POR CONFIRMAR — WILLIS / LEGAL]
--   · No nombra a ninguna empresa. El laboratorio es una organización de tipo
--     `laboratorio`; su nombre vive en datos.
--
-- CADENA DE CUSTODIA: se agregan 8 tipos de evento a `lote_eventos`
-- (recepcion, pesaje, analisis, etiquetado, empaque_sobre, empaque_caja,
-- envio_laboratorio, recepcion_laboratorio) ampliando el CHECK. El canónico
-- del hash (canonico_evento) y el trigger lote_evento_encadenar de la 043 NO
-- cambian: las cadenas existentes siguen verificando. Los datos nuevos van en
-- `detalle` (solo textos e identificadores: sin decimales, para que el JSON
-- canónico de SQL y el de TypeScript coincidan).
--
-- CONCILIACIÓN: mismo umbral que la 043 (`umbral_conciliacion_peso_pct`, SIN
-- valor por defecto). `conciliar_lote()` compara cuatro puntos fijos del lote y
-- no conoce manifiestos; aquí se agrega la conciliación manifiesto ↔ recepción
-- en laboratorio con la misma regla: umbral NULL → nada se da por conciliado y
-- se emite la alerta existente `umbral_no_configurado`.
--
-- REGLAS DE INTEGRIDAD (triggers/constraints; réplica en lib/recepcion/reglas.ts):
--   (a) un sobre pertenece a UNA mina, la de su recepción;
--   (b) una caja contiene solo sobres de UN titular de origen — lotes de
--       titulares distintos nunca se mezclan;
--   (c) no se cierra una caja sin manifiesto;
--   (d) no se cierra ni se envía una caja con sobres sin pesar o sin etiquetar;
--   (e) un titular sin perfil aprobado no origina recepción;
--   (f) nada se borra: la anulación es un evento de corrección.
--
-- DEPENDENCIAS: 046 (perfil_aprobado_de_cliente, cliente_del_usuario), 045
-- (es_personal, bitacora_acciones), 043 (lotes, lote_eventos, alertas_lote,
-- organizaciones, sha256_hex, fn_append_only, configuracion_sistema), 040 (minas).
--
-- Idempotente.
--
-- PLAN DE REVERSA (documentado; NO ejecutar sin decisión de Willis):
--   -- 1) dejar de usar las rutas /api/recepcion/*;
--   -- 2) drop trigger lote_evento_reservar_recepcion on public.lote_eventos;
--   -- 3) las tablas de recepción son evidencia de custodia: NO se eliminan;
--   -- 4) el CHECK ampliado de lote_eventos.tipo y de organizaciones.tipo se
--   --    conserva mientras existan filas con los valores nuevos.

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.perfil_aprobado_de_cliente(uuid)') is null then
    raise exception '047: falta la 046 (perfil_aprobado_de_cliente)';
  end if;
  if to_regclass('public.lote_eventos') is null or to_regclass('public.alertas_lote') is null then
    raise exception '047: falta la 043 (lote_eventos / alertas_lote)';
  end if;
end $$;

-- ═══ 1. Tipos de organización y de evento (ampliación no destructiva) ═══════

alter table public.organizaciones drop constraint if exists organizaciones_tipo_check;
alter table public.organizaciones
  add constraint organizaciones_tipo_check
  check (tipo in ('comercializador', 'planta', 'auditor', 'laboratorio', 'centro_acopio',
                  'cooperativa', 'municipio', 'otro'));
-- Los tres últimos los usa la 048; se declaran aquí para no reescribir el
-- CHECK dos veces. Ninguna fila existente queda fuera: la lista solo crece.

alter table public.lote_eventos drop constraint if exists lote_eventos_tipo_check;
alter table public.lote_eventos
  add constraint lote_eventos_tipo_check
  check (tipo in (
    'origen_mina', 'acopio', 'transporte', 'recepcion_planta', 'laboratorio',
    'fundicion', 'refinado', 'pago', 'correccion', 'nota',
    'recepcion', 'pesaje', 'analisis', 'etiquetado', 'empaque_sobre',
    'empaque_caja', 'envio_laboratorio', 'recepcion_laboratorio'));

-- Los tipos de recepción solo los emite el personal (por la API con
-- service_role, o un usuario de personal). Un comercializador o una planta con
-- su policy de INSERT de la 043 no pueden emitirlos.
create or replace function public.fn_lote_evento_reservar_recepcion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo in ('recepcion', 'pesaje', 'analisis', 'etiquetado', 'empaque_sobre',
                  'empaque_caja', 'envio_laboratorio', 'recepcion_laboratorio')
     and auth.uid() is not null
     and not public.es_personal() then
    raise exception 'evento_reservado: los eventos de recepción los registra el personal'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_lote_evento_reservar_recepcion() owner to postgres;
revoke execute on function public.fn_lote_evento_reservar_recepcion() from public, anon, authenticated;

drop trigger if exists lote_evento_reservar_recepcion on public.lote_eventos;
create trigger lote_evento_reservar_recepcion
  before insert on public.lote_eventos
  for each row execute function public.fn_lote_evento_reservar_recepcion();

-- Emisor interno de eventos de recepción (solo para los triggers/RPCs de abajo).
create or replace function public.emitir_evento_recepcion(
  p_lote uuid, p_tipo text, p_actor uuid, p_lugar text, p_peso_g numeric, p_ley numeric, p_detalle jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol text;
begin
  select ur.rol into v_rol from public.user_roles ur where ur.user_id = p_actor limit 1;
  insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol, lugar, peso_g, ley_fino, detalle)
  values (p_lote, p_tipo, p_actor, v_rol, p_lugar, p_peso_g, p_ley, coalesce(p_detalle, '{}'::jsonb));
end;
$$;
alter function public.emitir_evento_recepcion(uuid, text, uuid, text, numeric, numeric, jsonb) owner to postgres;
revoke execute on function public.emitir_evento_recepcion(uuid, text, uuid, text, numeric, numeric, jsonb) from public, anon, authenticated;

-- ═══ 2. puntos_recepcion ════════════════════════════════════════════════════

create table if not exists public.puntos_recepcion (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones(id) on delete restrict,
  tipo             text not null,
  nombre           text not null,
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint puntos_recepcion_tipo_check check (tipo in ('centro_acopio', 'oficina')),
  constraint puntos_recepcion_nombre_check check (length(trim(nombre)) between 2 and 120)
);

comment on table public.puntos_recepcion is
  'Punto físico donde el personal recibe material (centro de acopio u oficina). `organizacion_id` es la organización que lo opera: NO se cablea a nadie; quién opera la recepción es [POR CONFIRMAR].';

alter table public.puntos_recepcion enable row level security;
revoke all on table public.puntos_recepcion from public, anon, authenticated, service_role;
grant select, insert, update on table public.puntos_recepcion to service_role;
grant select on table public.puntos_recepcion to authenticated;
revoke delete, truncate on table public.puntos_recepcion from anon, authenticated, service_role;
drop policy if exists puntos_recepcion_service_all on public.puntos_recepcion;
create policy puntos_recepcion_service_all on public.puntos_recepcion
  for all to service_role using (true) with check (true);
drop policy if exists puntos_recepcion_personal_read on public.puntos_recepcion;
create policy puntos_recepcion_personal_read on public.puntos_recepcion
  for select to authenticated
  using ((public.es_personal()
          and ((select public.current_rol()) <> 'recepcion' or organizacion_id = (select public.current_org())))
         or (select public.current_rol()) = 'auditor');

-- Alcance por punto: `recepcion` solo ve lo de los puntos de su organización.
create or replace function public.alcanza_punto(p_punto uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_rol() = 'auditor' then true
    when not public.es_personal() then false
    when public.current_rol() <> 'recepcion' then true
    else exists (select 1 from public.puntos_recepcion p
                  where p.id = p_punto and p.organizacion_id = public.current_org())
  end;
$$;
alter function public.alcanza_punto(uuid) owner to postgres;
revoke execute on function public.alcanza_punto(uuid) from public, anon;
grant execute on function public.alcanza_punto(uuid) to authenticated, service_role;

-- ═══ 3. partes_flujo ════════════════════════════════════════════════════════

create table if not exists public.partes_flujo (
  id               uuid primary key default gen_random_uuid(),
  papel            text not null,
  organizacion_id  uuid not null references public.organizaciones(id) on delete restrict,
  lote_id          uuid null references public.lotes(id) on delete restrict,
  punto_id         uuid null references public.puntos_recepcion(id) on delete restrict,
  vigente          boolean not null default true,
  asignado_por     uuid null references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint partes_flujo_papel_check check (papel in ('operador_recepcion', 'parte_compradora', 'laboratorio_destino')),
  constraint partes_flujo_ambito_check check ((lote_id is null) <> (punto_id is null))
);

create unique index if not exists uq_partes_flujo_lote on public.partes_flujo (papel, lote_id) where vigente and lote_id is not null;
create unique index if not exists uq_partes_flujo_punto on public.partes_flujo (papel, punto_id) where vigente and punto_id is not null;

comment on table public.partes_flujo is
  'Quién cumple cada papel del flujo (operador de recepción, parte compradora configurada, laboratorio de destino), por lote o por punto. Es SOLO una asignación de organización a papel: sin montos, sin pagos, sin comprobantes. Quién opera la recepción y si el flujo es compraventa o logística es [POR CONFIRMAR — WILLIS / LEGAL]; mientras tanto nada se cablea.';

alter table public.partes_flujo enable row level security;
revoke all on table public.partes_flujo from public, anon, authenticated, service_role;
grant select, insert, update on table public.partes_flujo to service_role;
grant select on table public.partes_flujo to authenticated;
revoke delete, truncate on table public.partes_flujo from anon, authenticated, service_role;
drop policy if exists partes_flujo_service_all on public.partes_flujo;
create policy partes_flujo_service_all on public.partes_flujo
  for all to service_role using (true) with check (true);
drop policy if exists partes_flujo_personal_read on public.partes_flujo;
create policy partes_flujo_personal_read on public.partes_flujo
  for select to authenticated
  using (public.es_personal() or (select public.current_rol()) = 'auditor');

-- ═══ 4. recepciones ═════════════════════════════════════════════════════════

create table if not exists public.recepciones (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  punto_id            uuid not null references public.puntos_recepcion(id) on delete restrict,
  lote_id             uuid not null references public.lotes(id) on delete restrict,
  titular_cliente_id  uuid not null references public.clientes(id) on delete restrict,
  mina_id             uuid not null references public.minas(id) on delete restrict,
  modo_entrega        text not null,
  guia                text null,
  fecha_llegada       timestamptz not null,
  receptor_user_id    uuid not null,
  estado_embalaje     text not null default 'no_aplica',
  observaciones       text null,
  estado              text not null default 'registrada',
  anulada_por         uuid null,
  anulada_en          timestamptz null,
  anulacion_motivo    text null,
  created_at          timestamptz not null default now(),
  constraint recepciones_modo_check check (modo_entrega in ('en_persona', 'encargo_expreso', 'dhl', 'otro')),
  constraint recepciones_embalaje_check check (estado_embalaje in ('integro', 'danado', 'abierto', 'no_aplica')),
  constraint recepciones_estado_check check (estado in ('registrada', 'anulada')),
  constraint recepciones_anulacion_check check (estado <> 'anulada' or (anulada_por is not null and length(trim(coalesce(anulacion_motivo, ''))) >= 5))
);

create index if not exists idx_recepciones_punto on public.recepciones (punto_id, fecha_llegada desc);
create index if not exists idx_recepciones_lote on public.recepciones (lote_id);
create index if not exists idx_recepciones_titular on public.recepciones (titular_cliente_id);

comment on table public.recepciones is
  'Registro de recepción por el operador de recepción designado: llegada de material de un lote a un punto, anotada por el personal (nunca por el titular). Es un asiento de custodia; no implica compra ni transferencia de propiedad, y no lleva montos. Sin DELETE: la anulación es un evento de corrección.';
comment on column public.recepciones.titular_cliente_id is 'Titular de origen. Se deriva del lote; si viene, debe coincidir.';
comment on column public.recepciones.mina_id is 'Mina / expediente de procedencia. Debe pertenecer al titular de origen: no se mezclan expedientes.';
comment on column public.recepciones.guia is 'Guía o número de envío, si el material llegó por un transportista.';

create or replace function public.fn_recepcion_alta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote  public.lotes%rowtype;
  v_mina_titular uuid;
  v_activo boolean;
begin
  select * into v_lote from public.lotes where id = new.lote_id;
  if not found then
    raise exception 'lote_no_existe: %', new.lote_id using errcode = '23503';
  end if;
  if v_lote.estado in ('bloqueado', 'cerrado') then
    raise exception 'lote_no_disponible: el lote está %', v_lote.estado using errcode = '23514';
  end if;
  new.titular_cliente_id := coalesce(new.titular_cliente_id, v_lote.cliente_id);
  if new.titular_cliente_id <> v_lote.cliente_id then
    raise exception 'titular_no_coincide: el titular de origen no es el del lote' using errcode = '23514';
  end if;
  -- (e) solo un titular con perfil aprobado origina recepción.
  if not public.perfil_aprobado_de_cliente(new.titular_cliente_id) then
    raise exception 'perfil_no_aprobado: el titular de origen no tiene un perfil aprobado' using errcode = '23514';
  end if;
  -- La mina es del mismo titular: cada mina con su expediente.
  select m.cliente_id into v_mina_titular from public.minas m where m.id = new.mina_id;
  if not found then
    raise exception 'mina_no_existe: %', new.mina_id using errcode = '23503';
  end if;
  if v_mina_titular is distinct from new.titular_cliente_id then
    raise exception 'mina_de_otro_titular: la mina no pertenece al titular de origen' using errcode = '23514';
  end if;
  select p.activo into v_activo from public.puntos_recepcion p where p.id = new.punto_id;
  if v_activo is distinct from true then
    raise exception 'punto_inactivo: el punto de recepción no existe o no está activo' using errcode = '23514';
  end if;
  new.estado := 'registrada';
  new.anulada_por := null;
  new.anulada_en := null;
  new.anulacion_motivo := null;
  new.created_at := now();
  return new;
end;
$$;
alter function public.fn_recepcion_alta() owner to postgres;
revoke execute on function public.fn_recepcion_alta() from public, anon, authenticated;

drop trigger if exists recepcion_alta on public.recepciones;
create trigger recepcion_alta
  before insert on public.recepciones
  for each row execute function public.fn_recepcion_alta();

create or replace function public.fn_recepcion_evento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_punto text;
begin
  select nombre into v_punto from public.puntos_recepcion where id = new.punto_id;
  perform public.emitir_evento_recepcion(new.lote_id, 'recepcion', new.receptor_user_id, v_punto, null, null,
    jsonb_build_object(
      'recepcion', new.codigo, 'recepcion_id', new.id, 'punto_id', new.punto_id, 'mina_id', new.mina_id,
      'modo_entrega', new.modo_entrega, 'guia', coalesce(new.guia, ''), 'estado_embalaje', new.estado_embalaje));
  return null;
end;
$$;
alter function public.fn_recepcion_evento() owner to postgres;
revoke execute on function public.fn_recepcion_evento() from public, anon, authenticated;

drop trigger if exists recepcion_evento on public.recepciones;
create trigger recepcion_evento
  after insert on public.recepciones
  for each row execute function public.fn_recepcion_evento();

-- (f) Sin DELETE; el único cambio es la anulación, vía anular_recepcion().
create or replace function public.fn_recepcion_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'recepciones es indeleble: la anulación es un evento de corrección' using errcode = '23514';
  end if;
  if coalesce(current_setting('mape.anulacion_recepcion', true), '') <> 'on' then
    raise exception 'recepciones: los asientos no se modifican; use anular_recepcion()' using errcode = '23514';
  end if;
  if not (old.estado = 'registrada' and new.estado = 'anulada') then
    raise exception 'recepciones: el único cambio permitido es registrada → anulada' using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_recepcion_inmutable() owner to postgres;
revoke execute on function public.fn_recepcion_inmutable() from public, anon, authenticated;

drop trigger if exists recepcion_inmutable on public.recepciones;
create trigger recepcion_inmutable
  before update or delete on public.recepciones
  for each row execute function public.fn_recepcion_inmutable();

alter table public.recepciones enable row level security;
revoke all on table public.recepciones from public, anon, authenticated, service_role;
grant select, insert, update on table public.recepciones to service_role;
grant select on table public.recepciones to authenticated;
revoke delete, truncate on table public.recepciones from anon, authenticated, service_role;
drop policy if exists recepciones_service_all on public.recepciones;
create policy recepciones_service_all on public.recepciones
  for all to service_role using (true) with check (true);
drop policy if exists recepciones_personal_read on public.recepciones;
create policy recepciones_personal_read on public.recepciones
  for select to authenticated using (public.alcanza_punto(punto_id));
drop policy if exists recepciones_titular_read_own on public.recepciones;
create policy recepciones_titular_read_own on public.recepciones
  for select to authenticated
  using (titular_cliente_id = (select public.cliente_del_usuario()));

-- ═══ 5. cajas ═══════════════════════════════════════════════════════════════

create table if not exists public.cajas (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  punto_id              uuid not null references public.puntos_recepcion(id) on delete restrict,
  titular_cliente_id    uuid not null references public.clientes(id) on delete restrict,
  laboratorio_org_id    uuid not null references public.organizaciones(id) on delete restrict,
  precinto              text null,
  estado                text not null default 'abierta',
  manifiesto            jsonb null,
  manifiesto_canonico   text null,
  manifiesto_hash       text null,
  creada_por            uuid not null,
  cerrada_por           uuid null,
  cerrada_en            timestamptz null,
  created_at            timestamptz not null default now(),
  constraint cajas_estado_check check (estado in ('abierta', 'cerrada', 'enviada', 'recibida', 'anulada')),
  -- (c) no se cierra una caja sin manifiesto.
  constraint cajas_manifiesto_check check (
    estado in ('abierta', 'anulada')
    or (manifiesto is not null and manifiesto_canonico is not null
        and manifiesto_hash ~ '^[0-9a-f]{64}$' and cerrada_por is not null)),
  constraint cajas_precinto_check check (estado in ('abierta', 'anulada') or length(trim(coalesce(precinto, ''))) >= 1)
);

create index if not exists idx_cajas_punto on public.cajas (punto_id, created_at desc);
create index if not exists idx_cajas_titular on public.cajas (titular_cliente_id);

comment on table public.cajas is
  'Contenedor que agrupa sobres de UN solo titular de origen para su envío al laboratorio. Al cerrarse queda con su manifiesto (JSON canónico + SHA-256) y número de precinto. Sin precios ni montos. Sin DELETE.';
comment on column public.cajas.manifiesto_hash is 'SHA-256 de manifiesto_canonico. Lo calcula lib/recepcion/manifiesto.ts y lo verifica cerrar_caja().';

create or replace function public.fn_caja_alta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
  v_activo boolean;
begin
  select tipo, activo into v_tipo, v_activo from public.organizaciones where id = new.laboratorio_org_id;
  if v_tipo is distinct from 'laboratorio' or v_activo is distinct from true then
    raise exception 'destino_no_es_laboratorio: el destino debe ser una organización activa de tipo laboratorio'
      using errcode = '23514';
  end if;
  if not public.perfil_aprobado_de_cliente(new.titular_cliente_id) then
    raise exception 'perfil_no_aprobado: el titular de origen no tiene un perfil aprobado' using errcode = '23514';
  end if;
  new.estado := 'abierta';
  new.manifiesto := null;
  new.manifiesto_canonico := null;
  new.manifiesto_hash := null;
  new.cerrada_por := null;
  new.cerrada_en := null;
  new.created_at := now();
  return new;
end;
$$;
alter function public.fn_caja_alta() owner to postgres;
revoke execute on function public.fn_caja_alta() from public, anon, authenticated;

drop trigger if exists caja_alta on public.cajas;
create trigger caja_alta
  before insert on public.cajas
  for each row execute function public.fn_caja_alta();

-- Las cajas solo cambian de estado por las funciones de abajo.
create or replace function public.fn_caja_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'cajas es indeleble' using errcode = '23514';
  end if;
  if coalesce(current_setting('mape.operacion_caja', true), '') <> 'on' then
    raise exception 'cajas: el estado solo cambia con cerrar_caja(), registrar_envio_laboratorio() o registrar_recepcion_laboratorio()'
      using errcode = '23514';
  end if;
  if new.titular_cliente_id <> old.titular_cliente_id
     or new.punto_id <> old.punto_id
     or new.laboratorio_org_id <> old.laboratorio_org_id
     or new.codigo <> old.codigo then
    raise exception 'cajas: titular, punto, destino y código no cambian' using errcode = '23514';
  end if;
  if old.manifiesto_hash is not null and new.manifiesto_hash is distinct from old.manifiesto_hash then
    raise exception 'cajas: el manifiesto de una caja cerrada no se modifica' using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_caja_inmutable() owner to postgres;
revoke execute on function public.fn_caja_inmutable() from public, anon, authenticated;

drop trigger if exists caja_inmutable on public.cajas;
create trigger caja_inmutable
  before update or delete on public.cajas
  for each row execute function public.fn_caja_inmutable();

alter table public.cajas enable row level security;
revoke all on table public.cajas from public, anon, authenticated, service_role;
grant select, insert, update on table public.cajas to service_role;
grant select on table public.cajas to authenticated;
revoke delete, truncate on table public.cajas from anon, authenticated, service_role;
drop policy if exists cajas_service_all on public.cajas;
create policy cajas_service_all on public.cajas
  for all to service_role using (true) with check (true);
drop policy if exists cajas_personal_read on public.cajas;
create policy cajas_personal_read on public.cajas
  for select to authenticated using (public.alcanza_punto(punto_id));
drop policy if exists cajas_titular_read_own on public.cajas;
create policy cajas_titular_read_own on public.cajas
  for select to authenticated
  using (titular_cliente_id = (select public.cliente_del_usuario()));

-- ═══ 6. sobres ══════════════════════════════════════════════════════════════

create table if not exists public.sobres (
  id                  uuid primary key default gen_random_uuid(),
  recepcion_id        uuid not null references public.recepciones(id) on delete restrict,
  lote_id             uuid not null references public.lotes(id) on delete restrict,
  mina_id             uuid not null references public.minas(id) on delete restrict,
  titular_cliente_id  uuid not null references public.clientes(id) on delete restrict,
  peso_bruto_g        numeric(14,3) null,
  peso_neto_g         numeric(14,3) null,
  instrumento         text null,
  calibracion_fecha   date null,
  ley_fino            numeric(7,6) null,
  certificado_id      uuid null,
  numero_sello        text null,
  etiqueta            text null,
  caja_id             uuid null references public.cajas(id) on delete restrict,
  estado              text not null default 'abierto',
  registrado_por      uuid not null,
  actualizado_por     uuid null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint sobres_estado_check check (estado in ('abierto', 'empacado', 'anulado')),
  constraint sobres_peso_check check ((peso_bruto_g is null or peso_bruto_g >= 0) and (peso_neto_g is null or peso_neto_g >= 0)
                                      and (peso_bruto_g is null or peso_neto_g is null or peso_neto_g <= peso_bruto_g)),
  constraint sobres_ley_check check (ley_fino is null or (ley_fino >= 0 and ley_fino <= 1)),
  constraint sobres_caja_estado_check check ((caja_id is null) = (estado <> 'empacado'))
);

create unique index if not exists uq_sobres_etiqueta on public.sobres (etiqueta) where etiqueta is not null and estado <> 'anulado';
create index if not exists idx_sobres_recepcion on public.sobres (recepcion_id);
create index if not exists idx_sobres_caja on public.sobres (caja_id);
create index if not exists idx_sobres_titular on public.sobres (titular_cliente_id);

comment on table public.sobres is
  'Sobre de material de UNA mina (la de su recepción), con su pesaje, análisis de ley y etiqueta de origen (número de sello del certificado de origen ya registrado). Sin precios ni montos. Sin DELETE.';
comment on column public.sobres.instrumento is 'Balanza o instrumento usado en el pesaje, si se registró. No se fijan tolerancias: [POR CONFIRMAR].';
comment on column public.sobres.ley_fino is 'Ley como fracción 0–1, resultado del análisis de recepción. No se calcula precio a partir de ella.';
comment on column public.sobres.numero_sello is 'Número de sello MAPE.LEGAL del certificado de origen ya registrado (lib/certificados). No se crea un sello ni un QR nuevo.';

create or replace function public.fn_sobre_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec  public.recepciones%rowtype;
  v_caja public.cajas%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'sobres es indeleble: la anulación es un evento de corrección' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select * into v_rec from public.recepciones where id = new.recepcion_id;
    if not found then
      raise exception 'recepcion_no_existe: %', new.recepcion_id using errcode = '23503';
    end if;
    if v_rec.estado <> 'registrada' then
      raise exception 'recepcion_anulada: no admite sobres' using errcode = '23514';
    end if;
    -- (a) un sobre pertenece a UNA mina: la de su recepción.
    new.mina_id := coalesce(new.mina_id, v_rec.mina_id);
    if new.mina_id <> v_rec.mina_id then
      raise exception 'sobre_de_otra_mina: el sobre debe ser de la mina de su recepción' using errcode = '23514';
    end if;
    new.lote_id := v_rec.lote_id;
    new.titular_cliente_id := v_rec.titular_cliente_id;
    new.caja_id := null;
    new.estado := 'abierto';
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE
  if new.recepcion_id <> old.recepcion_id or new.mina_id <> old.mina_id
     or new.lote_id <> old.lote_id or new.titular_cliente_id <> old.titular_cliente_id
     or new.registrado_por <> old.registrado_por then
    raise exception 'sobres: recepción, mina, lote, titular y autor no cambian' using errcode = '23514';
  end if;
  if old.estado = 'anulado' then
    raise exception 'sobres: un sobre anulado no se modifica' using errcode = '23514';
  end if;
  -- Un sobre dentro de una caja ya cerrada queda congelado.
  if old.caja_id is not null then
    select * into v_caja from public.cajas where id = old.caja_id;
    if v_caja.estado <> 'abierta' and coalesce(current_setting('mape.anulacion_recepcion', true), '') <> 'on' then
      raise exception 'sobre_en_caja_cerrada: el contenido de una caja cerrada no se modifica' using errcode = '23514';
    end if;
    if new.caja_id is not null and new.caja_id = old.caja_id
       and (new.peso_neto_g is distinct from old.peso_neto_g or new.peso_bruto_g is distinct from old.peso_bruto_g
            or new.etiqueta is distinct from old.etiqueta or new.numero_sello is distinct from old.numero_sello
            or new.ley_fino is distinct from old.ley_fino) then
      raise exception 'sobre_empacado: saque el sobre de la caja antes de corregir su pesaje o etiqueta' using errcode = '23514';
    end if;
  end if;

  if new.caja_id is not null and new.caja_id is distinct from old.caja_id then
    select * into v_caja from public.cajas where id = new.caja_id for update;
    if not found then
      raise exception 'caja_no_existe: %', new.caja_id using errcode = '23503';
    end if;
    if v_caja.estado <> 'abierta' then
      raise exception 'caja_no_abierta: solo se empaca en una caja abierta' using errcode = '23514';
    end if;
    -- (b) una caja contiene sobres de UN solo titular de origen.
    if v_caja.titular_cliente_id <> new.titular_cliente_id then
      raise exception 'mezcla_de_titulares: la caja es de otro titular de origen; los lotes de titulares distintos no se mezclan'
        using errcode = '23514';
    end if;
    -- (d) solo entra a una caja un sobre pesado y etiquetado.
    if new.peso_neto_g is null then
      raise exception 'sobre_sin_pesar: el sobre no tiene peso neto' using errcode = '23514';
    end if;
    if coalesce(trim(new.etiqueta), '') = '' or coalesce(trim(new.numero_sello), '') = '' then
      raise exception 'sobre_sin_etiquetar: el sobre no tiene etiqueta y número de sello' using errcode = '23514';
    end if;
  end if;

  if new.estado <> 'anulado' then
    new.estado := case when new.caja_id is null then 'abierto' else 'empacado' end;
  else
    new.caja_id := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
alter function public.fn_sobre_integridad() owner to postgres;
revoke execute on function public.fn_sobre_integridad() from public, anon, authenticated;

drop trigger if exists sobre_integridad on public.sobres;
create trigger sobre_integridad
  before insert or update or delete on public.sobres
  for each row execute function public.fn_sobre_integridad();

-- Cada paso emite su evento encadenado.
create or replace function public.fn_sobre_eventos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := coalesce(new.actualizado_por, new.registrado_por);
  v_base  jsonb := jsonb_build_object('sobre_id', new.id, 'recepcion_id', new.recepcion_id, 'mina_id', new.mina_id);
  v_caja  text;
begin
  if tg_op = 'INSERT' then
    perform public.emitir_evento_recepcion(new.lote_id, 'empaque_sobre', new.registrado_por, null, null, null, v_base);
  end if;
  if new.estado = 'anulado' then
    return null;
  end if;
  if new.peso_neto_g is not null
     and (tg_op = 'INSERT' or new.peso_neto_g is distinct from old.peso_neto_g or new.peso_bruto_g is distinct from old.peso_bruto_g) then
    perform public.emitir_evento_recepcion(new.lote_id, 'pesaje', v_actor, null, new.peso_neto_g, null,
      v_base || jsonb_build_object(
        'peso_bruto_g', coalesce(to_char(new.peso_bruto_g, 'FM999999999990.000'), ''),
        'instrumento', coalesce(new.instrumento, ''),
        'calibracion_fecha', coalesce(new.calibracion_fecha::text, '')));
  end if;
  if new.ley_fino is not null and (tg_op = 'INSERT' or new.ley_fino is distinct from old.ley_fino) then
    perform public.emitir_evento_recepcion(new.lote_id, 'analisis', v_actor, null, null, new.ley_fino, v_base);
  end if;
  if new.etiqueta is not null
     and (tg_op = 'INSERT' or new.etiqueta is distinct from old.etiqueta or new.numero_sello is distinct from old.numero_sello) then
    perform public.emitir_evento_recepcion(new.lote_id, 'etiquetado', v_actor, null, null, null,
      v_base || jsonb_build_object('etiqueta', new.etiqueta, 'numero_sello', coalesce(new.numero_sello, '')));
  end if;
  return null;
end;
$$;
alter function public.fn_sobre_eventos() owner to postgres;
revoke execute on function public.fn_sobre_eventos() from public, anon, authenticated;

drop trigger if exists sobre_eventos on public.sobres;
create trigger sobre_eventos
  after insert or update on public.sobres
  for each row execute function public.fn_sobre_eventos();

alter table public.sobres enable row level security;
revoke all on table public.sobres from public, anon, authenticated, service_role;
grant select, insert, update on table public.sobres to service_role;
grant select on table public.sobres to authenticated;
revoke delete, truncate on table public.sobres from anon, authenticated, service_role;
drop policy if exists sobres_service_all on public.sobres;
create policy sobres_service_all on public.sobres
  for all to service_role using (true) with check (true);
drop policy if exists sobres_personal_read on public.sobres;
create policy sobres_personal_read on public.sobres
  for select to authenticated
  using (exists (select 1 from public.recepciones r
                  where r.id = sobres.recepcion_id and public.alcanza_punto(r.punto_id)));
drop policy if exists sobres_titular_read_own on public.sobres;
create policy sobres_titular_read_own on public.sobres
  for select to authenticated
  using (titular_cliente_id = (select public.cliente_del_usuario()));

-- ═══ 7. cerrar_caja ═════════════════════════════════════════════════════════

create or replace function public.cerrar_caja(
  p_caja uuid, p_precinto text, p_manifiesto_canonico text, p_manifiesto_hash text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caja     public.cajas%rowtype;
  v_manif    jsonb;
  v_total    integer;
  v_incompletos integer;
  v_esperado text;
  v_recibido text;
  v_precinto text := nullif(trim(coalesce(p_precinto, '')), '');
  r          record;
begin
  select * into v_caja from public.cajas where id = p_caja for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'caja_no_existe');
  end if;
  if v_caja.estado <> 'abierta' then
    return jsonb_build_object('ok', false, 'motivo', 'caja_no_abierta', 'estado', v_caja.estado);
  end if;
  if v_precinto is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_precinto');
  end if;

  select count(*),
         count(*) filter (where s.peso_neto_g is null or coalesce(trim(s.etiqueta), '') = '' or coalesce(trim(s.numero_sello), '') = '')
    into v_total, v_incompletos
    from public.sobres s where s.caja_id = p_caja and s.estado = 'empacado';
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'caja_vacia');
  end if;
  -- (d) ningún sobre sin pesar o sin etiquetar.
  if v_incompletos > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'sobres_incompletos', 'cantidad', v_incompletos);
  end if;
  -- (b) defensa: un solo titular.
  if exists (select 1 from public.sobres s where s.caja_id = p_caja and s.titular_cliente_id <> v_caja.titular_cliente_id) then
    return jsonb_build_object('ok', false, 'motivo', 'mezcla_de_titulares');
  end if;

  -- (c) manifiesto obligatorio, íntegro y fiel al contenido real de la caja.
  if coalesce(p_manifiesto_canonico, '') = '' or coalesce(p_manifiesto_hash, '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_manifiesto');
  end if;
  if public.sha256_hex(p_manifiesto_canonico) <> p_manifiesto_hash then
    return jsonb_build_object('ok', false, 'motivo', 'hash_no_coincide');
  end if;
  begin
    v_manif := p_manifiesto_canonico::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'motivo', 'manifiesto_invalido');
  end;
  select coalesce(string_agg(s.id::text || '=' || to_char(s.peso_neto_g, 'FM999999999990.000'), ',' order by s.id::text), '')
    into v_esperado
    from public.sobres s where s.caja_id = p_caja and s.estado = 'empacado';
  select coalesce(string_agg((e->>'id') || '=' || (e->>'peso_neto_g'), ',' order by (e->>'id')), '')
    into v_recibido
    from jsonb_array_elements(coalesce(v_manif->'sobres', '[]'::jsonb)) e;
  if v_esperado <> v_recibido
     or (v_manif->'caja'->>'codigo') is distinct from v_caja.codigo
     or (v_manif->'caja'->>'titular_origen_id') is distinct from v_caja.titular_cliente_id::text
     or (v_manif->'caja'->>'precinto') is distinct from v_precinto then
    return jsonb_build_object('ok', false, 'motivo', 'manifiesto_no_corresponde');
  end if;

  perform set_config('mape.operacion_caja', 'on', true);
  update public.cajas
     set estado = 'cerrada', precinto = v_precinto, manifiesto = v_manif,
         manifiesto_canonico = p_manifiesto_canonico, manifiesto_hash = p_manifiesto_hash,
         cerrada_por = p_actor, cerrada_en = now()
   where id = p_caja;
  perform set_config('mape.operacion_caja', '', true);

  for r in select distinct s.lote_id from public.sobres s where s.caja_id = p_caja and s.estado = 'empacado' loop
    perform public.emitir_evento_recepcion(r.lote_id, 'empaque_caja', p_actor, null, null, null,
      jsonb_build_object('caja', v_caja.codigo, 'caja_id', p_caja, 'precinto', v_precinto,
                         'manifiesto_hash', p_manifiesto_hash, 'sobres', v_total));
  end loop;

  return jsonb_build_object('ok', true, 'estado', 'cerrada', 'sobres', v_total, 'manifiesto_hash', p_manifiesto_hash);
end;
$$;
alter function public.cerrar_caja(uuid, text, text, text, uuid) owner to postgres;
revoke execute on function public.cerrar_caja(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.cerrar_caja(uuid, text, text, text, uuid) to service_role;
comment on function public.cerrar_caja(uuid, text, text, text, uuid) is
  'Cierra una caja abierta. Exige precinto, al menos un sobre, todos pesados y etiquetados, un solo titular y un manifiesto cuyo SHA-256 coincide y que lista EXACTAMENTE los sobres de la caja con sus pesos. Emite el evento empaque_caja en cada lote. EXECUTE solo service_role.';

-- ═══ 8. envíos y recepciones en laboratorio ═════════════════════════════════

create table if not exists public.envios_laboratorio (
  id                   uuid primary key default gen_random_uuid(),
  caja_id              uuid not null unique references public.cajas(id) on delete restrict,
  laboratorio_org_id   uuid not null references public.organizaciones(id) on delete restrict,
  medio                text not null,
  guia                 text null,
  fecha_envio          timestamptz not null,
  responsable_user_id  uuid not null,
  created_at           timestamptz not null default now(),
  constraint envios_laboratorio_medio_check check (medio in ('en_persona', 'encargo_expreso', 'dhl', 'otro'))
);

comment on table public.envios_laboratorio is
  'Envío o entrega de una caja cerrada al laboratorio de destino: medio, guía, fecha y responsable. Asiento de custodia APPEND-ONLY (un envío por caja). Sin montos.';

drop trigger if exists envios_laboratorio_append_only on public.envios_laboratorio;
create trigger envios_laboratorio_append_only
  before update or delete on public.envios_laboratorio
  for each row execute function public.fn_append_only();

alter table public.envios_laboratorio enable row level security;
revoke all on table public.envios_laboratorio from public, anon, authenticated, service_role;
grant select, insert on table public.envios_laboratorio to service_role;
grant select on table public.envios_laboratorio to authenticated;
revoke update, delete, truncate on table public.envios_laboratorio from anon, authenticated, service_role;
drop policy if exists envios_laboratorio_service_all on public.envios_laboratorio;
create policy envios_laboratorio_service_all on public.envios_laboratorio
  for all to service_role using (true) with check (true);
drop policy if exists envios_laboratorio_personal_read on public.envios_laboratorio;
create policy envios_laboratorio_personal_read on public.envios_laboratorio
  for select to authenticated
  using (exists (select 1 from public.cajas c where c.id = envios_laboratorio.caja_id and public.alcanza_punto(c.punto_id)));

create table if not exists public.recepciones_laboratorio (
  id                   uuid primary key default gen_random_uuid(),
  caja_id              uuid not null unique references public.cajas(id) on delete restrict,
  envio_id             uuid not null references public.envios_laboratorio(id) on delete restrict,
  fecha_recepcion      timestamptz not null,
  receptor_user_id     uuid not null,
  precinto_integro     boolean not null,
  pesos                jsonb not null,
  conciliacion         jsonb not null,
  estado_conciliacion  text not null,
  created_at           timestamptz not null default now(),
  constraint recepciones_laboratorio_estado_check check (estado_conciliacion in ('conciliada', 'discrepancia', 'incompleto', 'umbral_no_configurado')),
  constraint recepciones_laboratorio_pesos_check check (jsonb_typeof(pesos) = 'array')
);

comment on table public.recepciones_laboratorio is
  'Recepción de la caja en el laboratorio, registrada por el personal: pesos por sobre y resultado de la conciliación contra el manifiesto. Con el umbral sin configurar nada se da por conciliado (estado umbral_no_configurado). APPEND-ONLY (una por caja).';

drop trigger if exists recepciones_laboratorio_append_only on public.recepciones_laboratorio;
create trigger recepciones_laboratorio_append_only
  before update or delete on public.recepciones_laboratorio
  for each row execute function public.fn_append_only();

alter table public.recepciones_laboratorio enable row level security;
revoke all on table public.recepciones_laboratorio from public, anon, authenticated, service_role;
grant select, insert on table public.recepciones_laboratorio to service_role;
grant select on table public.recepciones_laboratorio to authenticated;
revoke update, delete, truncate on table public.recepciones_laboratorio from anon, authenticated, service_role;
drop policy if exists recepciones_laboratorio_service_all on public.recepciones_laboratorio;
create policy recepciones_laboratorio_service_all on public.recepciones_laboratorio
  for all to service_role using (true) with check (true);
drop policy if exists recepciones_laboratorio_personal_read on public.recepciones_laboratorio;
create policy recepciones_laboratorio_personal_read on public.recepciones_laboratorio
  for select to authenticated
  using (exists (select 1 from public.cajas c where c.id = recepciones_laboratorio.caja_id and public.alcanza_punto(c.punto_id)));

create or replace function public.registrar_envio_laboratorio(
  p_caja uuid, p_medio text, p_guia text, p_fecha timestamptz, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caja  public.cajas%rowtype;
  v_envio uuid;
  r       record;
begin
  select * into v_caja from public.cajas where id = p_caja for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'caja_no_existe');
  end if;
  -- Solo sale una caja CERRADA: con manifiesto y sobres completos (c) y (d).
  if v_caja.estado <> 'cerrada' then
    return jsonb_build_object('ok', false, 'motivo', 'caja_no_cerrada', 'estado', v_caja.estado);
  end if;
  if p_medio not in ('en_persona', 'encargo_expreso', 'dhl', 'otro') then
    return jsonb_build_object('ok', false, 'motivo', 'medio_invalido');
  end if;
  if exists (select 1 from public.sobres s where s.caja_id = p_caja
              and (s.peso_neto_g is null or coalesce(trim(s.etiqueta), '') = '')) then
    return jsonb_build_object('ok', false, 'motivo', 'sobres_incompletos');
  end if;

  insert into public.envios_laboratorio (caja_id, laboratorio_org_id, medio, guia, fecha_envio, responsable_user_id)
  values (p_caja, v_caja.laboratorio_org_id, p_medio, nullif(trim(coalesce(p_guia, '')), ''), coalesce(p_fecha, now()), p_actor)
  returning id into v_envio;

  perform set_config('mape.operacion_caja', 'on', true);
  update public.cajas set estado = 'enviada' where id = p_caja;
  perform set_config('mape.operacion_caja', '', true);

  for r in select distinct s.lote_id from public.sobres s where s.caja_id = p_caja loop
    perform public.emitir_evento_recepcion(r.lote_id, 'envio_laboratorio', p_actor, null, null, null,
      jsonb_build_object('caja', v_caja.codigo, 'caja_id', p_caja, 'envio_id', v_envio, 'medio', p_medio,
                         'guia', coalesce(nullif(trim(coalesce(p_guia, '')), ''), ''),
                         'laboratorio_org_id', v_caja.laboratorio_org_id, 'manifiesto_hash', v_caja.manifiesto_hash));
  end loop;
  return jsonb_build_object('ok', true, 'envio_id', v_envio, 'estado', 'enviada');
end;
$$;
alter function public.registrar_envio_laboratorio(uuid, text, text, timestamptz, uuid) owner to postgres;
revoke execute on function public.registrar_envio_laboratorio(uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.registrar_envio_laboratorio(uuid, text, text, timestamptz, uuid) to service_role;

-- Conciliación manifiesto ↔ recepción en laboratorio. Réplica de
-- lib/recepcion/reglas.ts conciliarManifiesto(); mismo umbral que conciliar_lote().
create or replace function public.registrar_recepcion_laboratorio(
  p_caja uuid, p_fecha timestamptz, p_precinto_integro boolean, p_pesos jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caja    public.cajas%rowtype;
  v_envio   uuid;
  v_umbral  numeric := null;
  v_valor   text;
  v_difs    jsonb := '[]'::jsonb;
  v_faltan  jsonb := '[]'::jsonb;
  v_excede  boolean := false;
  v_estado  text;
  v_pct     numeric;
  v_recibido numeric;
  s         record;
  r         record;
begin
  select * into v_caja from public.cajas where id = p_caja for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'caja_no_existe');
  end if;
  if v_caja.estado <> 'enviada' then
    return jsonb_build_object('ok', false, 'motivo', 'caja_no_enviada', 'estado', v_caja.estado);
  end if;
  if p_precinto_integro is null or jsonb_typeof(coalesce(p_pesos, 'null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
  end if;
  select id into v_envio from public.envios_laboratorio where caja_id = p_caja;

  -- Umbral: NULL si no está configurado o no es numérico (igual que conciliar_lote).
  select nullif(trim(valor), '') into v_valor
    from public.configuracion_sistema where clave = 'umbral_conciliacion_peso_pct';
  begin
    v_umbral := v_valor::numeric;
  exception when others then
    v_umbral := null;
  end;
  if v_umbral is not null and v_umbral < 0 then
    v_umbral := null;
  end if;

  for s in
    select sb.id, sb.lote_id, sb.peso_neto_g
      from public.sobres sb where sb.caja_id = p_caja order by sb.id::text
  loop
    select (e->>'peso_g')::numeric into v_recibido
      from jsonb_array_elements(p_pesos) e
     where e->>'sobre_id' = s.id::text and coalesce(e->>'peso_g', '') ~ '^[0-9]+(\.[0-9]+)?$'
     limit 1;
    if not found then
      v_faltan := v_faltan || to_jsonb(s.id::text);
      continue;
    end if;
    if s.peso_neto_g > 0 then
      v_pct := abs(v_recibido - s.peso_neto_g) / s.peso_neto_g * 100;
    elsif v_recibido = 0 then
      v_pct := 0;
    else
      v_pct := null;
    end if;
    v_difs := v_difs || jsonb_build_object(
      'sobre_id', s.id, 'peso_manifiesto_g', to_char(s.peso_neto_g, 'FM999999999990.000'),
      'peso_recibido_g', to_char(v_recibido, 'FM999999999990.000'),
      'diferencia_pct', v_pct,
      'excede', case when v_umbral is null then null when v_pct is null then true else v_pct > v_umbral end);
    if v_umbral is not null and (v_pct is null or v_pct > v_umbral) then
      v_excede := true;
    end if;
  end loop;

  if v_umbral is null then
    v_estado := 'umbral_no_configurado';
  elsif jsonb_array_length(v_faltan) > 0 then
    v_estado := 'incompleto';
  elsif v_excede or not p_precinto_integro then
    v_estado := 'discrepancia';
  else
    v_estado := 'conciliada';
  end if;

  insert into public.recepciones_laboratorio
    (caja_id, envio_id, fecha_recepcion, receptor_user_id, precinto_integro, pesos, conciliacion, estado_conciliacion)
  values (p_caja, v_envio, coalesce(p_fecha, now()), p_actor, p_precinto_integro, p_pesos,
          jsonb_build_object('diferencias', v_difs, 'faltan', v_faltan, 'umbral_pct', v_umbral,
                             'precinto_integro', p_precinto_integro), v_estado);

  perform set_config('mape.operacion_caja', 'on', true);
  update public.cajas set estado = 'recibida' where id = p_caja;
  perform set_config('mape.operacion_caja', '', true);

  for r in
    select sb.lote_id,
           sum((select (e->>'peso_g')::numeric from jsonb_array_elements(p_pesos) e
                 where e->>'sobre_id' = sb.id::text and coalesce(e->>'peso_g', '') ~ '^[0-9]+(\.[0-9]+)?$' limit 1)) as peso
      from public.sobres sb where sb.caja_id = p_caja group by sb.lote_id
  loop
    perform public.emitir_evento_recepcion(r.lote_id, 'recepcion_laboratorio', p_actor, null, r.peso, null,
      jsonb_build_object('caja', v_caja.codigo, 'caja_id', p_caja, 'manifiesto_hash', v_caja.manifiesto_hash,
                         'estado_conciliacion', v_estado, 'precinto_integro', p_precinto_integro));
    -- Alertas existentes de la 043, por lote.
    if v_estado = 'umbral_no_configurado' then
      if not exists (select 1 from public.alertas_lote
                      where lote_id = r.lote_id and tipo = 'umbral_no_configurado' and not resuelta) then
        insert into public.alertas_lote (lote_id, tipo, detalle)
        values (r.lote_id, 'umbral_no_configurado',
                jsonb_build_object('clave', 'umbral_conciliacion_peso_pct', 'actor', p_actor, 'caja_id', p_caja));
      end if;
    elsif v_estado = 'discrepancia' then
      insert into public.alertas_lote (lote_id, tipo, detalle)
      values (r.lote_id, 'conciliacion_peso',
              jsonb_build_object('umbral_pct', v_umbral, 'caja_id', p_caja, 'precinto_integro', p_precinto_integro,
                                 'diferencias', v_difs, 'actor', p_actor));
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'estado_conciliacion', v_estado, 'conciliada', v_estado = 'conciliada',
                            'diferencias', v_difs, 'faltan', v_faltan, 'umbral_pct', v_umbral);
end;
$$;
alter function public.registrar_recepcion_laboratorio(uuid, timestamptz, boolean, jsonb, uuid) owner to postgres;
revoke execute on function public.registrar_recepcion_laboratorio(uuid, timestamptz, boolean, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.registrar_recepcion_laboratorio(uuid, timestamptz, boolean, jsonb, uuid) to service_role;
comment on function public.registrar_recepcion_laboratorio(uuid, timestamptz, boolean, jsonb, uuid) is
  'Registra la recepción de una caja enviada y concilia los pesos por sobre contra el manifiesto con el umbral umbral_conciliacion_peso_pct. Umbral NULL → estado umbral_no_configurado + alerta, nada conciliado. Diferencia > umbral o precinto roto → discrepancia + alerta conciliacion_peso. EXECUTE solo service_role.';

-- ═══ 9. anular_recepcion ════════════════════════════════════════════════════

create or replace function public.anular_recepcion(p_recepcion uuid, p_motivo text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec    public.recepciones%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into v_rec from public.recepciones where id = p_recepcion for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'recepcion_no_existe');
  end if;
  if v_rec.estado = 'anulada' then
    return jsonb_build_object('ok', false, 'motivo', 'ya_anulada');
  end if;
  if length(coalesce(v_motivo, '')) < 5 then
    return jsonb_build_object('ok', false, 'motivo', 'motivo_obligatorio');
  end if;
  -- Lo que ya salió en una caja cerrada no se anula aquí.
  if exists (select 1 from public.sobres s join public.cajas c on c.id = s.caja_id
              where s.recepcion_id = p_recepcion and c.estado <> 'abierta') then
    return jsonb_build_object('ok', false, 'motivo', 'sobres_en_caja_cerrada');
  end if;

  perform set_config('mape.anulacion_recepcion', 'on', true);
  update public.sobres set estado = 'anulado', caja_id = null, actualizado_por = p_actor
   where recepcion_id = p_recepcion and estado <> 'anulado';
  update public.recepciones
     set estado = 'anulada', anulada_por = p_actor, anulada_en = now(), anulacion_motivo = v_motivo
   where id = p_recepcion;
  perform set_config('mape.anulacion_recepcion', '', true);

  -- (f) la anulación ES un evento de corrección; ningún asiento se borra.
  perform public.emitir_evento_recepcion(v_rec.lote_id, 'correccion', p_actor, null, null, null,
    jsonb_build_object('anula', 'recepcion', 'recepcion', v_rec.codigo, 'recepcion_id', p_recepcion, 'motivo', v_motivo));
  return jsonb_build_object('ok', true, 'estado', 'anulada');
end;
$$;
alter function public.anular_recepcion(uuid, text, uuid) owner to postgres;
revoke execute on function public.anular_recepcion(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.anular_recepcion(uuid, text, uuid) to service_role;

-- ═══ 10. Verificación post-aplicación (a mano, en Studio) ═══════════════════
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'lote_eventos_tipo_check';
--   select public.verificar_cadena_lote('<uuid de un lote existente>');  -- debe seguir ok=true
--   select tablename, rowsecurity from pg_tables where schemaname = 'public'
--     and tablename in ('recepciones','sobres','cajas','envios_laboratorio','recepciones_laboratorio','partes_flujo','puntos_recepcion');
