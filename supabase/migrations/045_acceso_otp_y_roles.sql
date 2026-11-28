-- 045_acceso_otp_y_roles.sql
-- NO APLICAR. Escrita en el PR de la reestructura de recepción, acceso y cadena
-- de custodia (28-nov-2026, apilado sobre el #245); la aplica Willis tras revisión.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, con RESPALDO previo ║
-- ║ y aprobación expresa de Willis. Orden: 041 → 042 → 043 → 044 → 045.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- TEMA: acceso por código de un solo uso (OTP) y roles de personal nuevos.
--   1. Roles `verificador` (operador/verificador: aprueba perfiles) y
--      `recepcion` (personal de recepción/acopio: carga datos y recepciones).
--      Se AGREGAN al CHECK de user_roles.rol; ningún rol existente se renombra.
--   2. fn_user_roles_validar_org ampliada: los roles nuevos pueden llevar
--      organizacion_id (la organización que opera el punto), de cualquier tipo.
--   3. Helpers has_role() y es_personal().
--   4. bitacora_acciones: bitácora append-only de acciones del personal
--      (actor, rol, organización, fecha UTC, resumen sin datos personales).
--   5. Trigger: todo cambio en user_roles deja fila en bitacora_acciones.
--   6. auth_otp_control + auth_otp_auditoria + RPCs del OTP. NO se guarda el
--      código (lo emite y canjea Supabase Auth): solo el control de intentos,
--      la espera de reenvío, la expiración propia y el uso.
--   7. solicitudes_acceso: la página pública deja de crear cuentas.
--
-- DEPENDENCIAS: 041 (is_internal_staff), 043 (organizaciones, current_rol,
-- current_org, fn_append_only, user_roles.organizacion_id), 006 (roles).
--
-- SIN DATOS DE NEGOCIO: no siembra umbrales, plazos, montos ni nombres. Los
-- parámetros del OTP (vigencia, intentos, espera) viven en lib/auth/otp.ts y
-- están [POR CONFIRMAR — WILLIS]; los RPCs los reciben como argumentos.
--
-- Idempotente (create if not exists, drop policy/trigger if exists, constraints
-- gateadas por pg_constraint).
--
-- PLAN DE REVERSA (documentado; NO ejecutar sin decisión de Willis):
--   drop trigger if exists trg_user_roles_bitacora on public.user_roles;
--   drop function if exists public.fn_user_roles_bitacora();
--   drop function if exists public.auth_otp_registrar_intento(text, integer, integer);
--   drop function if exists public.auth_usuario_id_por_correo(text);
--   drop table if exists public.solicitudes_acceso, public.auth_otp_auditoria, public.auth_otp_control;
--   -- bitacora_acciones es evidencia: NO se elimina; se deja de escribir.
--   -- Roles: reasignar antes los usuarios con rol verificador/recepcion y luego
--   -- restaurar el CHECK y fn_user_roles_validar_org de la 043.

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.current_rol()') is null or to_regclass('public.organizaciones') is null then
    raise exception '045: falta la 043 (current_rol / organizaciones) — aplicar 043_estandar_privado_cadena.sql primero';
  end if;
  if to_regprocedure('public.is_internal_staff()') is null then
    raise exception '045: falta public.is_internal_staff() (041)';
  end if;
  if to_regprocedure('public.fn_append_only()') is null then
    raise exception '045: falta public.fn_append_only() (043)';
  end if;
end $$;

-- ═══ 1. Roles nuevos (ampliación no destructiva del CHECK) ══════════════════

do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.user_roles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ~* '\(rol\s*=\s*any|rol\s+in\s*\('
       and conname <> 'user_roles_org_requerida_check'
  loop
    execute format('alter table public.user_roles drop constraint %I', r.conname);
  end loop;
  alter table public.user_roles
    add constraint user_roles_rol_check
    check (rol in ('admin', 'abogado', 'tecnico_ambiental', 'cliente',
                   'comercializador', 'planta', 'auditor',
                   'verificador', 'recepcion'));
end $$;

-- El CHECK user_roles_org_requerida_check de la 043 (comercializador y planta
-- exigen organización) no cambia: el bucle de arriba lo excluye por nombre.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'user_roles_org_requerida_check'
                    and conrelid = 'public.user_roles'::regclass) then
    alter table public.user_roles
      add constraint user_roles_org_requerida_check
      check (rol not in ('comercializador', 'planta') or organizacion_id is not null);
  end if;
