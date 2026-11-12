-- 043_estandar_privado_cadena.sql — Estándar privado de debida diligencia
-- (brief v2.1, Etapa 2, 11-nov-2026): organizaciones, roles nuevos, fuentes,
-- lotes, cadena de custodia encadenada por hash, pagos bancarios, consentimiento
-- informado, alertas, bitácora de accesos y márgenes del comercializador.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, DESPUÉS de 041 y   ║
-- ║ 042, de un RESPALDO (el proyecto no tiene backups automáticos — ver      ║
-- ║ docs/plan2-runbook-produccion.md) y de la aprobación expresa de Willis.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- CONTRATO. Los nombres de roles, estados, tipos de evento, tipos de alerta,
-- medios de pago y la clave de configuración son los de lib/cadena/types.ts.
-- El canónico del hash es EXACTAMENTE el de lib/cadena/hash.ts (vector de
-- prueba abajo, §6). Las reglas replican lib/cadena/reglas.ts. Si cambiás uno
-- de los tres, cambiá este archivo y tests/rls-estandar-privado.test.ts.
--
-- IDENTIDAD. En la base de datos NO se nombra a ninguna empresa: las
-- organizaciones (comercializador, planta de beneficio, auditor) son filas de
-- `organizaciones`. El personal de CHT (admin | abogado | tecnico_ambiental,
-- `is_internal_staff()` de 041) opera la plataforma; NO compra ni vende
-- mineral y NO ve márgenes del comercializador.
--
-- ROLES (user_roles.rol):
--   admin / abogado / tecnico_ambiental  personal de CHT — lee todo salvo
--                                        margenes_comercializador; escribe
--                                        fuentes, lotes, eventos,
--                                        consentimientos, alertas.
--   cliente                              minero/productor — ve SUS lotes,
--                                        eventos, pagos y consentimientos.
--   comercializador  (NUEVO)             registra fuentes, lotes, eventos y
--                                        pagos de SU organización; sus
--                                        márgenes son internos; NO funde.
--   planta           (NUEVO)             destino de la cadena — ve los lotes
--                                        con planta_org_id = su org, sus
--                                        eventos y alertas; el expediente del
--                                        minero SOLO con consentimiento
--                                        informado vigente; NUNCA pagos ni
--                                        márgenes.
--   auditor          (NUEVO)             lectura (+ exportación vía API) de
--                                        lotes, eventos, fuentes, alertas,
--                                        consentimientos, pagos y bitácora;
--                                        NUNCA márgenes; no escribe.
--
-- SERVICE ROLE. El service_role de ESTE proyecto NO tiene BYPASSRLS (saga
-- 019/024/025/032/041): cada tabla declara su policy `FOR ALL TO service_role`.
-- Los triggers y RPCs de esta migración son SECURITY DEFINER con owner
-- postgres y search_path fijo (patrón 019/033/041), así sus escrituras
-- internas (alertas, bloqueo del lote, evento de pago) no dependen del rol
-- del invocador.
--
-- HASH. Se usa la función de núcleo `sha256(bytea)` (PostgreSQL ≥ 11): no
-- depende de pgcrypto ni del esquema `extensions` de Supabase (donde
-- `digest()` vive fuera de `public` y un search_path fijo no la encontraría).
-- El brief pedía pgcrypto/digest; el resultado es byte a byte el mismo.
--
-- INDELEBILIDAD. lote_eventos, pagos_lote, bitacora_accesos y margenes no
-- admiten DELETE (revoke a anon/authenticated/service_role). lote_eventos y
-- bitacora_accesos tampoco admiten UPDATE (trigger + revoke). consentimientos
-- solo admite el UPDATE vigente → revocado. La corrección es siempre una fila
-- nueva (evento 'correccion', consentimiento nuevo, fuente nueva).
--
-- Idempotente: re-ejecutable sin efectos secundarios (create if not exists,
-- drop policy/trigger if exists, constraints gateadas por pg_constraint,
-- seeds con on conflict do nothing). Verificada ×2 contra PostgreSQL 16 en
-- tests/rls-estandar-privado.test.ts.

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.is_internal_staff()') is null then
    raise exception '043: falta public.is_internal_staff() — aplicar 041_rls_tablas_operativas.sql primero';
  end if;
  if to_regclass('public.user_roles') is null then
    raise exception '043: falta public.user_roles (005)';
  end if;
  if to_regclass('public.clientes') is null then
    raise exception '043: falta public.clientes (008/038)';
  end if;
  if to_regclass('public.roles') is null or to_regclass('public.configuracion_sistema') is null then
    raise exception '043: faltan public.roles / public.configuracion_sistema (006)';
  end if;
end $$;

-- ═══ 1. Roles nuevos + organizaciones ═══════════════════════════════════════

create table if not exists public.organizaciones (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  nombre      text not null,
  rtn         text null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint organizaciones_tipo_check check (tipo in ('comercializador', 'planta', 'auditor'))
);

comment on table public.organizaciones is
  'Organizaciones participantes del estándar privado (comercializador | planta de beneficio | auditor). Ninguna empresa se nombra en el código: aquí viven. CHT (personal interno) NO es una organización de esta tabla.';
comment on column public.organizaciones.rtn is 'RTN (Registro Tributario Nacional) de la organización. Dato interno; nunca se expone en superficies públicas.';

-- 1.a CHECK de user_roles.rol: se reemplaza cualquier CHECK previo sobre rol
-- (005 lo llamó user_roles_rol_check; el esquema a mano de producción podría
-- tener otro nombre) por la lista ampliada.
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
  loop
    execute format('alter table public.user_roles drop constraint %I', r.conname);
  end loop;
  alter table public.user_roles
    add constraint user_roles_rol_check
    check (rol in ('admin', 'abogado', 'tecnico_ambiental', 'cliente', 'comercializador', 'planta', 'auditor'));
end $$;

-- perfiles_profesionales.perfiles_rol_check (005: abogado | tecnico_ambiental |
-- admin) NO cambia: los perfiles profesionales son personal de CHT; los roles
-- nuevos son organizacionales y se ligan por user_roles.organizacion_id.

alter table public.user_roles add column if not exists organizacion_id uuid null;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'user_roles_organizacion_id_fkey'
                    and conrelid = 'public.user_roles'::regclass) then
    alter table public.user_roles
      add constraint user_roles_organizacion_id_fkey
      foreign key (organizacion_id) references public.organizaciones(id) on delete restrict;
  end if;
  -- comercializador y planta exigen organización (sin ella no ven nada).
  -- auditor puede ser interno (sin org) o externo (con org tipo auditor).
  if not exists (select 1 from pg_constraint
                  where conname = 'user_roles_org_requerida_check'
                    and conrelid = 'public.user_roles'::regclass) then
    alter table public.user_roles
      add constraint user_roles_org_requerida_check
      check (rol not in ('comercializador', 'planta') or organizacion_id is not null);
  end if;
end $$;

create index if not exists idx_user_roles_organizacion_id on public.user_roles (organizacion_id);

comment on column public.user_roles.organizacion_id is
  'Organización a la que pertenece el usuario (roles comercializador | planta | auditor). NULL para personal de CHT y clientes. Obligatoria para comercializador y planta (CHECK).';

-- 1.b El tipo de la organización debe coincidir con el rol.
create or replace function public.fn_user_roles_validar_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if new.organizacion_id is null then
    return new;
  end if;
  if new.rol not in ('comercializador', 'planta', 'auditor') then
    raise exception 'organizacion_id solo aplica a los roles comercializador, planta y auditor (rol recibido: %)', new.rol
      using errcode = '23514';
  end if;
  select tipo into v_tipo from public.organizaciones where id = new.organizacion_id;
  if v_tipo is distinct from new.rol then
    raise exception 'el tipo de la organización (%) no coincide con el rol (%)', coalesce(v_tipo, 'inexistente'), new.rol
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_roles_validar_org on public.user_roles;
create trigger trg_user_roles_validar_org
  before insert or update of rol, organizacion_id on public.user_roles
  for each row execute function public.fn_user_roles_validar_org();

