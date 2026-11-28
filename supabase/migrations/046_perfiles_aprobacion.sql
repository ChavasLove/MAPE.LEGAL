-- 046_perfiles_aprobacion.sql
-- NO APLICAR. Escrita en el PR de la reestructura de recepción, acceso y cadena
-- de custodia (28-nov-2026, apilado sobre el #245); la aplica Willis tras revisión.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, con RESPALDO previo ║
-- ║ y aprobación expresa de Willis. Orden: … → 045 → 046.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- TEMA: perfiles aprobados uno por uno y expediente de solo lectura.
--   1. `perfiles` (minero/productor u organización) con estado
--      borrador → pendiente → aprobado | rechazado (+ suspendido). Todo perfil
--      nace pendiente (o borrador); NUNCA aprobado.
--   2. `aprobaciones_perfil`: bitácora APPEND-ONLY con hash encadenado de cada
--      decisión (quién, rol, fecha, versión aprobada por su huella y motivo).
--   3. `decidir_perfil()`: única vía para aprobar / rechazar / suspender.
--      Separación de funciones: quien creó o editó NO decide.
--   4. Un lote solo puede nacer de un titular con perfil aprobado.
--   5. `licencias_mina`: estado y vigencia de licencias por mina (lo carga el
--      personal; sin datos sembrados).
--   6. Lectura del propio perfil para el titular y su organización.
--
-- DEPENDENCIAS: 045 (es_personal, bitacora_acciones), 043 (organizaciones,
-- lotes, current_rol, current_org, fn_append_only, jsonb_canonico, sha256_hex),
-- 008/038 (clientes), 040 (minas).
--
-- CONTRATO: estados y transiciones = lib/perfiles/estados.ts. Separación de
-- funciones = lib/acceso/personal.ts separacionDeFunciones().
--
-- EFECTO SOBRE DATOS EXISTENTES: ninguna fila se modifica. Los clientes y
-- organizaciones ya existentes quedan SIN perfil; hasta que el personal cargue
-- y un verificador apruebe su perfil, no pueden originar lotes NUEVOS (los
-- lotes ya creados no se tocan). [POR CONFIRMAR — WILLIS: si los titulares
-- existentes se cargan como aprobados en un acto único y documentado.]
--
-- "LOS USUARIOS SOLO VEN": esta migración no concede INSERT/UPDATE/DELETE a
-- ningún rol externo. Las policies de escritura de la 043 para comercializador
-- y planta no se amplían ni se tocan.
--
-- Idempotente.
--
-- PLAN DE REVERSA (documentado; NO ejecutar sin decisión de Willis):
--   drop trigger if exists lote_exigir_perfil_aprobado on public.lotes;
--   drop function if exists public.fn_lote_exigir_perfil_aprobado();
--   drop function if exists public.decidir_perfil(uuid, text, text, uuid);
--   -- perfiles y aprobaciones_perfil son evidencia: NO se eliminan.
--   -- licencias_mina: conservar; se deja de leer.

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.es_personal()') is null or to_regclass('public.bitacora_acciones') is null then
    raise exception '046: falta la 045 (es_personal / bitacora_acciones)';
  end if;
  if to_regprocedure('public.jsonb_canonico(jsonb)') is null or to_regprocedure('public.sha256_hex(text)') is null then
    raise exception '046: falta la 043 (jsonb_canonico / sha256_hex)';
  end if;
  if to_regclass('public.minas') is null then
    raise exception '046: falta public.minas (040)';
  end if;
end $$;

-- ═══ 0.a Helpers de titularidad ═════════════════════════════════════════════
-- SECURITY DEFINER para que las policies de lectura del titular no dependan
-- de las policies de `clientes` y `minas` (que varían entre ambientes).

create or replace function public.cliente_del_usuario()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id from public.clientes c where c.user_id = auth.uid() limit 1;
$$;
alter function public.cliente_del_usuario() owner to postgres;
revoke execute on function public.cliente_del_usuario() from public, anon;
grant execute on function public.cliente_del_usuario() to authenticated, service_role;
comment on function public.cliente_del_usuario() is
  'clientes.id del usuario autenticado (titular), o NULL. Base de toda policy "el titular solo ve lo suyo".';

create or replace function public.es_titular_de_mina(p_mina uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.minas m
                  where m.id = p_mina
                    and m.cliente_id is not null
                    and m.cliente_id = public.cliente_del_usuario());
$$;
alter function public.es_titular_de_mina(uuid) owner to postgres;
revoke execute on function public.es_titular_de_mina(uuid) from public, anon;
grant execute on function public.es_titular_de_mina(uuid) to authenticated, service_role;

-- ═══ 1. perfiles ════════════════════════════════════════════════════════════

create table if not exists public.perfiles (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 text not null,
  cliente_id           uuid null references public.clientes(id) on delete restrict,
  organizacion_id      uuid null references public.organizaciones(id) on delete restrict,
  contenido            jsonb not null default '{}'::jsonb,
  documentos_respaldo  jsonb not null default '[]'::jsonb,
  estado               text not null default 'pendiente',
  version              integer not null default 1,
  contenido_hash       text not null default '',
  creado_por           uuid null references auth.users(id) on delete set null,
  editado_por          uuid null references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint perfiles_tipo_check check (tipo in ('minero', 'organizacion')),
  constraint perfiles_estado_check check (estado in ('borrador', 'pendiente', 'aprobado', 'rechazado', 'suspendido')),
  constraint perfiles_sujeto_check check (
    (tipo = 'minero' and cliente_id is not null and organizacion_id is null)
    or (tipo = 'organizacion' and organizacion_id is not null and cliente_id is null)),
  constraint perfiles_version_check check (version >= 1),
  constraint perfiles_documentos_check check (jsonb_typeof(documentos_respaldo) = 'array')
);

create unique index if not exists uq_perfiles_cliente on public.perfiles (cliente_id) where cliente_id is not null;
create unique index if not exists uq_perfiles_organizacion on public.perfiles (organizacion_id) where organizacion_id is not null;
create index if not exists idx_perfiles_estado on public.perfiles (estado, updated_at desc);

comment on table public.perfiles is
  'Perfil de un minero/productor (cliente_id) o de una organización (organizacion_id), cargado por el PERSONAL a partir de documentos. El titular no lo llena ni lo edita. Nace pendiente (o borrador) y solo un perfil aprobado participa en lotes, recepciones y verificación. Sin DELETE.';
comment on column public.perfiles.contenido is
  'Datos del perfil (lista cerrada de campos en lib/perfiles/validacion.ts). Sin montos, medios de pago ni comprobantes.';
comment on column public.perfiles.documentos_respaldo is 'Arreglo de identificadores de documentos que respaldan el perfil.';
comment on column public.perfiles.contenido_hash is
  'SHA-256 del JSON canónico de `contenido` (sha256_hex(jsonb_canonico(contenido))). Identifica la versión que se aprueba.';
comment on column public.perfiles.editado_por is
  'Último usuario que editó el contenido. Junto con creado_por define quién NO puede decidir (separación de funciones).';

-- 1.a Alta: nunca aprobado.
create or replace function public.fn_perfil_alta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.estado not in ('pendiente', 'borrador') then
    new.estado := 'pendiente';
  end if;
  new.version := 1;
  new.contenido := coalesce(new.contenido, '{}'::jsonb);
  new.contenido_hash := public.sha256_hex(public.jsonb_canonico(new.contenido));
  new.creado_por := coalesce(new.creado_por, auth.uid());
  new.editado_por := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
alter function public.fn_perfil_alta() owner to postgres;
revoke execute on function public.fn_perfil_alta() from public, anon, authenticated;

drop trigger if exists perfil_alta on public.perfiles;
create trigger perfil_alta
  before insert on public.perfiles
  for each row execute function public.fn_perfil_alta();

-- 1.b Edición: sube versión, devuelve a pendiente; el estado decidido solo lo
-- cambia decidir_perfil() (bandera de sesión local a la transacción).
create or replace function public.fn_perfil_edicion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decision boolean := coalesce(current_setting('mape.decision_perfil', true), '') = 'on';
  v_cambio_contenido boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'perfiles es indeleble: no se permite DELETE' using errcode = '23514';
  end if;

  if new.tipo <> old.tipo
     or new.cliente_id is distinct from old.cliente_id
     or new.organizacion_id is distinct from old.organizacion_id
     or new.creado_por is distinct from old.creado_por
     or new.created_at <> old.created_at then
    raise exception 'perfiles: tipo, sujeto y autoría de alta no cambian' using errcode = '23514';
  end if;

  v_cambio_contenido := new.contenido is distinct from old.contenido
                     or new.documentos_respaldo is distinct from old.documentos_respaldo;

  if v_decision then
    -- Vía decidir_perfil(): solo cambia el estado.
    if v_cambio_contenido then
      raise exception 'perfiles: una decisión no modifica el contenido' using errcode = '23514';
    end if;
    new.version := old.version;
    new.contenido_hash := old.contenido_hash;
    new.editado_por := old.editado_por;
    new.updated_at := now();
    return new;
  end if;

  -- Edición del personal que carga.
  if new.estado is distinct from old.estado
     and not ((old.estado = 'borrador' and new.estado = 'pendiente')
           or (old.estado in ('rechazado', 'suspendido') and new.estado = 'pendiente')) then
    raise exception 'perfiles: el estado % → % solo se alcanza con decidir_perfil()', old.estado, new.estado
      using errcode = '23514';
  end if;

  if v_cambio_contenido then
    new.version := old.version + 1;
    new.contenido_hash := public.sha256_hex(public.jsonb_canonico(new.contenido));
    new.editado_por := coalesce(auth.uid(), new.editado_por);
    if new.editado_por is null then
      raise exception 'perfiles: la edición exige identificar a quien edita (editado_por)' using errcode = '23514';
    end if;
    -- Lo ya decidido vuelve a revisión.
    if old.estado in ('aprobado', 'rechazado', 'suspendido') then
      new.estado := 'pendiente';
    end if;
  else
    new.version := old.version;
    new.contenido_hash := old.contenido_hash;
    new.editado_por := old.editado_por;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
alter function public.fn_perfil_edicion() owner to postgres;
revoke execute on function public.fn_perfil_edicion() from public, anon, authenticated;

drop trigger if exists perfil_edicion on public.perfiles;
create trigger perfil_edicion
  before update or delete on public.perfiles
  for each row execute function public.fn_perfil_edicion();

alter table public.perfiles enable row level security;
revoke all on table public.perfiles from public, anon, authenticated, service_role;
grant select, insert, update on table public.perfiles to service_role;
grant select, insert, update on table public.perfiles to authenticated;
revoke delete, truncate on table public.perfiles from anon, authenticated, service_role;

drop policy if exists perfiles_service_all on public.perfiles;
create policy perfiles_service_all on public.perfiles
  for all to service_role using (true) with check (true);
drop policy if exists perfiles_personal_read on public.perfiles;
create policy perfiles_personal_read on public.perfiles
  for select to authenticated
  using (public.es_personal() or (select public.current_rol()) = 'auditor');
-- Carga: personal que crea/edita. El verificador NO escribe aquí.
drop policy if exists perfiles_carga_insert on public.perfiles;
create policy perfiles_carga_insert on public.perfiles
  for insert to authenticated
  with check ((select public.current_rol()) in ('admin', 'abogado', 'tecnico_ambiental', 'recepcion'));
drop policy if exists perfiles_carga_update on public.perfiles;
create policy perfiles_carga_update on public.perfiles
  for update to authenticated
  using ((select public.current_rol()) in ('admin', 'abogado', 'tecnico_ambiental', 'recepcion'))
  with check ((select public.current_rol()) in ('admin', 'abogado', 'tecnico_ambiental', 'recepcion'));
-- El titular y su organización solo LEEN su propio perfil.
drop policy if exists perfiles_titular_read_own on public.perfiles;
create policy perfiles_titular_read_own on public.perfiles
  for select to authenticated
  using (perfiles.cliente_id is not null
         and perfiles.cliente_id = (select public.cliente_del_usuario()));
drop policy if exists perfiles_organizacion_read_own on public.perfiles;
create policy perfiles_organizacion_read_own on public.perfiles
  for select to authenticated
  using (perfiles.organizacion_id is not null
         and perfiles.organizacion_id = (select public.current_org()));

-- ═══ 2. aprobaciones_perfil (append-only, hash encadenado) ══════════════════

create table if not exists public.aprobaciones_perfil (
  id              uuid primary key default gen_random_uuid(),
  perfil_id       uuid not null references public.perfiles(id) on delete restrict,
  secuencia       integer not null,
  decision        text not null,
  decidido_por    uuid not null,
  decidido_rol    text not null,
  version         integer not null,
  contenido_hash  text not null,
  motivo          text null,
  hash_previo     text not null,
  hash            text not null,
  created_at      timestamptz not null default now(),
  constraint aprobaciones_perfil_decision_check check (decision in ('aprobado', 'rechazado', 'suspendido')),
  constraint aprobaciones_perfil_motivo_check check (decision = 'aprobado' or length(trim(coalesce(motivo, ''))) >= 5),
  constraint aprobaciones_perfil_hash_check check (hash ~ '^[0-9a-f]{64}$'),
  constraint aprobaciones_perfil_secuencia_key unique (perfil_id, secuencia)
);

create index if not exists idx_aprobaciones_perfil_perfil on public.aprobaciones_perfil (perfil_id, secuencia desc);

comment on table public.aprobaciones_perfil is
  'Bitácora INMUTABLE de decisiones sobre perfiles: quién decidió, con qué rol, cuándo, sobre qué versión (contenido_hash) y por qué. Una fila por decisión, encadenada por hash por perfil (GENESIS en la primera). Solo la escribe decidir_perfil(). Sin UPDATE ni DELETE.';
comment on column public.aprobaciones_perfil.hash is
  'sha256 de perfil_id|secuencia|decision|decidido_por|version|contenido_hash|motivo|hash_previo.';

create or replace function public.fn_aprobacion_encadenar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil public.perfiles%rowtype;
  v_prev   text;
begin
  select * into v_perfil from public.perfiles where id = new.perfil_id for update;
  if not found then
    raise exception 'perfil_no_existe' using errcode = '23503';
  end if;
  -- Separación de funciones (defensa en profundidad; decidir_perfil ya la aplica).
  if new.decidido_por = v_perfil.creado_por or new.decidido_por = v_perfil.editado_por then
    raise exception 'separacion_de_funciones: quien creó o editó el perfil no puede decidir sobre él'
      using errcode = '23514';
  end if;
  select coalesce(max(secuencia), 0) + 1 into new.secuencia
    from public.aprobaciones_perfil where perfil_id = new.perfil_id;
  select hash into v_prev from public.aprobaciones_perfil
   where perfil_id = new.perfil_id and secuencia = new.secuencia - 1;
  new.hash_previo := coalesce(v_prev, 'GENESIS');
  new.version := v_perfil.version;
  new.contenido_hash := v_perfil.contenido_hash;
  new.created_at := now();
  new.hash := public.sha256_hex(concat_ws('|',
    new.perfil_id::text, new.secuencia::text, new.decision, new.decidido_por::text,
    new.version::text, new.contenido_hash, coalesce(new.motivo, ''), new.hash_previo));
  return new;
end;
$$;
alter function public.fn_aprobacion_encadenar() owner to postgres;
revoke execute on function public.fn_aprobacion_encadenar() from public, anon, authenticated;

drop trigger if exists aprobacion_encadenar on public.aprobaciones_perfil;
create trigger aprobacion_encadenar
  before insert on public.aprobaciones_perfil
  for each row execute function public.fn_aprobacion_encadenar();

drop trigger if exists aprobaciones_perfil_append_only on public.aprobaciones_perfil;
create trigger aprobaciones_perfil_append_only
  before update or delete on public.aprobaciones_perfil
  for each row execute function public.fn_append_only();

alter table public.aprobaciones_perfil enable row level security;
revoke all on table public.aprobaciones_perfil from public, anon, authenticated, service_role;
grant select, insert on table public.aprobaciones_perfil to service_role;
grant select on table public.aprobaciones_perfil to authenticated;
revoke update, delete, truncate on table public.aprobaciones_perfil from anon, authenticated, service_role;

drop policy if exists aprobaciones_perfil_service_all on public.aprobaciones_perfil;
create policy aprobaciones_perfil_service_all on public.aprobaciones_perfil
  for all to service_role using (true) with check (true);
drop policy if exists aprobaciones_perfil_personal_read on public.aprobaciones_perfil;
create policy aprobaciones_perfil_personal_read on public.aprobaciones_perfil
  for select to authenticated
  using (public.es_personal() or (select public.current_rol()) = 'auditor');

-- ═══ 3. decidir_perfil ══════════════════════════════════════════════════════

create or replace function public.decidir_perfil(p_perfil uuid, p_decision text, p_motivo text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil public.perfiles%rowtype;
  v_rol    text;
  v_org    uuid;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if p_actor is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_actor');
  end if;
  select ur.rol, ur.organizacion_id into v_rol, v_org
    from public.user_roles ur where ur.user_id = p_actor and ur.activo limit 1;
  if v_rol is null or v_rol not in ('verificador', 'admin') then
    return jsonb_build_object('ok', false, 'motivo', 'rol_no_autorizado');
  end if;

  select * into v_perfil from public.perfiles where id = p_perfil for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'perfil_no_existe');
  end if;
  if p_decision not in ('aprobado', 'rechazado', 'suspendido') then
    return jsonb_build_object('ok', false, 'motivo', 'decision_invalida');
  end if;
  if not ((v_perfil.estado = 'pendiente' and p_decision in ('aprobado', 'rechazado'))
       or (v_perfil.estado = 'aprobado' and p_decision = 'suspendido')) then
    return jsonb_build_object('ok', false, 'motivo', 'transicion_invalida', 'estado', v_perfil.estado);
  end if;
  if p_decision <> 'aprobado' and length(coalesce(v_motivo, '')) < 5 then
    return jsonb_build_object('ok', false, 'motivo', 'motivo_obligatorio');
  end if;
  if p_actor = v_perfil.creado_por then
    return jsonb_build_object('ok', false, 'motivo', 'es_creador');
  end if;
  if p_actor = v_perfil.editado_por then
    return jsonb_build_object('ok', false, 'motivo', 'es_editor');
  end if;

  insert into public.aprobaciones_perfil (perfil_id, secuencia, decision, decidido_por, decidido_rol, version, contenido_hash, motivo, hash_previo, hash)
  values (p_perfil, 0, p_decision, p_actor, v_rol, v_perfil.version, v_perfil.contenido_hash, v_motivo, '', repeat('0', 64));

  perform set_config('mape.decision_perfil', 'on', true);
  update public.perfiles set estado = p_decision where id = p_perfil;
  perform set_config('mape.decision_perfil', '', true);

  insert into public.bitacora_acciones (actor_user_id, actor_rol, organizacion_id, accion, recurso_tipo, recurso_id, resumen, detalle)
  values (p_actor, v_rol, v_org, 'perfil_' || p_decision, 'perfil', p_perfil::text,
          format('Perfil %s (versión %s)', p_decision, v_perfil.version),
          jsonb_build_object('version', v_perfil.version, 'contenido_hash', v_perfil.contenido_hash));

  return jsonb_build_object('ok', true, 'estado', p_decision, 'version', v_perfil.version,
                            'contenido_hash', v_perfil.contenido_hash);
end;
$$;
alter function public.decidir_perfil(uuid, text, text, uuid) owner to postgres;
revoke execute on function public.decidir_perfil(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.decidir_perfil(uuid, text, text, uuid) to service_role;
comment on function public.decidir_perfil(uuid, text, text, uuid) is
  'Única vía para aprobar, rechazar o suspender un perfil. UNA decisión por llamada (no hay aprobación masiva). Exige rol verificador o admin, transición válida, motivo al rechazar/suspender y que quien decide no haya creado ni editado el perfil. Asienta aprobaciones_perfil (encadenada) y bitacora_acciones. Devuelve {ok, motivo}. EXECUTE solo service_role.';

-- ═══ 4. Un lote solo nace de un titular con perfil aprobado ═════════════════

create or replace function public.perfil_aprobado_de_cliente(p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.perfiles p
                  where p.cliente_id = p_cliente and p.estado = 'aprobado');
$$;
alter function public.perfil_aprobado_de_cliente(uuid) owner to postgres;
revoke execute on function public.perfil_aprobado_de_cliente(uuid) from public, anon;
grant execute on function public.perfil_aprobado_de_cliente(uuid) to authenticated, service_role;

create or replace function public.fn_lote_exigir_perfil_aprobado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Corre después de lote_evaluar_elegibilidad (orden alfabético de triggers
  -- BEFORE INSERT), que ya derivó cliente_id de la fuente.
  if not public.perfil_aprobado_de_cliente(new.cliente_id) then
    raise exception 'perfil_no_aprobado: el titular de origen no tiene un perfil aprobado'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.fn_lote_exigir_perfil_aprobado() owner to postgres;
revoke execute on function public.fn_lote_exigir_perfil_aprobado() from public, anon, authenticated;

drop trigger if exists lote_exigir_perfil_aprobado on public.lotes;
create trigger lote_exigir_perfil_aprobado
  before insert on public.lotes
  for each row execute function public.fn_lote_exigir_perfil_aprobado();

-- ═══ 5. licencias_mina ══════════════════════════════════════════════════════

create table if not exists public.licencias_mina (
  id              uuid primary key default gen_random_uuid(),
  mina_id         uuid not null references public.minas(id) on delete restrict,
  tipo            text not null,
  numero          text null,
  estado          text not null default 'en_tramite',
  vigente_desde   date null,
  vigente_hasta   date null,
  documento_id    uuid null,
  registrado_por  uuid null references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint licencias_mina_tipo_check check (tipo in ('permiso_minero', 'licencia_ambiental', 'permiso_municipal', 'otro')),
  constraint licencias_mina_estado_check check (estado in ('en_tramite', 'vigente', 'vencida', 'suspendida', 'no_aplica')),
  constraint licencias_mina_vigencia_check check (vigente_desde is null or vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create index if not exists idx_licencias_mina_mina on public.licencias_mina (mina_id);

comment on table public.licencias_mina is
  'Estado y vigencia de las licencias y permisos de una mina, tal como constan en los documentos del expediente. Lo carga el personal; el titular solo lo ve. El estado refleja el documento: no es un acto de la autoridad ni lo sustituye. Sin DELETE.';

alter table public.licencias_mina enable row level security;
revoke all on table public.licencias_mina from public, anon, authenticated, service_role;
grant select, insert, update on table public.licencias_mina to service_role;
grant select, insert, update on table public.licencias_mina to authenticated;
revoke delete, truncate on table public.licencias_mina from anon, authenticated, service_role;

drop policy if exists licencias_mina_service_all on public.licencias_mina;
create policy licencias_mina_service_all on public.licencias_mina
  for all to service_role using (true) with check (true);
drop policy if exists licencias_mina_personal_read on public.licencias_mina;
create policy licencias_mina_personal_read on public.licencias_mina
  for select to authenticated using (public.es_personal());
drop policy if exists licencias_mina_carga_insert on public.licencias_mina;
create policy licencias_mina_carga_insert on public.licencias_mina
  for insert to authenticated
  with check ((select public.current_rol()) in ('admin', 'abogado', 'tecnico_ambiental', 'recepcion'));
drop policy if exists licencias_mina_carga_update on public.licencias_mina;
create policy licencias_mina_carga_update on public.licencias_mina
  for update to authenticated
  using ((select public.current_rol()) in ('admin', 'abogado', 'tecnico_ambiental', 'recepcion'))
  with check ((select public.current_rol()) in ('admin', 'abogado', 'tecnico_ambiental', 'recepcion'));
drop policy if exists licencias_mina_titular_read_own on public.licencias_mina;
create policy licencias_mina_titular_read_own on public.licencias_mina
  for select to authenticated
  using (public.es_titular_de_mina(licencias_mina.mina_id));

-- ═══ 6. Verificación post-aplicación (a mano, en Studio) ════════════════════
--   select tgname from pg_trigger where tgrelid = 'public.lotes'::regclass and not tgisinternal order by tgname;
--   -- lote_evaluar_elegibilidad debe quedar ANTES de lote_exigir_perfil_aprobado
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'aprobaciones_perfil';  -- authenticated: solo SELECT