end $$;

-- 1.a Alcance por organización de los roles nuevos.
create or replace function public.fn_user_roles_validar_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo   text;
  v_activo boolean;
begin
  if new.organizacion_id is null then
    return new;
  end if;
  select tipo, activo into v_tipo, v_activo from public.organizaciones where id = new.organizacion_id;
  if new.rol in ('comercializador', 'planta', 'auditor') then
    -- Regla de la 043, sin cambios: el tipo de la organización coincide con el rol.
    if v_tipo is distinct from new.rol then
      raise exception 'el tipo de la organización (%) no coincide con el rol (%)', coalesce(v_tipo, 'inexistente'), new.rol
        using errcode = '23514';
    end if;
    return new;
  end if;
  if new.rol in ('recepcion', 'verificador') then
    -- Personal asignado a la organización que opera un punto de recepción. El
    -- tipo NO se cablea: quién opera la recepción es [POR CONFIRMAR].
    if v_tipo is null or v_activo is distinct from true then
      raise exception 'la organización indicada no existe o no está activa' using errcode = '23514';
    end if;
    return new;
  end if;
  raise exception 'organizacion_id no aplica al rol %', new.rol using errcode = '23514';
end;
$$;
alter function public.fn_user_roles_validar_org() owner to postgres;
revoke execute on function public.fn_user_roles_validar_org() from public, anon, authenticated;

drop trigger if exists trg_user_roles_validar_org on public.user_roles;
create trigger trg_user_roles_validar_org
  before insert or update of rol, organizacion_id on public.user_roles
  for each row execute function public.fn_user_roles_validar_org();

comment on column public.user_roles.organizacion_id is
  'Organización del usuario. Obligatoria para comercializador y planta (CHECK); opcional para auditor, recepcion y verificador (organización que opera el punto de recepción). NULL para personal de CHT sin punto asignado y para clientes.';

-- 1.b Etiquetas en `roles` (006). La autorización real la hacen requireRole(),
-- los predicados de lib/**/acceso*.ts y las policies.
insert into public.roles (nombre, descripcion, permisos, es_sistema) values
  ('verificador', 'Verificador — revisa y aprueba o rechaza perfiles, uno por uno. No aprueba lo que él mismo creó o editó.',
     '["aprobaciones:read","aprobaciones:decidir","perfiles:read","recepcion:read"]', true),
  ('recepcion',   'Recepción — personal del punto de recepción: carga perfiles y registra recepciones, pesajes, sobres y cajas. No aprueba.',
     '["perfiles:write","recepcion:write","recepcion:read"]', true)
on conflict (nombre) do nothing;

-- ═══ 2. Helpers ═════════════════════════════════════════════════════════════

create or replace function public.has_role(p_user uuid, p_rol text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
     where ur.user_id = p_user and ur.rol = p_rol and ur.activo
  );
$$;
alter function public.has_role(uuid, text) owner to postgres;
revoke execute on function public.has_role(uuid, text) from public, anon;
grant execute on function public.has_role(uuid, text) to authenticated, service_role;
comment on function public.has_role(uuid, text) is
  'true si el usuario tiene el rol indicado y está activo. SECURITY DEFINER con search_path fijo.';

create or replace function public.es_personal()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_rol() in
    ('admin', 'abogado', 'tecnico_ambiental', 'verificador', 'recepcion'), false);
$$;
alter function public.es_personal() owner to postgres;
revoke execute on function public.es_personal() from public, anon;
grant execute on function public.es_personal() to authenticated, service_role;
comment on function public.es_personal() is
  'true si auth.uid() es personal (admin, abogado, tecnico_ambiental, verificador o recepcion). Los usuarios externos (cliente, comercializador, planta, auditor) solo ven.';