-- 1.c Seeds en `roles` (006). Permisos como etiquetas orientativas para la UI;
-- la autorización real la hacen requireRole() y las policies de abajo.
insert into public.roles (nombre, descripcion, permisos, es_sistema) values
  ('comercializador', 'Comercializador — registra fuentes, lotes, eventos de custodia y pagos bancarios de su organización. No funde.',
     '["cadena:read","cadena:fuentes:write","cadena:lotes:write","cadena:eventos:write","cadena:pagos:write","cadena:margenes:write"]', true),
  ('planta',          'Planta de beneficio — destino de la cadena; ve sus lotes y eventos; el expediente del minero solo con consentimiento vigente.',
     '["cadena:read","cadena:eventos:write"]', true),
  ('auditor',         'Auditor — lectura y exportación de la cadena, alertas, pagos y bitácora. No escribe.',
     '["cadena:read","cadena:export","bitacora:read"]', true)
on conflict (nombre) do nothing;

-- ═══ 2. Helpers SECURITY DEFINER ════════════════════════════════════════════

create or replace function public.current_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ur.rol
    from public.user_roles ur
   where ur.user_id = auth.uid()
     and ur.activo
   limit 1;
$$;
alter function public.current_rol() owner to postgres;
comment on function public.current_rol() is
  'RLS helper (043): rol activo de auth.uid() o NULL. SECURITY DEFINER para no depender de la policy de lectura de user_roles.';

create or replace function public.current_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ur.organizacion_id
    from public.user_roles ur
   where ur.user_id = auth.uid()
     and ur.activo
   limit 1;
$$;
alter function public.current_org() owner to postgres;
comment on function public.current_org() is
  'RLS helper (043): organizacion_id de auth.uid() (comercializador | planta | auditor) o NULL.';

-- ═══ 3. fuentes_comercializador ═════════════════════════════════════════════

