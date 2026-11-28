-- 048_organizaciones_membresias.sql
-- NO APLICAR. Escrita en el PR de la reestructura de recepción, acceso y cadena
-- de custodia (28-nov-2026, apilado sobre el #245); la aplica Willis tras revisión.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, con RESPALDO previo ║
-- ║ y aprobación expresa de Willis. Orden: … → 047 → 048.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- TEMA: organizaciones, membresías e invitaciones.
--   · UNA sola entidad `organizaciones` (043). Sus tipos `cooperativa`,
--     `municipio` y `otro` (más `laboratorio` y `centro_acopio`) ya quedaron
--     declarados en el CHECK ampliado por la 047: aquí no se crea otra tabla.
--   · `membresias_organizacion`: pertenencia de un perfil de minero o de un
--     usuario a una organización. Estados pendiente → activa → baja.
--   · `membresias_bitacora`: APPEND-ONLY — quién, qué cambió, de/hacia qué
--     estado y cuándo.
--   · `invitaciones_organizacion`: token de UN solo uso guardado solo como
--     hash, con expiración. Aceptar una invitación NO da derechos de escritura
--     y NO activa la membresía: queda pendiente hasta que la active un
--     verificador distinto de quien dio el alta.
--   · Un municipio adopta el estándar abierto: no puede figurar como parte
--     compradora del flujo.
--
-- "LOS USUARIOS SOLO VEN": las altas, bajas y activaciones las hace el
-- personal por la API. Ningún rol autenticado recibe INSERT/UPDATE aquí.
--
-- DEPENDENCIAS: 047 (tipos de organización, partes_flujo), 046 (perfiles,
-- cliente_del_usuario), 045 (es_personal, bitacora_acciones), 043
-- (organizaciones, fn_append_only, current_rol).
--
-- SIN DATOS DE NEGOCIO sembrados. La vigencia de la invitación la fija la API
-- (lib/organizaciones/invitaciones.ts) y está [POR CONFIRMAR — WILLIS].
--
-- Idempotente.
--
-- PLAN DE REVERSA (documentado; NO ejecutar sin decisión de Willis):
--   drop trigger if exists parte_flujo_municipio on public.partes_flujo;
--   drop function if exists public.aceptar_invitacion_organizacion(text, uuid);
--   -- membresias_organizacion y membresias_bitacora son evidencia: se conservan.
--   -- invitaciones_organizacion: marcar las pendientes como revocadas.

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.partes_flujo') is null then
    raise exception '048: falta la 047 (partes_flujo / tipos de organización)';
  end if;
  if to_regclass('public.perfiles') is null or to_regprocedure('public.cliente_del_usuario()') is null then
    raise exception '048: falta la 046 (perfiles / cliente_del_usuario)';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'organizaciones_tipo_check'
                    and pg_get_constraintdef(oid) like '%cooperativa%'
                    and pg_get_constraintdef(oid) like '%municipio%') then
    raise exception '048: el CHECK de organizaciones.tipo no incluye cooperativa/municipio (aplicar 047)';
  end if;
end $$;

comment on column public.organizaciones.tipo is
  'Tipo de organización: comercializador | planta | auditor (043) · laboratorio | centro_acopio (047) · cooperativa | municipio | otro (048). Un municipio adopta el estándar abierto: no es parte compradora ni intermediario. [POR CONFIRMAR — WILLIS: si municipio o cooperativa pueden tener varios operadores.]';

-- ═══ 1. membresias_organizacion ═════════════════════════════════════════════

create table if not exists public.membresias_organizacion (
  id                    uuid primary key default gen_random_uuid(),
  organizacion_id       uuid not null references public.organizaciones(id) on delete restrict,
  perfil_id             uuid null references public.perfiles(id) on delete restrict,
  user_id               uuid null references auth.users(id) on delete restrict,
  rol_en_organizacion   text not null default 'miembro',
  estado                text not null default 'pendiente',
  alta_por              uuid not null,
  activada_por          uuid null,
  baja_por              uuid null,
  motivo_baja           text null,
  ultimo_actor          uuid not null,
  fecha_alta            timestamptz not null default now(),
  fecha_activacion      timestamptz null,
  fecha_baja            timestamptz null,
  constraint membresias_sujeto_check check ((perfil_id is null) <> (user_id is null)),
  constraint membresias_rol_check check (rol_en_organizacion in ('miembro', 'representante', 'contacto')),
  constraint membresias_estado_check check (estado in ('pendiente', 'activa', 'baja')),
  constraint membresias_activa_check check (estado <> 'activa' or (activada_por is not null and fecha_activacion is not null)),
  constraint membresias_baja_check check (estado <> 'baja' or (baja_por is not null and fecha_baja is not null))
);