-- ═══ 3. bitacora_acciones (append-only) ═════════════════════════════════════

create table if not exists public.bitacora_acciones (
  id               uuid primary key default gen_random_uuid(),
  actor_user_id    uuid null,
  actor_rol        text null,
  organizacion_id  uuid null,
  accion           text not null,
  recurso_tipo     text not null,
  recurso_id       text null,
  resumen          text not null,
  detalle          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint bitacora_acciones_resumen_check check (length(resumen) between 1 and 500)
);

create index if not exists idx_bitacora_acciones_recurso on public.bitacora_acciones (recurso_tipo, recurso_id);
create index if not exists idx_bitacora_acciones_actor on public.bitacora_acciones (actor_user_id, created_at desc);

comment on table public.bitacora_acciones is
  'Bitácora APPEND-ONLY de acciones del personal sobre perfiles, expedientes, recepciones, membresías, documentos y roles: actor, rol, organización, fecha (UTC) y resumen. El resumen y el detalle NO llevan datos personales innecesarios (ni números de identidad ni teléfonos): solo identificadores internos. Sin UPDATE ni DELETE.';
comment on column public.bitacora_acciones.created_at is 'Fecha y hora del asiento (timestamptz; se presenta en UTC).';

alter table public.bitacora_acciones enable row level security;
revoke all on table public.bitacora_acciones from public, anon, authenticated, service_role;
grant select, insert on table public.bitacora_acciones to service_role;
grant select, insert on table public.bitacora_acciones to authenticated;
revoke update, delete, truncate on table public.bitacora_acciones from anon, authenticated, service_role;

drop trigger if exists bitacora_acciones_append_only on public.bitacora_acciones;
create trigger bitacora_acciones_append_only
  before update or delete on public.bitacora_acciones
  for each row execute function public.fn_append_only();

drop policy if exists bitacora_acciones_service_all on public.bitacora_acciones;
create policy bitacora_acciones_service_all on public.bitacora_acciones
  for all to service_role using (true) with check (true);
drop policy if exists bitacora_acciones_admin_auditor_read on public.bitacora_acciones;
create policy bitacora_acciones_admin_auditor_read on public.bitacora_acciones
  for select to authenticated
  using ((select public.current_rol()) in ('admin', 'auditor'));
drop policy if exists bitacora_acciones_personal_insert on public.bitacora_acciones;
create policy bitacora_acciones_personal_insert on public.bitacora_acciones
  for insert to authenticated
  with check (actor_user_id = auth.uid() and public.es_personal());

-- ═══ 4. Cambios de rol → bitácora ═══════════════════════════════════════════

create or replace function public.fn_user_roles_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_accion  text;
  v_usuario uuid;
  v_resumen text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'rol_asignado';
    v_usuario := new.user_id;
    v_resumen := format('Rol asignado: %s', new.rol);
  elsif tg_op = 'DELETE' then
    v_accion := 'rol_retirado';
    v_usuario := old.user_id;
    v_resumen := format('Rol retirado: %s', old.rol);
  else
    if new.rol is not distinct from old.rol
       and new.activo is not distinct from old.activo
       and new.organizacion_id is not distinct from old.organizacion_id then
      return null;
    end if;
    v_accion := 'rol_cambiado';
    v_usuario := new.user_id;
    v_resumen := format('Rol %s → %s; activo %s → %s', old.rol, new.rol, old.activo, new.activo);
  end if;
  insert into public.bitacora_acciones
    (actor_user_id, actor_rol, organizacion_id, accion, recurso_tipo, recurso_id, resumen, detalle)
  values
    (auth.uid(), public.current_rol(), public.current_org(), v_accion, 'user_roles', v_usuario::text, v_resumen,
     jsonb_build_object(
       'rol_antes', case when tg_op = 'INSERT' then null else old.rol end,
       'rol_despues', case when tg_op = 'DELETE' then null else new.rol end,
       'organizacion_antes', case when tg_op = 'INSERT' then null else old.organizacion_id end,
       'organizacion_despues', case when tg_op = 'DELETE' then null else new.organizacion_id end));
  return null;