create table if not exists public.fuentes_comercializador (
  id                         uuid primary key default gen_random_uuid(),
  organizacion_id            uuid not null references public.organizaciones(id) on delete restrict,
  cliente_id                 uuid not null references public.clientes(id) on delete restrict,
  mina_id                    uuid null,
  permiso_municipal_numero   text null,
  permiso_vigente_hasta      date null,
  dentro_area_inhgeomin      boolean null,
  declaracion_mercurio_cero  boolean null,
  clpi_estado                text not null default 'pendiente',
  documentos                 jsonb not null default '{}'::jsonb,
  registrado_por             uuid null references auth.users(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint fuentes_clpi_estado_check check (clpi_estado in ('no_aplica', 'documentado', 'pendiente'))
);

-- FK a minas solo si la tabla existe (040); en un ambiente sin minas queda libre.
do $$
begin
  if to_regclass('public.minas') is not null
     and not exists (select 1 from pg_constraint
                      where conname = 'fuentes_comercializador_mina_id_fkey'
                        and conrelid = 'public.fuentes_comercializador'::regclass) then
    alter table public.fuentes_comercializador
      add constraint fuentes_comercializador_mina_id_fkey
      foreign key (mina_id) references public.minas(id) on delete set null;
  end if;
end $$;

create index if not exists idx_fuentes_org     on public.fuentes_comercializador (organizacion_id);
create index if not exists idx_fuentes_cliente on public.fuentes_comercializador (cliente_id);

comment on table public.fuentes_comercializador is
  'Fuente (origen) que un comercializador registra para comprar: minero/productor (cliente_id), mina opcional, permiso municipal, ubicación dentro de área delimitada por INHGEOMIN, declaración de mercurio cero y estado CLPI. Base documental de la verificación de origen del comprador — Art. 43 incisos c, e y f del Reglamento (Acuerdo Ejecutivo 042-2013) [VERIFICAR LEGAL MINERO]; Art. 90 LGM [VERIFICAR LEGAL MINERO]. Sin DELETE: la corrección es una fila nueva o un update por la misma organización.';
comment on column public.fuentes_comercializador.permiso_vigente_hasta is
  'Vigencia del permiso municipal. NULL o anterior a hoy → el lote nace bloqueado (permiso_municipal_no_vigente).';
comment on column public.fuentes_comercializador.dentro_area_inhgeomin is
  'TRUE si la fuente está dentro de un área delimitada por INHGEOMIN. Distinto de TRUE → el lote nace bloqueado (fuera_de_area_inhgeomin).';
comment on column public.fuentes_comercializador.declaracion_mercurio_cero is
  'Declaración del productor de no usar mercurio. Distinto de TRUE → alerta "mercurio" (NO bloquea).';
comment on column public.fuentes_comercializador.clpi_estado is
  'Consulta libre, previa e informada: no_aplica | documentado | pendiente. pendiente → el lote nace bloqueado (clpi_pendiente).';

-- ═══ 4. lotes ═══════════════════════════════════════════════════════════════

create table if not exists public.lotes (
  id                      uuid primary key default gen_random_uuid(),
  codigo                  text not null unique,
  fuente_id               uuid not null references public.fuentes_comercializador(id) on delete restrict,
  cliente_id              uuid not null references public.clientes(id) on delete restrict,
  comercializador_org_id  uuid not null references public.organizaciones(id) on delete restrict,
  planta_org_id           uuid null references public.organizaciones(id) on delete restrict,
  estado                  text not null default 'abierto',
  bloqueo_motivo          text null,
  created_by              uuid null references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint lotes_estado_check check (estado in ('abierto', 'bloqueado', 'conciliado', 'cerrado'))
);

create index if not exists idx_lotes_fuente      on public.lotes (fuente_id);
create index if not exists idx_lotes_cliente     on public.lotes (cliente_id);
create index if not exists idx_lotes_comerc_org  on public.lotes (comercializador_org_id);
create index if not exists idx_lotes_planta_org  on public.lotes (planta_org_id);
create index if not exists idx_lotes_estado      on public.lotes (estado);

comment on table public.lotes is
  'Lote de mineral con cadena de custodia. Nace "abierto" o "bloqueado" según la elegibilidad de la fuente (trigger lote_evaluar_elegibilidad). "conciliado" lo fija conciliar_lote(); "cerrado" lo fija el personal de CHT. Sin DELETE.';
comment on column public.lotes.bloqueo_motivo is
  'Motivos de bloqueo separados por ";" (permiso_municipal_no_vigente | fuera_de_area_inhgeomin | clpi_pendiente | pago_invalido: <motivo>).';

-- 4.a Alertas (se declara antes porque los triggers de lotes escriben aquí).
create table if not exists public.alertas_lote (
  id           uuid primary key default gen_random_uuid(),
  lote_id      uuid not null references public.lotes(id) on delete restrict,
  tipo         text not null,
  detalle      jsonb not null default '{}'::jsonb,
  resuelta     boolean not null default false,
  resuelta_por uuid null references auth.users(id) on delete set null,
  resuelta_en  timestamptz null,
  created_at   timestamptz not null default now(),
  constraint alertas_lote_tipo_check check (tipo in (
    'conciliacion_peso', 'umbral_no_configurado', 'pago_invalido',
    'fuente_no_elegible', 'mercurio', 'clpi', 'fundicion_rechazada'))
);

create index if not exists idx_alertas_lote_lote on public.alertas_lote (lote_id);
create index if not exists idx_alertas_lote_pendientes on public.alertas_lote (lote_id, tipo) where not resuelta;

comment on table public.alertas_lote is
  'Alertas por lote (tipos de lib/cadena/types.ts TIPOS_ALERTA). Las escriben los triggers/RPCs de la BD y la API; se resuelven (resuelta=true) por el personal de CHT. "fundicion_rechazada" la registra la API: el trigger que rechaza la fundición aborta el statement y no puede insertar en la misma transacción.';

-- 4.b Elegibilidad de la fuente — réplica de evaluarElegibilidadFuente().
create or replace function public.fuente_bloqueos(p_fuente_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_remove(array[
           case when f.permiso_vigente_hasta is null or f.permiso_vigente_hasta < current_date
                then 'permiso_municipal_no_vigente' end,
           case when f.dentro_area_inhgeomin is distinct from true
                then 'fuera_de_area_inhgeomin' end,
           case when f.clpi_estado = 'pendiente'
                then 'clpi_pendiente' end
         ], null), '{}'::text[])
    from public.fuentes_comercializador f
   where f.id = p_fuente_id;
$$;
alter function public.fuente_bloqueos(uuid) owner to postgres;
comment on function public.fuente_bloqueos(uuid) is
  'Motivos que BLOQUEAN un lote de esta fuente (réplica SQL de lib/cadena/reglas.ts evaluarElegibilidadFuente). Vacío = elegible.';

create or replace function public.fn_lote_evaluar_elegibilidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fuente   public.fuentes_comercializador%rowtype;
  v_bloqueos text[];
begin
  select * into v_fuente from public.fuentes_comercializador where id = new.fuente_id;
  if not found then
    raise exception 'fuente_no_existe: %', new.fuente_id using errcode = '23503';
  end if;

  -- cliente y comercializador se derivan de la fuente; si vienen, deben coincidir.
  new.cliente_id := coalesce(new.cliente_id, v_fuente.cliente_id);
  if new.cliente_id <> v_fuente.cliente_id then
    raise exception 'lote_cliente_no_coincide: el cliente del lote no es el de la fuente' using errcode = '23514';
  end if;
  new.comercializador_org_id := coalesce(new.comercializador_org_id, v_fuente.organizacion_id);
  if new.comercializador_org_id <> v_fuente.organizacion_id then
    raise exception 'lote_org_no_coincide: el comercializador del lote no es el de la fuente' using errcode = '23514';
  end if;

  v_bloqueos := public.fuente_bloqueos(new.fuente_id);
  if coalesce(array_length(v_bloqueos, 1), 0) > 0 then
    new.estado := 'bloqueado';
    new.bloqueo_motivo := array_to_string(v_bloqueos, ';');
  else
    -- Todo lote nace abierto; conciliado/cerrado se alcanzan después.
    new.estado := 'abierto';
    new.bloqueo_motivo := null;
  end if;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lote_evaluar_elegibilidad on public.lotes;
create trigger lote_evaluar_elegibilidad
  before insert on public.lotes
  for each row execute function public.fn_lote_evaluar_elegibilidad();

-- Las alertas se insertan DESPUÉS del insert (la FK alertas_lote.lote_id exige
-- que la fila del lote ya exista).
create or replace function public.fn_lote_alertas_fuente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bloqueos text[];
  v_mercurio boolean;
begin
  v_bloqueos := public.fuente_bloqueos(new.fuente_id);
  if coalesce(array_length(v_bloqueos, 1), 0) > 0 then
    insert into public.alertas_lote (lote_id, tipo, detalle)
    values (new.id, 'fuente_no_elegible',
            jsonb_build_object('fuente_id', new.fuente_id, 'bloqueos', to_jsonb(v_bloqueos)));
  end if;
  select declaracion_mercurio_cero into v_mercurio
    from public.fuentes_comercializador where id = new.fuente_id;
  if v_mercurio is distinct from true then
    insert into public.alertas_lote (lote_id, tipo, detalle)
    values (new.id, 'mercurio',
            jsonb_build_object('fuente_id', new.fuente_id, 'motivo', 'sin_declaracion_mercurio_cero'));
  end if;
  return null;
end;
$$;

drop trigger if exists lote_alertas_fuente on public.lotes;
create trigger lote_alertas_fuente
  after insert on public.lotes
  for each row execute function public.fn_lote_alertas_fuente();

-- updated_at en updates de lotes y fuentes.
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_lotes_touch on public.lotes;
create trigger trg_lotes_touch before update on public.lotes
  for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_fuentes_touch on public.fuentes_comercializador;
create trigger trg_fuentes_touch before update on public.fuentes_comercializador
  for each row execute function public.fn_touch_updated_at();

-- ═══ 5. JSON canónico (fallback del hash) ═══════════════════════════════════
-- Réplica de canonicalJson() de lib/cadena/hash.ts: claves ordenadas
-- recursivamente (orden de bytes), sin espacios. La API SIEMPRE envía
-- detalle_canonico calculado en JS; esta función solo cubre inserts hechos
-- desde SQL/RPCs (p. ej. el evento 'pago' de registrar_pago_lote). Diferencias
-- conocidas con JSON.stringify: números como 1.0 (jsonb conserva "1.0", JS
-- emite "1") — evitar decimales redundantes en `detalle`.
create or replace function public.jsonb_canonico(j jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  if j is null then
    return '{}';
  end if;
  case jsonb_typeof(j)
    when 'object' then
      select coalesce(string_agg(to_jsonb(k)::text || ':' || public.jsonb_canonico(val), ',' order by k collate "C"), '')
        into v
        from jsonb_each(j) as e(k, val);
      return '{' || v || '}';
    when 'array' then
      select coalesce(string_agg(public.jsonb_canonico(val), ',' order by ord), '')
        into v
        from jsonb_array_elements(j) with ordinality as a(val, ord);
      return '[' || v || ']';
    else
      return j::text;
  end case;
end;
$$;

-- ═══ 6. lote_eventos — cadena de custodia encadenada por hash ═══════════════

create table if not exists public.lote_eventos (
  id                uuid primary key default gen_random_uuid(),
  lote_id           uuid not null references public.lotes(id) on delete restrict,
  secuencia         integer not null,
  tipo              text not null,
  actor_user_id     uuid null references auth.users(id) on delete set null,
  actor_rol         text null,
  actor_nombre      text null,
  fecha             timestamptz not null default now(),
  lugar             text null,
  peso_g            numeric(14,3) null,
  ley_fino          numeric(7,6) null,
  detalle           jsonb not null default '{}'::jsonb,
  detalle_canonico  text not null,
  hash_previo       text not null,
  hash              text not null,
  created_at        timestamptz not null default now(),
  constraint lote_eventos_tipo_check check (tipo in (
    'origen_mina', 'acopio', 'transporte', 'recepcion_planta', 'laboratorio',
    'fundicion', 'refinado', 'pago', 'correccion', 'nota')),
  constraint lote_eventos_peso_check check (peso_g is null or peso_g >= 0),
  constraint lote_eventos_ley_check  check (ley_fino is null or (ley_fino >= 0 and ley_fino <= 1)),
  constraint lote_eventos_hash_check check (hash ~ '^[0-9a-f]{64}$'),
  constraint lote_eventos_lote_secuencia_key unique (lote_id, secuencia)
);

create index if not exists idx_lote_eventos_lote_tipo on public.lote_eventos (lote_id, tipo, secuencia desc);

comment on table public.lote_eventos is
  'Cadena de custodia APPEND-ONLY. Cada fila lleva hash = sha256(canónico) donde el canónico incluye hash_previo (GENESIS en la primera). secuencia, hash_previo, detalle_canonico (si falta) y hash los fija el trigger lote_evento_encadenar; si el INSERT los trae y no coinciden, se rechaza (23514). Sin UPDATE ni DELETE (trigger + revoke). Canónico idéntico a lib/cadena/hash.ts.';
comment on column public.lote_eventos.detalle_canonico is
  'JSON canónico de `detalle` (claves ordenadas, sin espacios) tal como entró al hash. La API lo manda calculado con canonicalJson(); si falta, jsonb_canonico(detalle).';
comment on column public.lote_eventos.ley_fino is 'Ley como fracción 0–1 (0.9165 = 91,65 % de oro fino).';

create or replace function public.canonico_evento(
  p_lote_id uuid, p_secuencia integer, p_tipo text, p_actor_user_id uuid,
  p_fecha timestamptz, p_lugar text, p_peso_g numeric, p_ley_fino numeric,
  p_detalle_canonico text, p_hash_previo text)
returns text
language sql
stable
as $$
  -- concat_ws omite NULLs: por eso cada campo opcional lleva coalesce(..., '')
  -- para conservar el separador vacío ("||"), como hace el join('|') de JS.
  select concat_ws('|',
    p_lote_id::text,
    p_secuencia::text,
    p_tipo,
    coalesce(p_actor_user_id::text, ''),
    to_char(p_fecha at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    coalesce(p_lugar, ''),
    coalesce(to_char(p_peso_g, 'FM999999999990.000'), ''),
    coalesce(to_char(p_ley_fino, 'FM0.000000'), ''),
    p_detalle_canonico,
    p_hash_previo);
$$;

comment on function public.canonico_evento(uuid, integer, text, uuid, timestamptz, text, numeric, numeric, text, text) is
  'Canónico del hash de un evento — EXACTAMENTE lib/cadena/hash.ts canonicoEvento(). Vector: lote 11111111-1111-4111-8111-111111111111, seq 1, origen_mina, actor NULL, 2026-11-12T14:05:06.007Z, Iriona, 1250.5, 0.9165, {"a":1,"b":"x"}, GENESIS → sha256 a2e60d8d5871069087b5bda166e719a73303777c81a04436633e1938944f09b8.';

create or replace function public.sha256_hex(p text)
returns text
language sql
stable
as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;

create or replace function public.fn_lote_evento_encadenar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id   uuid;
  v_seq       integer;
  v_prev_hash text;
  v_hash      text;
  v_rol       text;
  v_titular   jsonb;
begin
  -- (a) Serializar por lote: bloquea la fila del lote hasta el commit.
  select id into v_lote_id from public.lotes where id = new.lote_id for update;
  if not found then
    raise exception 'lote_no_existe: %', new.lote_id using errcode = '23503';
  end if;

  -- (e) Fundición: nunca el comercializador; siempre un titular de beneficio
  -- identificado (réplica de validarEventoFundicion()). La alerta
  -- 'fundicion_rechazada' la registra la API (este RAISE aborta la transacción).
  if new.tipo = 'fundicion' then
    v_rol := coalesce(new.detalle->>'realizado_por_rol', new.actor_rol, '');
    if v_rol = 'comercializador' then
      raise exception 'fundicion_no_permitida: el comercializador no funde; solo un titular de beneficio identificado'
        using errcode = '23514';
    end if;
    v_titular := new.detalle->'titular_beneficio';
    if v_titular is null
       or jsonb_typeof(v_titular) <> 'object'
       or coalesce(trim(v_titular->>'nombre'), '') = ''
       or coalesce(trim(v_titular->>'identificacion'), '') = '' then
      raise exception 'fundicion_no_permitida: sin titular de beneficio identificado'
        using errcode = '23514';
    end if;
  end if;

  -- (a) secuencia = siguiente del lote.
  select coalesce(max(secuencia), 0) + 1 into v_seq
    from public.lote_eventos where lote_id = new.lote_id;
  if new.secuencia is not null and new.secuencia <> v_seq then
    raise exception 'secuencia_no_coincide: esperada %, recibida %', v_seq, new.secuencia
      using errcode = '23514';
  end if;
  new.secuencia := v_seq;

  -- (b) hash_previo = hash del evento anterior o GENESIS.
  select hash into v_prev_hash
    from public.lote_eventos
   where lote_id = new.lote_id and secuencia = v_seq - 1;
  v_prev_hash := coalesce(v_prev_hash, 'GENESIS');
  if new.hash_previo is not null and new.hash_previo <> v_prev_hash then
    raise exception 'hash_previo_no_coincide: esperado %, recibido %', v_prev_hash, new.hash_previo
      using errcode = '23514';
  end if;
  new.hash_previo := v_prev_hash;

  -- Normalización: la fecha se trunca a milisegundos (precisión de JS) para que
  -- lo almacenado sea exactamente lo que entró al hash.
  new.fecha   := date_trunc('milliseconds', coalesce(new.fecha, now()));
  new.detalle := coalesce(new.detalle, '{}'::jsonb);

  -- (c) detalle_canonico: la API lo manda; si falta, se deriva de detalle.
  if new.detalle_canonico is null or new.detalle_canonico = '' then
    new.detalle_canonico := public.jsonb_canonico(new.detalle);
  end if;

  -- (d) hash = sha256(canónico).
  v_hash := public.sha256_hex(public.canonico_evento(
    new.lote_id, new.secuencia, new.tipo, new.actor_user_id, new.fecha, new.lugar,
    new.peso_g, new.ley_fino, new.detalle_canonico, new.hash_previo));
  if new.hash is not null and new.hash <> v_hash then
    raise exception 'hash_no_coincide: el hash calculado por la base no coincide con el recibido (canónico distinto)'
      using errcode = '23514';
  end if;
  new.hash := v_hash;
  new.created_at := coalesce(new.created_at, now());

  update public.lotes set updated_at = now() where id = new.lote_id;
  return new;
end;
$$;

drop trigger if exists lote_evento_encadenar on public.lote_eventos;
create trigger lote_evento_encadenar
  before insert on public.lote_eventos
  for each row execute function public.fn_lote_evento_encadenar();

-- (f) Append-only.
create or replace function public.fn_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% es append-only: no se permite % (la corrección es una fila nueva)', tg_table_name, tg_op
    using errcode = '23514';
end;
$$;

drop trigger if exists lote_eventos_append_only on public.lote_eventos;
create trigger lote_eventos_append_only
  before update or delete on public.lote_eventos
  for each row execute function public.fn_append_only();

-- Verificación de la cadena. SECURITY INVOKER a propósito: la RLS del
-- invocador decide qué lote ve; todas las policies de lote_eventos exponen la
-- cadena COMPLETA de cada lote visible, así que una cadena parcial solo puede
-- significar que el lote no es visible (ok=null, motivo lote_no_visible).
create or replace function public.verificar_cadena_lote(p_lote uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  r       record;
  v_prev  text := 'GENESIS';
  v_esp   integer := 1;
  v_total integer := 0;
begin
  if not exists (select 1 from public.lotes where id = p_lote) then
    return jsonb_build_object('ok', null, 'total', 0, 'primera_rotura', null, 'motivo', 'lote_no_visible');
  end if;
  select count(*) into v_total from public.lote_eventos where lote_id = p_lote;
  for r in
    select * from public.lote_eventos where lote_id = p_lote order by secuencia
  loop
    if r.secuencia <> v_esp then
      return jsonb_build_object('ok', false, 'total', v_total, 'primera_rotura', r.secuencia, 'motivo', 'secuencia_no_consecutiva');
    end if;
    if r.hash_previo <> v_prev then
      return jsonb_build_object('ok', false, 'total', v_total, 'primera_rotura', r.secuencia, 'motivo', 'hash_previo_no_coincide');
    end if;
    if public.sha256_hex(public.canonico_evento(
         r.lote_id, r.secuencia, r.tipo, r.actor_user_id, r.fecha, r.lugar,
         r.peso_g, r.ley_fino, r.detalle_canonico, r.hash_previo)) <> r.hash then
      return jsonb_build_object('ok', false, 'total', v_total, 'primera_rotura', r.secuencia, 'motivo', 'hash_alterado');
    end if;
    v_prev := r.hash;
    v_esp  := v_esp + 1;
  end loop;
  return jsonb_build_object('ok', true, 'total', v_total, 'primera_rotura', null, 'motivo', null);
end;
$$;

comment on function public.verificar_cadena_lote(uuid) is
  'Recalcula la cadena de hash de un lote (réplica de lib/cadena/hash.ts verificarCadena). {ok, total, primera_rotura, motivo}. SECURITY INVOKER: respeta la RLS del que llama.';

-- ═══ 7. pagos_lote + registrar_pago_lote ════════════════════════════════════

create table if not exists public.pagos_lote (
  id                       uuid primary key default gen_random_uuid(),
  lote_id                  uuid not null references public.lotes(id) on delete restrict,
  monto_lps                numeric(14,2) not null,
  medio                    text not null,
  referencia_bancaria      text not null,
  banco                    text null,
  fecha_pago               date not null,
  beneficiario_cliente_id  uuid not null references public.clientes(id) on delete restrict,
  pagado_por_org_id        uuid not null references public.organizaciones(id) on delete restrict,
  registrado_por           uuid null references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  constraint pagos_lote_monto_check check (monto_lps > 0),
  constraint pagos_lote_medio_check check (medio in ('transferencia', 'deposito', 'cheque_bancario')),
  constraint pagos_lote_referencia_check check (length(trim(referencia_bancaria)) >= 4)
);

create index if not exists idx_pagos_lote_lote on public.pagos_lote (lote_id);
create index if not exists idx_pagos_lote_beneficiario on public.pagos_lote (beneficiario_cliente_id);
create index if not exists idx_pagos_lote_org on public.pagos_lote (pagado_por_org_id);

comment on table public.pagos_lote is
  'Pagos del comercializador al productor por lote. SOLO medios bancarios identificables (CHECK): el efectivo NO existe como opción — registrar_pago_lote() bloquea el lote. INSERT únicamente vía registrar_pago_lote() (service_role): la escritura directa saltaría el bloqueo y el evento de la cadena. Sin DELETE. El monto vive aquí, no en el evento.';

create or replace function public.registrar_pago_lote(
  p_lote uuid, p_medio text, p_referencia text, p_monto numeric,
  p_banco text, p_fecha_pago date, p_registrado_por uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote   public.lotes%rowtype;
  v_medio  text := lower(trim(coalesce(p_medio, '')));
  v_ref    text := trim(coalesce(p_referencia, ''));
  v_motivo text := null;
  v_pago   uuid;
  v_rol    text;
begin
  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'lote_no_existe', 'lote_bloqueado', false);
  end if;
  if v_lote.estado = 'bloqueado' then
    return jsonb_build_object('ok', false, 'motivo', 'lote_bloqueado', 'lote_bloqueado', true,
                              'bloqueo_motivo', v_lote.bloqueo_motivo);
  end if;
  if v_lote.estado = 'cerrado' then
    return jsonb_build_object('ok', false, 'motivo', 'lote_cerrado', 'lote_bloqueado', false);
  end if;

  -- Réplica de validarPago(): efectivo → medio → referencia.
  if v_medio in ('efectivo', 'cash') then
    v_motivo := 'efectivo_prohibido';
  elsif v_medio not in ('transferencia', 'deposito', 'cheque_bancario') then
    v_motivo := 'medio_no_admitido';
  elsif length(v_ref) < 4 then
    v_motivo := 'sin_referencia_bancaria';
  end if;

  if v_motivo is not null then
    -- El bloqueo PERSISTE: sin excepción (un RAISE revertiría el bloqueo).
    update public.lotes
       set estado = 'bloqueado',
           bloqueo_motivo = 'pago_invalido: ' || v_motivo,
           updated_at = now()
     where id = p_lote;
    insert into public.alertas_lote (lote_id, tipo, detalle)
    values (p_lote, 'pago_invalido', jsonb_build_object(
      'motivo', v_motivo, 'medio', v_medio, 'registrado_por', p_registrado_por));
    return jsonb_build_object('ok', false, 'motivo', v_motivo, 'lote_bloqueado', true);
  end if;

  if p_monto is null or p_monto <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'monto_invalido', 'lote_bloqueado', false);
  end if;

  insert into public.pagos_lote (
    lote_id, monto_lps, medio, referencia_bancaria, banco, fecha_pago,
    beneficiario_cliente_id, pagado_por_org_id, registrado_por)
  values (
    p_lote, p_monto, v_medio, v_ref, nullif(trim(coalesce(p_banco, '')), ''),
    coalesce(p_fecha_pago, current_date),
    v_lote.cliente_id, v_lote.comercializador_org_id, p_registrado_por)
  returning id into v_pago;

  select rol into v_rol from public.user_roles where user_id = p_registrado_por;

  -- Evento de la cadena SIN monto (el monto vive en pagos_lote).
  insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol, detalle)
  values (p_lote, 'pago', p_registrado_por, v_rol, jsonb_build_object(
    'pago_id', v_pago, 'medio', v_medio, 'referencia', v_ref,
    'banco', nullif(trim(coalesce(p_banco, '')), '')));

  return jsonb_build_object('ok', true, 'pago_id', v_pago);
end;
$$;

comment on function public.registrar_pago_lote(uuid, text, text, numeric, text, date, uuid) is
  'Registra un pago bancario por lote. Efectivo, medio no admitido o referencia < 4 chars → bloquea el lote (estado bloqueado, bloqueo_motivo "pago_invalido: …"), inserta alerta pago_invalido y devuelve {ok:false, motivo, lote_bloqueado:true} SIN excepción. OK → inserta pagos_lote + evento "pago" y devuelve {ok:true, pago_id}. No hay excepciones que dejen pasar el lote. EXECUTE solo service_role: la API decide quién llama.';

-- ═══ 8. consentimientos ═════════════════════════════════════════════════════

create table if not exists public.consentimientos (
  id                          uuid primary key default gen_random_uuid(),
  cliente_id                  uuid not null references public.clientes(id) on delete restrict,
  otorgado_a_org_id           uuid not null references public.organizaciones(id) on delete restrict,
  documento_path              text not null,
  hash_sha256                 char(64) not null,
  fecha_firma                 date not null,
  alcance                     jsonb not null default '{}'::jsonb,
  estado                      text not null default 'vigente',
  revocado_en                 timestamptz null,
  revocacion_constancia_path  text null,
  revocacion_motivo           text null,
  registrado_por              uuid null references auth.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  constraint consentimientos_hash_check   check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  constraint consentimientos_estado_check check (estado in ('vigente', 'revocado'))
);

create index if not exists idx_consentimientos_cliente_org on public.consentimientos (cliente_id, otorgado_a_org_id) where estado = 'vigente';
create index if not exists idx_consentimientos_org on public.consentimientos (otorgado_a_org_id);

comment on table public.consentimientos is
  'Consentimiento informado del minero (cliente_id) para que una organización (planta) vea su expediente/documentos/lotes. `alcance` = {"expediente":true,"documentos":true,"lotes":true}. El texto legal del documento firmado está [REVISAR CAPITÁN LEGAL] — no se inventa aquí. Único UPDATE permitido: vigente → revocado (trigger). Sin DELETE. La revocación cierra el acceso desde revocado_en; las lecturas anteriores quedan en bitacora_accesos.';

create or replace function public.fn_consentimiento_solo_revocar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'consentimientos es indeleble: no se permite DELETE (revoque con estado = revocado)'
      using errcode = '23514';
  end if;
  if not (old.estado = 'vigente' and new.estado = 'revocado') then
    raise exception 'consentimientos: el único cambio permitido es vigente → revocado'
      using errcode = '23514';
  end if;
  -- Solo pueden cambiar los campos de la revocación.
  if new.cliente_id <> old.cliente_id
     or new.otorgado_a_org_id <> old.otorgado_a_org_id
     or new.documento_path <> old.documento_path
     or new.hash_sha256 <> old.hash_sha256
     or new.fecha_firma <> old.fecha_firma
     or new.alcance <> old.alcance
     or new.registrado_por is distinct from old.registrado_por
     or new.created_at <> old.created_at then
    raise exception 'consentimientos: al revocar solo cambian estado, revocado_en, revocacion_constancia_path y revocacion_motivo'
      using errcode = '23514';
  end if;
  new.revocado_en := coalesce(new.revocado_en, now());
  return new;
end;
$$;

drop trigger if exists consentimientos_solo_revocar on public.consentimientos;
create trigger consentimientos_solo_revocar
  before update or delete on public.consentimientos
  for each row execute function public.fn_consentimiento_solo_revocar();

-- Helper para las policies de planta sobre expedientes/documentos/clientes.
create or replace function public.planta_tiene_consentimiento(p_cliente uuid, p_alcance text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_rol() = 'planta'
     and exists (
       select 1
         from public.consentimientos c
        where c.cliente_id = p_cliente
          and c.otorgado_a_org_id = public.current_org()
          and c.alcance ->> p_alcance = 'true'
          and (c.estado = 'vigente'
               or (c.estado = 'revocado' and c.revocado_en > now()))
     );
$$;
alter function public.planta_tiene_consentimiento(uuid, text) owner to postgres;
comment on function public.planta_tiene_consentimiento(uuid, text) is
  'RLS helper (043): true si el usuario es planta y su organización tiene consentimiento del cliente para el alcance (expediente | documentos | lotes) vigente, o revocado con revocado_en futuro (réplica de accesoPorConsentimiento()).';

-- ═══ 9. bitacora_accesos (append-only) ══════════════════════════════════════

create table if not exists public.bitacora_accesos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid null,
  rol              text null,
  organizacion_id  uuid null,
  accion           text not null,
  recurso_tipo     text not null,
  recurso_id       text null,
  detalle          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint bitacora_accesos_accion_check check (accion in ('lectura', 'exportacion'))
);

create index if not exists idx_bitacora_user on public.bitacora_accesos (user_id, created_at desc);
create index if not exists idx_bitacora_recurso on public.bitacora_accesos (recurso_tipo, recurso_id);

comment on table public.bitacora_accesos is
  'Bitácora APPEND-ONLY de lecturas y exportaciones de datos de la cadena. La escribe la API (service_role) o el propio usuario autenticado (solo filas con su user_id). La leen admin y auditor. Sin UPDATE ni DELETE.';

drop trigger if exists bitacora_accesos_append_only on public.bitacora_accesos;
create trigger bitacora_accesos_append_only
  before update or delete on public.bitacora_accesos
  for each row execute function public.fn_append_only();

-- ═══ 10. margenes_comercializador ═══════════════════════════════════════════

create table if not exists public.margenes_comercializador (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones(id) on delete restrict,
  lote_id          uuid null references public.lotes(id) on delete restrict,
  precio_venta_lps numeric(14,2) null,
  margen_pct       numeric(6,3) null,
  notas            text null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_margenes_org on public.margenes_comercializador (organizacion_id);

comment on table public.margenes_comercializador is
  'Precios de venta y márgenes del comercializador. INTERNOS de su organización: solo el rol comercializador de la misma org (y service_role) los lee/escribe. Ni admin, ni planta, ni auditor, ni cliente. [DECISIÓN PENDIENTE — WILLIS: si el personal de CHT debe verlos para mantenimiento de la plataforma.] Sin DELETE.';

-- ═══ 11. Configuración: umbral de conciliación (sin valor) ══════════════════

insert into public.configuracion_sistema (clave, tipo, descripcion)
values ('umbral_conciliacion_peso_pct', 'numero',
        'Umbral (%) de diferencia de peso tolerada entre puntos de la cadena. [POR DEFINIR — WILLIS / LEGAL MINERO]. NULL = no configurado: ningún lote se concilia.')
on conflict (clave) do nothing;

-- ═══ 12. conciliar_lote ═════════════════════════════════════════════════════

create or replace function public.conciliar_lote(p_lote uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote     public.lotes%rowtype;
  v_umbral   numeric := null;
  v_valor    text;
  v_puntos   constant text[] := array['origen_mina', 'acopio', 'laboratorio', 'refinado'];
  v_peso     numeric[] := array[null, null, null, null]::numeric[];
  v_presente boolean[] := array[false, false, false, false];
  v_faltan   text[] := '{}';
  v_difs     jsonb := '[]'::jsonb;
  v_excede   boolean := false;
  v_estado   text;
  v_prev_i   integer := null;
  v_a        numeric;
  v_b        numeric;
  v_pct      numeric;
  v_tmp      numeric;
  i          integer;
begin
  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then
    return jsonb_build_object('estado', 'lote_no_existe', 'conciliado', false);
  end if;

  -- Umbral: NULL si no está configurado o no es numérico.
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

  -- Último peso_g por punto (el último registrado gana — réplica de conciliarPesos()).
  for i in 1..4 loop
    select e.peso_g into v_tmp
      from public.lote_eventos e
     where e.lote_id = p_lote and e.tipo = v_puntos[i] and e.peso_g is not null
     order by e.secuencia desc
     limit 1;
    v_presente[i] := found;
    if found then
      v_peso[i] := v_tmp;
    else
      v_faltan := v_faltan || v_puntos[i];
    end if;
  end loop;

  -- Diferencias entre puntos consecutivos presentes.
  for i in 1..4 loop
    if v_presente[i] then
      if v_prev_i is not null then
        v_a := v_peso[v_prev_i];
        v_b := v_peso[i];
        if v_a > 0 then
          v_pct := abs(v_b - v_a) / v_a * 100;
        elsif v_b = 0 then
          v_pct := 0;
        else
          v_pct := null; -- Infinity en JS; jsonb no admite infinito
        end if;
        v_difs := v_difs || jsonb_build_object(
          'desde', v_puntos[v_prev_i], 'hasta', v_puntos[i],
          'peso_desde', v_a, 'peso_hasta', v_b, 'diferencia_pct', v_pct,
          'excede', case when v_umbral is null then null
                         when v_pct is null then true
                         else v_pct > v_umbral end);
        if v_umbral is not null and (v_pct is null or v_pct > v_umbral) then
          v_excede := true;
        end if;
      end if;
      v_prev_i := i;
    end if;
  end loop;

  if v_umbral is null then
    v_estado := 'umbral_no_configurado';
    if not exists (select 1 from public.alertas_lote
                    where lote_id = p_lote and tipo = 'umbral_no_configurado' and not resuelta) then
      insert into public.alertas_lote (lote_id, tipo, detalle)
      values (p_lote, 'umbral_no_configurado',
              jsonb_build_object('clave', 'umbral_conciliacion_peso_pct', 'actor', p_actor));
    end if;
  elsif coalesce(array_length(v_faltan, 1), 0) > 0 then
    v_estado := 'incompleto';
  elsif v_excede then
    v_estado := 'alerta';
    insert into public.alertas_lote (lote_id, tipo, detalle)
    values (p_lote, 'conciliacion_peso',
            jsonb_build_object('umbral_pct', v_umbral, 'diferencias', v_difs, 'actor', p_actor));
  else
    v_estado := 'conciliado';
    -- Nunca desbloquea un lote bloqueado; no toca cerrado.
    if v_lote.estado = 'abierto' then
      update public.lotes set estado = 'conciliado', updated_at = now() where id = p_lote;
      v_lote.estado := 'conciliado';
    end if;
  end if;

  return jsonb_build_object(
    'estado', v_estado,
    'conciliado', v_estado = 'conciliado',
    'diferencias', v_difs,
    'faltan', to_jsonb(v_faltan),
    'umbral_pct', v_umbral,
    'lote_estado', v_lote.estado);
end;
$$;

comment on function public.conciliar_lote(uuid, uuid) is
  'Conciliación de pesos entre origen_mina → acopio → laboratorio → refinado (réplica de lib/cadena/reglas.ts conciliarPesos). Umbral NULL → alerta umbral_no_configurado y NO cambia estado; diferencias > umbral → alerta conciliacion_peso; todo dentro → estado conciliado (solo desde abierto; nunca desbloquea). EXECUTE solo service_role.';

-- ═══ 13. Ownership + grants de funciones ════════════════════════════════════

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.fn_user_roles_validar_org()',
    'public.fn_lote_evaluar_elegibilidad()',
    'public.fn_lote_alertas_fuente()',
    'public.fn_lote_evento_encadenar()',
    'public.fn_append_only()',
    'public.fn_consentimiento_solo_revocar()',
    'public.fn_touch_updated_at()',
    'public.jsonb_canonico(jsonb)',
    'public.sha256_hex(text)',
    'public.canonico_evento(uuid, integer, text, uuid, timestamptz, text, numeric, numeric, text, text)',
    'public.verificar_cadena_lote(uuid)',
    'public.registrar_pago_lote(uuid, text, text, numeric, text, date, uuid)',
    'public.conciliar_lote(uuid, uuid)',
    'public.fuente_bloqueos(uuid)',
    'public.current_rol()',
    'public.current_org()',
    'public.planta_tiene_consentimiento(uuid, text)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', f);
  end loop;
end $$;

-- Solo la API (service_role) decide quién paga y quién concilia.
grant execute on function public.registrar_pago_lote(uuid, text, text, numeric, text, date, uuid) to service_role;
grant execute on function public.conciliar_lote(uuid, uuid) to service_role;
-- Lectura/verificación para cualquier sesión autenticada (RLS aplica adentro).
grant execute on function public.verificar_cadena_lote(uuid) to authenticated, service_role;
grant execute on function public.planta_tiene_consentimiento(uuid, text) to authenticated, service_role;
grant execute on function public.current_rol() to authenticated, service_role;
grant execute on function public.current_org() to authenticated, service_role;
grant execute on function public.fuente_bloqueos(uuid) to authenticated, service_role;
grant execute on function public.jsonb_canonico(jsonb) to authenticated, service_role;
grant execute on function public.sha256_hex(text) to authenticated, service_role;
grant execute on function public.canonico_evento(uuid, integer, text, uuid, timestamptz, text, numeric, numeric, text, text) to authenticated, service_role;

-- ═══ 14. RLS ════════════════════════════════════════════════════════════════
-- anon: nada. authenticated: grants acotados + policies por rol. service_role:
-- FOR ALL (sin BYPASSRLS en este proyecto). DELETE revocado en todas las
-- tablas de evidencia; UPDATE revocado donde el trigger ya lo impide.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'organizaciones', 'fuentes_comercializador', 'lotes', 'lote_eventos',
    'pagos_lote', 'consentimientos', 'alertas_lote', 'bitacora_accesos',
    'margenes_comercializador'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', tbl);
    execute format('grant all on table public.%I to service_role', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_service_all', tbl);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      tbl || '_service_all', tbl);
  end loop;
end $$;

-- Grants por tabla (la RLS filtra encima).
grant select, insert, update          on public.organizaciones           to authenticated;
grant select, insert, update          on public.fuentes_comercializador  to authenticated;
grant select, insert, update          on public.lotes                    to authenticated;
grant select, insert                  on public.lote_eventos             to authenticated;
grant select                          on public.pagos_lote               to authenticated;
grant select, insert, update          on public.consentimientos          to authenticated;
grant select, insert, update          on public.alertas_lote             to authenticated;
grant select, insert                  on public.bitacora_accesos         to authenticated;
grant select, insert, update          on public.margenes_comercializador to authenticated;

-- Indelebilidad a nivel de privilegio (prevalece sobre cualquier policy).
revoke delete, truncate on public.organizaciones, public.fuentes_comercializador, public.lotes,
  public.lote_eventos, public.pagos_lote, public.consentimientos, public.alertas_lote,
  public.bitacora_accesos, public.margenes_comercializador
  from anon, authenticated, service_role;
revoke update on public.lote_eventos, public.bitacora_accesos from anon, authenticated, service_role;
revoke insert, update on public.pagos_lote from anon, authenticated;   -- solo via registrar_pago_lote()

-- 14.a organizaciones
drop policy if exists organizaciones_staff_all on public.organizaciones;
create policy organizaciones_staff_all on public.organizaciones
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
drop policy if exists organizaciones_propia_read on public.organizaciones;
create policy organizaciones_propia_read on public.organizaciones
  for select to authenticated
  using (id = (select public.current_org()) or (select public.current_rol()) = 'auditor');

-- 14.b fuentes_comercializador
drop policy if exists fuentes_staff_all on public.fuentes_comercializador;
create policy fuentes_staff_all on public.fuentes_comercializador
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
drop policy if exists fuentes_comercializador_org on public.fuentes_comercializador;
create policy fuentes_comercializador_org on public.fuentes_comercializador
  for all to authenticated
  using ((select public.current_rol()) = 'comercializador'
         and organizacion_id = (select public.current_org()))
  with check ((select public.current_rol()) = 'comercializador'
         and organizacion_id = (select public.current_org()));
drop policy if exists fuentes_auditor_read on public.fuentes_comercializador;
create policy fuentes_auditor_read on public.fuentes_comercializador
  for select to authenticated
  using ((select public.current_rol()) = 'auditor');

-- 14.c lotes
drop policy if exists lotes_staff_all on public.lotes;
create policy lotes_staff_all on public.lotes
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
drop policy if exists lotes_comercializador_org on public.lotes;
create policy lotes_comercializador_org on public.lotes
  for all to authenticated
  using ((select public.current_rol()) = 'comercializador'
         and comercializador_org_id = (select public.current_org()))
  with check ((select public.current_rol()) = 'comercializador'
         and comercializador_org_id = (select public.current_org()));
drop policy if exists lotes_planta_read on public.lotes;
create policy lotes_planta_read on public.lotes
  for select to authenticated
  using ((select public.current_rol()) = 'planta'
         and planta_org_id = (select public.current_org()));
drop policy if exists lotes_cliente_read_own on public.lotes;
create policy lotes_cliente_read_own on public.lotes
  for select to authenticated
  using (exists (select 1 from public.clientes c
                  where c.id = lotes.cliente_id and c.user_id = auth.uid()));
drop policy if exists lotes_auditor_read on public.lotes;
create policy lotes_auditor_read on public.lotes
  for select to authenticated
  using ((select public.current_rol()) = 'auditor');

-- 14.d lote_eventos (select por visibilidad del lote; insert staff/comercializador/planta)
drop policy if exists lote_eventos_staff_all on public.lote_eventos;
create policy lote_eventos_staff_all on public.lote_eventos
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
drop policy if exists lote_eventos_comercializador_org on public.lote_eventos;
create policy lote_eventos_comercializador_org on public.lote_eventos
  for all to authenticated
  using ((select public.current_rol()) = 'comercializador'
         and exists (select 1 from public.lotes l
                      where l.id = lote_eventos.lote_id
                        and l.comercializador_org_id = (select public.current_org())))
  with check ((select public.current_rol()) = 'comercializador'
         and exists (select 1 from public.lotes l
                      where l.id = lote_eventos.lote_id
                        and l.comercializador_org_id = (select public.current_org())));
drop policy if exists lote_eventos_planta_lotes on public.lote_eventos;
create policy lote_eventos_planta_lotes on public.lote_eventos
  for all to authenticated
  using ((select public.current_rol()) = 'planta'
         and exists (select 1 from public.lotes l
                      where l.id = lote_eventos.lote_id
                        and l.planta_org_id = (select public.current_org())))
  with check ((select public.current_rol()) = 'planta'
         and exists (select 1 from public.lotes l
                      where l.id = lote_eventos.lote_id
                        and l.planta_org_id = (select public.current_org())));
drop policy if exists lote_eventos_cliente_read_own on public.lote_eventos;
create policy lote_eventos_cliente_read_own on public.lote_eventos
  for select to authenticated
  using (exists (select 1 from public.lotes l
                   join public.clientes c on c.id = l.cliente_id
                  where l.id = lote_eventos.lote_id and c.user_id = auth.uid()));
drop policy if exists lote_eventos_auditor_read on public.lote_eventos;
create policy lote_eventos_auditor_read on public.lote_eventos
  for select to authenticated
  using ((select public.current_rol()) = 'auditor');

-- 14.e pagos_lote (SELECT; el INSERT es solo vía RPC/service_role)
drop policy if exists pagos_lote_staff_read on public.pagos_lote;
create policy pagos_lote_staff_read on public.pagos_lote
  for select to authenticated
  using (public.is_internal_staff());
drop policy if exists pagos_lote_comercializador_org on public.pagos_lote;
create policy pagos_lote_comercializador_org on public.pagos_lote
  for select to authenticated
  using ((select public.current_rol()) = 'comercializador'
         and pagado_por_org_id = (select public.current_org()));
drop policy if exists pagos_lote_cliente_read_own on public.pagos_lote;
create policy pagos_lote_cliente_read_own on public.pagos_lote
  for select to authenticated
  using (exists (select 1 from public.clientes c
                  where c.id = pagos_lote.beneficiario_cliente_id and c.user_id = auth.uid()));
-- Auditor: select completo (incluido monto). [DECISIÓN PENDIENTE — WILLIS:
-- si el auditor debe ver el monto o solo la existencia/medio/referencia.]
drop policy if exists pagos_lote_auditor_read on public.pagos_lote;
create policy pagos_lote_auditor_read on public.pagos_lote
  for select to authenticated
  using ((select public.current_rol()) = 'auditor');
-- planta: NINGUNA policy → 0 filas, siempre.

-- 14.f consentimientos
drop policy if exists consentimientos_staff_all on public.consentimientos;
create policy consentimientos_staff_all on public.consentimientos
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
drop policy if exists consentimientos_cliente_read_own on public.consentimientos;
create policy consentimientos_cliente_read_own on public.consentimientos
  for select to authenticated
  using (exists (select 1 from public.clientes c
                  where c.id = consentimientos.cliente_id and c.user_id = auth.uid()));
-- La planta ve los consentimientos otorgados a SU organización (sabe qué puede ver).
drop policy if exists consentimientos_planta_read_propios on public.consentimientos;
create policy consentimientos_planta_read_propios on public.consentimientos
  for select to authenticated
  using ((select public.current_rol()) = 'planta'
         and otorgado_a_org_id = (select public.current_org()));
drop policy if exists consentimientos_auditor_read on public.consentimientos;
create policy consentimientos_auditor_read on public.consentimientos
  for select to authenticated
  using ((select public.current_rol()) = 'auditor');

-- 14.g alertas_lote
drop policy if exists alertas_lote_staff_all on public.alertas_lote;
create policy alertas_lote_staff_all on public.alertas_lote
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
drop policy if exists alertas_lote_comercializador_org on public.alertas_lote;
create policy alertas_lote_comercializador_org on public.alertas_lote
  for select to authenticated
  using ((select public.current_rol()) = 'comercializador'
         and exists (select 1 from public.lotes l
                      where l.id = alertas_lote.lote_id
                        and l.comercializador_org_id = (select public.current_org())));
drop policy if exists alertas_lote_comercializador_insert on public.alertas_lote;
create policy alertas_lote_comercializador_insert on public.alertas_lote
  for insert to authenticated
  with check ((select public.current_rol()) = 'comercializador'
         and exists (select 1 from public.lotes l
                      where l.id = alertas_lote.lote_id
                        and l.comercializador_org_id = (select public.current_org())));
drop policy if exists alertas_lote_planta_read on public.alertas_lote;
create policy alertas_lote_planta_read on public.alertas_lote
  for select to authenticated
  using ((select public.current_rol()) = 'planta'
         and exists (select 1 from public.lotes l
                      where l.id = alertas_lote.lote_id
                        and l.planta_org_id = (select public.current_org())));
drop policy if exists alertas_lote_auditor_read on public.alertas_lote;
create policy alertas_lote_auditor_read on public.alertas_lote
  for select to authenticated
  using ((select public.current_rol()) = 'auditor');

-- 14.h bitacora_accesos
drop policy if exists bitacora_admin_auditor_read on public.bitacora_accesos;
create policy bitacora_admin_auditor_read on public.bitacora_accesos
  for select to authenticated
  using ((select public.current_rol()) in ('admin', 'auditor'));
drop policy if exists bitacora_self_insert on public.bitacora_accesos;
create policy bitacora_self_insert on public.bitacora_accesos
  for insert to authenticated
  with check (user_id = auth.uid());

-- 14.i margenes_comercializador — SOLO el comercializador de la misma org.
drop policy if exists margenes_comercializador_org on public.margenes_comercializador;
create policy margenes_comercializador_org on public.margenes_comercializador
  for all to authenticated
  using ((select public.current_rol()) = 'comercializador'
         and organizacion_id = (select public.current_org()))
  with check ((select public.current_rol()) = 'comercializador'
         and organizacion_id = (select public.current_org()));

-- ═══ 15. Planta → expedientes / documentos / clientes con consentimiento ════
-- Policies SELECT adicionales a las de 041 (staff + cliente). Se crean solo si
-- las tablas/columnas existen (expedientes.cliente_id de 011; documentos.
-- expediente_id de 004/039; clientes.id). Sin consentimiento vigente: 0 filas.

do $$
begin
  if to_regclass('public.expedientes') is not null
     and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'expedientes' and column_name = 'cliente_id') then
    alter table public.expedientes enable row level security;
    grant select on public.expedientes to authenticated;
    drop policy if exists expedientes_planta_consentimiento_read on public.expedientes;
    create policy expedientes_planta_consentimiento_read on public.expedientes
      for select to authenticated
      using (expedientes.cliente_id is not null
             and public.planta_tiene_consentimiento(expedientes.cliente_id, 'expediente'));
  else
    raise notice '043: expedientes.cliente_id no existe — policy de planta omitida';
  end if;

  if to_regclass('public.documentos') is not null
     and to_regclass('public.expedientes') is not null
     and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'documentos' and column_name = 'expediente_id')
     and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'expedientes' and column_name = 'cliente_id') then
    alter table public.documentos enable row level security;
    grant select on public.documentos to authenticated;
    drop policy if exists documentos_planta_consentimiento_read on public.documentos;
    create policy documentos_planta_consentimiento_read on public.documentos
      for select to authenticated
      using (exists (select 1 from public.expedientes e
                      where e.id = documentos.expediente_id
                        and e.cliente_id is not null
                        and public.planta_tiene_consentimiento(e.cliente_id, 'documentos')));
  else
    raise notice '043: documentos.expediente_id / expedientes.cliente_id no existen — policy de planta omitida';
  end if;

  -- clientes: la ficha del minero (sin la cual el expediente no se interpreta)
  -- bajo el alcance "expediente".
  alter table public.clientes enable row level security;
  grant select on public.clientes to authenticated;
  drop policy if exists clientes_planta_consentimiento_read on public.clientes;
  create policy clientes_planta_consentimiento_read on public.clientes
    for select to authenticated
    using (public.planta_tiene_consentimiento(clientes.id, 'expediente'));
end $$;

-- ═══ 16. Verificación post-aplicación (ejecutar a mano en Studio) ═══════════
--   select public.sha256_hex(public.canonico_evento(
--     '11111111-1111-4111-8111-111111111111', 1, 'origen_mina', null,
--     '2026-11-12T14:05:06.007Z', 'Iriona', 1250.5, 0.9165, '{"a":1,"b":"x"}', 'GENESIS'));
--   -- debe dar a2e60d8d5871069087b5bda166e719a73303777c81a04436633e1938944f09b8
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' and tablename in ('lotes','lote_eventos','pagos_lote','margenes_comercializador');
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'lote_eventos' and grantee in ('anon','authenticated','service_role');
--   -- anon: 0 filas; authenticated: SELECT, INSERT; service_role: SELECT, INSERT (sin UPDATE/DELETE)