create unique index if not exists uq_membresias_perfil on public.membresias_organizacion (organizacion_id, perfil_id)
  where perfil_id is not null and estado <> 'baja';
create unique index if not exists uq_membresias_user on public.membresias_organizacion (organizacion_id, user_id)
  where user_id is not null and estado <> 'baja';
create index if not exists idx_membresias_org on public.membresias_organizacion (organizacion_id, estado);

comment on table public.membresias_organizacion is
  'Pertenencia de un perfil de minero (perfil_id) o de un usuario (user_id) a una organización. Nace pendiente; la activa un verificador distinto de quien dio el alta. La pertenencia es informativa: NO concede derechos de escritura. Sin DELETE: la salida es el estado baja.';
comment on column public.membresias_organizacion.rol_en_organizacion is
  'miembro | representante | contacto. Solo el representante con membresía activa ve la lista de miembros de su organización (lectura).';

create or replace function public.fn_membresia_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol text;
begin
  if tg_op = 'DELETE' then
    raise exception 'membresias_organizacion es indeleble: use el estado baja' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.activada_por := null;
    new.baja_por := null;
    new.motivo_baja := null;
    new.fecha_alta := now();
    new.fecha_activacion := null;
    new.fecha_baja := null;
    new.ultimo_actor := coalesce(new.ultimo_actor, new.alta_por);
    return new;
  end if;

  if new.organizacion_id <> old.organizacion_id
     or new.perfil_id is distinct from old.perfil_id
     or new.user_id is distinct from old.user_id
     or new.alta_por <> old.alta_por
     or new.fecha_alta <> old.fecha_alta then
    raise exception 'membresias: organización, sujeto y alta no cambian' using errcode = '23514';
  end if;

  if new.estado is distinct from old.estado then
    if old.estado = 'pendiente' and new.estado = 'activa' then
      select ur.rol into v_rol from public.user_roles ur where ur.user_id = new.ultimo_actor and ur.activo limit 1;
      if v_rol is null or v_rol not in ('verificador', 'admin') then
        raise exception 'activacion_no_autorizada: solo un verificador activa una membresía' using errcode = '23514';
      end if;
      if new.ultimo_actor = old.alta_por then
        raise exception 'separacion_de_funciones: quien dio el alta no activa la membresía' using errcode = '23514';
      end if;
      new.activada_por := new.ultimo_actor;
      new.fecha_activacion := now();
    elsif old.estado in ('pendiente', 'activa') and new.estado = 'baja' then
      if length(trim(coalesce(new.motivo_baja, ''))) < 5 then
        raise exception 'motivo_obligatorio: la baja exige motivo' using errcode = '23514';
      end if;
      new.baja_por := new.ultimo_actor;
      new.fecha_baja := now();
    else
      raise exception 'transicion_invalida: membresía % → %', old.estado, new.estado using errcode = '23514';
    end if;
  elsif old.estado = 'baja' then
    raise exception 'transicion_invalida: una membresía de baja no se modifica' using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_membresia_integridad() owner to postgres;
revoke execute on function public.fn_membresia_integridad() from public, anon, authenticated;

drop trigger if exists membresia_integridad on public.membresias_organizacion;
create trigger membresia_integridad
  before insert or update or delete on public.membresias_organizacion
  for each row execute function public.fn_membresia_integridad();

-- ═══ 2. membresias_bitacora (append-only) ═══════════════════════════════════