end;
$$;
alter function public.fn_user_roles_bitacora() owner to postgres;
revoke execute on function public.fn_user_roles_bitacora() from public, anon, authenticated;

drop trigger if exists trg_user_roles_bitacora on public.user_roles;
create trigger trg_user_roles_bitacora
  after insert or update or delete on public.user_roles
  for each row execute function public.fn_user_roles_bitacora();

-- ═══ 5. OTP: control, auditoría y RPCs ══════════════════════════════════════

create table if not exists public.auth_otp_control (
  email_hash       text primary key,
  emitido_en       timestamptz not null,
  expira_en        timestamptz not null,
  intentos         integer not null default 0,
  usado_en         timestamptz null,
  bloqueado_hasta  timestamptz null,
  updated_at       timestamptz not null default now(),
  constraint auth_otp_control_hash_check check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_otp_control_intentos_check check (intentos >= 0)
);

comment on table public.auth_otp_control is
  'Control del acceso por código de un solo uso. UNA fila por correo, identificada por HMAC-SHA256 del correo con pepper (variable de entorno AUTH_OTP_PEPPER; el valor no vive en el repositorio ni en la base). NO guarda el código, ni en claro ni como hash: el código lo emite y canjea Supabase Auth. Existe también para correos sin cuenta (anti-enumeración). Solo service_role.';
comment on column public.auth_otp_control.expira_en is 'Vencimiento PROPIO del código (independiente del ajuste del proyecto en Supabase Auth).';
comment on column public.auth_otp_control.intentos is 'Intentos de verificación contados desde la última emisión.';

alter table public.auth_otp_control enable row level security;
revoke all on table public.auth_otp_control from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.auth_otp_control to service_role;
drop policy if exists auth_otp_control_service_all on public.auth_otp_control;
create policy auth_otp_control_service_all on public.auth_otp_control
  for all to service_role using (true) with check (true);

create table if not exists public.auth_otp_auditoria (
  id          uuid primary key default gen_random_uuid(),
  evento      text not null,
  email_hash  text null,
  ip          text null,
  detalle     text null,
  created_at  timestamptz not null default now(),
  constraint auth_otp_auditoria_evento_check check (evento in (
    'solicitud_emitida', 'solicitud_sin_cuenta', 'solicitud_en_espera', 'solicitud_bloqueada',
    'solicitud_limitada', 'verificacion_ok', 'verificacion_fallida', 'verificacion_rechazada',
    'verificacion_limitada'))
);

create index if not exists idx_auth_otp_auditoria_hash on public.auth_otp_auditoria (email_hash, created_at desc);

comment on table public.auth_otp_auditoria is
  'Auditoría APPEND-ONLY de solicitudes y verificaciones de OTP. Nunca contiene el código ni el correo en claro (solo su HMAC). Solo service_role; la lee el administrador desde el servidor.';

alter table public.auth_otp_auditoria enable row level security;
revoke all on table public.auth_otp_auditoria from public, anon, authenticated, service_role;
grant select, insert on table public.auth_otp_auditoria to service_role;
revoke update, delete, truncate on table public.auth_otp_auditoria from anon, authenticated, service_role;
drop trigger if exists auth_otp_auditoria_append_only on public.auth_otp_auditoria;
create trigger auth_otp_auditoria_append_only
  before update or delete on public.auth_otp_auditoria
  for each row execute function public.fn_append_only();
drop policy if exists auth_otp_auditoria_service_all on public.auth_otp_auditoria;
create policy auth_otp_auditoria_service_all on public.auth_otp_auditoria
  for all to service_role using (true) with check (true);

-- Cuenta un intento de forma atómica. Réplica de controlTrasIntento() de
-- lib/auth/otp.ts. Los límites llegan como argumentos (no hay valores de
-- negocio sembrados en la base).
create or replace function public.auth_otp_registrar_intento(
  p_email_hash text, p_max_intentos integer, p_bloqueo_seg integer)