create table if not exists public.membresias_bitacora (
  id               uuid primary key default gen_random_uuid(),
  membresia_id     uuid not null references public.membresias_organizacion(id) on delete restrict,
  organizacion_id  uuid not null,
  actor_user_id    uuid not null,
  actor_rol        text null,
  cambio           text not null,
  de_estado        text null,
  a_estado         text not null,
  de_rol           text null,
  a_rol            text not null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_membresias_bitacora_membresia on public.membresias_bitacora (membresia_id, created_at);

comment on table public.membresias_bitacora is
  'Bitácora APPEND-ONLY de membresías: quién hizo el cambio (y con qué rol), qué cambió, de qué estado a cuál y cuándo. La escribe un trigger en cada alta y cada cambio. Sin UPDATE ni DELETE.';

drop trigger if exists membresias_bitacora_append_only on public.membresias_bitacora;
create trigger membresias_bitacora_append_only
  before update or delete on public.membresias_bitacora
  for each row execute function public.fn_append_only();

create or replace function public.fn_membresia_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol    text;
  v_cambio text;
begin
  if tg_op = 'UPDATE'
     and new.estado is not distinct from old.estado
     and new.rol_en_organizacion is not distinct from old.rol_en_organizacion then
    return null;
  end if;
  select ur.rol into v_rol from public.user_roles ur where ur.user_id = new.ultimo_actor limit 1;
  v_cambio := case
    when tg_op = 'INSERT' then 'alta'
    when new.estado is distinct from old.estado and new.estado = 'activa' then 'activacion'
    when new.estado is distinct from old.estado and new.estado = 'baja' then 'baja'
    else 'cambio_de_rol' end;
  insert into public.membresias_bitacora
    (membresia_id, organizacion_id, actor_user_id, actor_rol, cambio, de_estado, a_estado, de_rol, a_rol)
  values
    (new.id, new.organizacion_id, new.ultimo_actor, v_rol, v_cambio,
     case when tg_op = 'INSERT' then null else old.estado end, new.estado,
     case when tg_op = 'INSERT' then null else old.rol_en_organizacion end, new.rol_en_organizacion);
  return null;
end;
$$;
alter function public.fn_membresia_bitacora() owner to postgres;
revoke execute on function public.fn_membresia_bitacora() from public, anon, authenticated;

drop trigger if exists membresia_bitacora on public.membresias_organizacion;
create trigger membresia_bitacora
  after insert or update on public.membresias_organizacion
  for each row execute function public.fn_membresia_bitacora();

-- ═══ 3. Lectura de la propia pertenencia ════════════════════════════════════

-- ¿El usuario autenticado representa (con membresía ACTIVA) a la organización?
create or replace function public.representa_organizacion(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.membresias_organizacion m
      left join public.perfiles p on p.id = m.perfil_id
     where m.organizacion_id = p_org
       and m.estado = 'activa'
       and m.rol_en_organizacion = 'representante'
       and (m.user_id = auth.uid()
            or (p.cliente_id is not null and p.cliente_id = public.cliente_del_usuario())));
$$;
alter function public.representa_organizacion(uuid) owner to postgres;
revoke execute on function public.representa_organizacion(uuid) from public, anon;
grant execute on function public.representa_organizacion(uuid) to authenticated, service_role;
comment on function public.representa_organizacion(uuid) is
  'true si auth.uid() es representante con membresía activa de la organización. Base del aislamiento: una organización nunca ve los miembros de otra.';

alter table public.membresias_organizacion enable row level security;
revoke all on table public.membresias_organizacion from public, anon, authenticated, service_role;
grant select, insert, update on table public.membresias_organizacion to service_role;
grant select on table public.membresias_organizacion to authenticated;
revoke delete, truncate on table public.membresias_organizacion from anon, authenticated, service_role;

drop policy if exists membresias_organizacion_service_all on public.membresias_organizacion;
create policy membresias_organizacion_service_all on public.membresias_organizacion
  for all to service_role using (true) with check (true);
drop policy if exists membresias_personal_read on public.membresias_organizacion;
create policy membresias_personal_read on public.membresias_organizacion
  for select to authenticated
  using (public.es_personal() or (select public.current_rol()) = 'auditor');
-- Cada quien ve SU pertenencia.
drop policy if exists membresias_propia_read on public.membresias_organizacion;
create policy membresias_propia_read on public.membresias_organizacion
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.perfiles p
                     where p.id = membresias_organizacion.perfil_id
                       and p.cliente_id is not null
                       and p.cliente_id = (select public.cliente_del_usuario())));
-- El representante ve los miembros de SU organización (y de ninguna otra).
drop policy if exists membresias_representante_read on public.membresias_organizacion;
create policy membresias_representante_read on public.membresias_organizacion
  for select to authenticated
  using (public.representa_organizacion(organizacion_id));

alter table public.membresias_bitacora enable row level security;
revoke all on table public.membresias_bitacora from public, anon, authenticated, service_role;
grant select, insert on table public.membresias_bitacora to service_role;
grant select on table public.membresias_bitacora to authenticated;
revoke update, delete, truncate on table public.membresias_bitacora from anon, authenticated, service_role;
drop policy if exists membresias_bitacora_service_all on public.membresias_bitacora;
create policy membresias_bitacora_service_all on public.membresias_bitacora
  for all to service_role using (true) with check (true);
drop policy if exists membresias_bitacora_personal_read on public.membresias_bitacora;
create policy membresias_bitacora_personal_read on public.membresias_bitacora
  for select to authenticated
  using (public.es_personal() or (select public.current_rol()) = 'auditor');

-- ═══ 4. invitaciones_organizacion ═══════════════════════════════════════════

create table if not exists public.invitaciones_organizacion (
  id                    uuid primary key default gen_random_uuid(),
  organizacion_id       uuid not null references public.organizaciones(id) on delete restrict,
  correo                text not null,
  rol_en_organizacion   text not null default 'miembro',
  token_hash            text not null unique,
  expira_en             timestamptz not null,
  estado                text not null default 'pendiente',
  emitida_por           uuid not null,
  aceptada_por          uuid null,
  aceptada_en           timestamptz null,
  membresia_id          uuid null references public.membresias_organizacion(id) on delete restrict,
  created_at            timestamptz not null default now(),
  constraint invitaciones_estado_check check (estado in ('pendiente', 'aceptada', 'expirada', 'revocada')),
  constraint invitaciones_rol_check check (rol_en_organizacion in ('miembro', 'representante', 'contacto')),
  constraint invitaciones_token_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint invitaciones_correo_check check (length(correo) between 3 and 254),
  constraint invitaciones_aceptada_check check (estado <> 'aceptada' or (aceptada_por is not null and aceptada_en is not null))
);

create index if not exists idx_invitaciones_org on public.invitaciones_organizacion (organizacion_id, estado);

comment on table public.invitaciones_organizacion is
  'Invitación a pertenecer a una organización. El token viaja por correo y aquí se guarda SOLO su SHA-256 (nunca el token). Un solo uso y con expiración. Aceptarla crea una membresía PENDIENTE: no da derechos de escritura ni acceso hasta que un verificador la active. Sin DELETE.';
comment on column public.invitaciones_organizacion.token_hash is 'SHA-256 hex del token. No se concede SELECT de esta columna a ningún rol autenticado.';

create or replace function public.fn_invitacion_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'invitaciones_organizacion es indeleble' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.aceptada_por := null;
    new.aceptada_en := null;
    new.membresia_id := null;
    new.created_at := now();
    return new;
  end if;
  if new.token_hash <> old.token_hash or new.organizacion_id <> old.organizacion_id
     or new.correo <> old.correo or new.expira_en <> old.expira_en or new.emitida_por <> old.emitida_por then
    raise exception 'invitaciones: token, organización, correo, vencimiento y emisor no cambian' using errcode = '23514';
  end if;
  -- Un solo uso: solo se sale de pendiente, y una vez.
  if old.estado <> 'pendiente' then
    raise exception 'invitacion_ya_usada: la invitación está %', old.estado using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_invitacion_integridad() owner to postgres;
revoke execute on function public.fn_invitacion_integridad() from public, anon, authenticated;

drop trigger if exists invitacion_integridad on public.invitaciones_organizacion;
create trigger invitacion_integridad
  before insert or update or delete on public.invitaciones_organizacion
  for each row execute function public.fn_invitacion_integridad();

alter table public.invitaciones_organizacion enable row level security;
revoke all on table public.invitaciones_organizacion from public, anon, authenticated, service_role;
grant select, insert, update on table public.invitaciones_organizacion to service_role;
grant select (id, organizacion_id, correo, rol_en_organizacion, expira_en, estado, emitida_por, aceptada_en, membresia_id, created_at)
  on table public.invitaciones_organizacion to authenticated;
revoke delete, truncate on table public.invitaciones_organizacion from anon, authenticated, service_role;
drop policy if exists invitaciones_organizacion_service_all on public.invitaciones_organizacion;
create policy invitaciones_organizacion_service_all on public.invitaciones_organizacion
  for all to service_role using (true) with check (true);