returns setof public.auth_otp_control
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.auth_otp_control c
     set intentos = c.intentos + 1,
         bloqueado_hasta = case
           when c.intentos + 1 >= p_max_intentos then now() + make_interval(secs => p_bloqueo_seg)
           else c.bloqueado_hasta end,
         updated_at = now()
   where c.email_hash = p_email_hash
  returning c.*;
end;
$$;
alter function public.auth_otp_registrar_intento(text, integer, integer) owner to postgres;
revoke execute on function public.auth_otp_registrar_intento(text, integer, integer) from public, anon, authenticated;
grant execute on function public.auth_otp_registrar_intento(text, integer, integer) to service_role;

-- ¿Existe una cuenta confirmable para este correo? Evita que la emisión del
-- código cree cuentas nuevas. search_path vacío + nombres calificados.
create or replace function public.auth_usuario_id_por_correo(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.deleted_at is null
   limit 1;
$$;
alter function public.auth_usuario_id_por_correo(text) owner to postgres;
revoke execute on function public.auth_usuario_id_por_correo(text) from public, anon, authenticated;
grant execute on function public.auth_usuario_id_por_correo(text) to service_role;
comment on function public.auth_usuario_id_por_correo(text) is
  'Id del usuario de auth con ese correo, o NULL. EXECUTE solo service_role: jamás se expone al cliente (sería un oráculo de existencia de cuentas).';

-- ═══ 6. solicitudes_acceso ══════════════════════════════════════════════════

create table if not exists public.solicitudes_acceso (
  id               uuid primary key default gen_random_uuid(),
  correo           text not null,
  nombre_contacto  text null,
  estado           text not null default 'pendiente',
  atendida_por     uuid null references auth.users(id) on delete set null,
  atendida_en      timestamptz null,
  created_at       timestamptz not null default now(),
  constraint solicitudes_acceso_estado_check check (estado in ('pendiente', 'atendida', 'descartada')),
  constraint solicitudes_acceso_correo_check check (length(correo) between 3 and 254),
  constraint solicitudes_acceso_nombre_check check (nombre_contacto is null or length(nombre_contacto) <= 120)
);

create index if not exists idx_solicitudes_acceso_estado on public.solicitudes_acceso (estado, created_at desc);

comment on table public.solicitudes_acceso is
  'Solicitudes de acceso recibidas desde la página pública. SOLO correo y nombre de contacto: ningún dato de trazabilidad se autodeclara. No crea cuenta ni perfil: el alta la hace el personal. [POR CONFIRMAR — WILLIS: mantener la solicitud pública o pasar a solo invitación.]';

alter table public.solicitudes_acceso enable row level security;
revoke all on table public.solicitudes_acceso from public, anon, authenticated, service_role;
grant select, insert, update on table public.solicitudes_acceso to service_role;
grant select, update on table public.solicitudes_acceso to authenticated;
revoke delete, truncate on table public.solicitudes_acceso from anon, authenticated, service_role;
drop policy if exists solicitudes_acceso_service_all on public.solicitudes_acceso;
create policy solicitudes_acceso_service_all on public.solicitudes_acceso
  for all to service_role using (true) with check (true);
drop policy if exists solicitudes_acceso_personal_read on public.solicitudes_acceso;
create policy solicitudes_acceso_personal_read on public.solicitudes_acceso
  for select to authenticated using (public.es_personal());
drop policy if exists solicitudes_acceso_personal_update on public.solicitudes_acceso;
create policy solicitudes_acceso_personal_update on public.solicitudes_acceso
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

-- ═══ 7. Verificación post-aplicación (a mano, en Studio) ════════════════════
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'user_roles_rol_check';
--   select tablename, rowsecurity from pg_tables where schemaname = 'public'
--     and tablename in ('bitacora_acciones','auth_otp_control','auth_otp_auditoria','solicitudes_acceso');
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'auth_otp_control';  -- solo service_role