drop policy if exists invitaciones_personal_read on public.invitaciones_organizacion;
create policy invitaciones_personal_read on public.invitaciones_organizacion
  for select to authenticated using (public.es_personal());

-- Aceptación: un solo uso, con vencimiento, y sin derechos.
create or replace function public.aceptar_invitacion_organizacion(p_token_hash text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv    public.invitaciones_organizacion%rowtype;
  v_correo text;
  v_memb   uuid;
begin
  if p_user is null or coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'motivo', 'invitacion_invalida');
  end if;
  select * into v_inv from public.invitaciones_organizacion where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'invitacion_invalida');
  end if;
  if v_inv.estado = 'aceptada' then
    return jsonb_build_object('ok', false, 'motivo', 'ya_aceptada');
  end if;
  if v_inv.estado <> 'pendiente' then
    return jsonb_build_object('ok', false, 'motivo', v_inv.estado);
  end if;
  if v_inv.expira_en <= now() then
    update public.invitaciones_organizacion set estado = 'expirada' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'motivo', 'expirada');
  end if;
  -- La invitación es personal: la acepta la cuenta del correo invitado.
  select lower(u.email) into v_correo from auth.users u where u.id = p_user;
  if v_correo is distinct from lower(v_inv.correo) then
    return jsonb_build_object('ok', false, 'motivo', 'correo_no_coincide');
  end if;
  if exists (select 1 from public.membresias_organizacion m
              where m.organizacion_id = v_inv.organizacion_id and m.user_id = p_user and m.estado <> 'baja') then
    update public.invitaciones_organizacion set estado = 'revocada' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'motivo', 'ya_es_miembro');
  end if;

  -- Membresía PENDIENTE: el alta es de quien emitió la invitación; quien acepta
  -- no gana ningún derecho. La activa después un verificador.
  insert into public.membresias_organizacion (organizacion_id, user_id, rol_en_organizacion, alta_por, ultimo_actor)
  values (v_inv.organizacion_id, p_user, v_inv.rol_en_organizacion, v_inv.emitida_por, v_inv.emitida_por)
  returning id into v_memb;

  update public.invitaciones_organizacion
     set estado = 'aceptada', aceptada_por = p_user, aceptada_en = now(), membresia_id = v_memb
   where id = v_inv.id;

  return jsonb_build_object('ok', true, 'membresia_id', v_memb, 'estado_membresia', 'pendiente',
                            'organizacion_id', v_inv.organizacion_id);
end;
$$;
alter function public.aceptar_invitacion_organizacion(text, uuid) owner to postgres;
revoke execute on function public.aceptar_invitacion_organizacion(text, uuid) from public, anon, authenticated;
grant execute on function public.aceptar_invitacion_organizacion(text, uuid) to service_role;
comment on function public.aceptar_invitacion_organizacion(text, uuid) is
  'Canjea una invitación por su hash. Un solo uso; vencida → expirada; ajena al correo invitado → rechazada. Crea una membresía PENDIENTE (sin derechos) que debe activar un verificador. EXECUTE solo service_role.';

-- ═══ 5. Un municipio no es parte compradora ═════════════════════════════════

create or replace function public.fn_parte_flujo_municipio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo from public.organizaciones where id = new.organizacion_id;
  if v_tipo = 'municipio' and new.papel = 'parte_compradora' then
    raise exception 'municipio_no_es_parte_compradora: un municipio adopta el estándar; no figura como parte compradora'
      using errcode = '23514';
  end if;
  if new.papel = 'laboratorio_destino' and v_tipo is distinct from 'laboratorio' then
    raise exception 'destino_no_es_laboratorio: el laboratorio de destino debe ser una organización de tipo laboratorio'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_parte_flujo_municipio() owner to postgres;
revoke execute on function public.fn_parte_flujo_municipio() from public, anon, authenticated;

drop trigger if exists parte_flujo_municipio on public.partes_flujo;
create trigger parte_flujo_municipio
  before insert or update on public.partes_flujo
  for each row execute function public.fn_parte_flujo_municipio();

-- ═══ 6. Verificación post-aplicación (a mano, en Studio) ════════════════════
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'organizaciones_tipo_check';
--   select column_name from information_schema.column_privileges
--    where table_name = 'invitaciones_organizacion' and grantee = 'authenticated';  -- sin token_hash
