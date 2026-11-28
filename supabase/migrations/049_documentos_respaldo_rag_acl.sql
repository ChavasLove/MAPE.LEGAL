-- 049_documentos_respaldo_rag_acl.sql
-- NO APLICAR. Escrita en el PR de la reestructura de recepción, acceso y cadena
-- de custodia (28-nov-2026, apilado sobre el #245); la aplica Willis tras revisión.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, con RESPALDO previo ║
-- ║ y aprobación expresa de Willis. Orden: … → 048 → 049.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- TEMA: respaldo digital de documentos e índice de consulta con control de
-- acceso POR FRAGMENTO.
--   1. `documentos_respaldo`: referencia al archivo respaldado (identificador
--      del archivo en el almacén externo, NUNCA su contenido), huella SHA-256,
--      nivel de acceso, versión y vigencia. Los archivos no son públicos: el
--      enlace se sirve por la API con control de acceso y bitácora de lectura.
--   2. `documentos_fragmentos`: índice de texto de documentos de expedientes.
--      Cada fragmento lleva su ACL (documento, expediente, organización,
--      titular, nivel de acceso, vigencia).
--   3. `buscar_fragmentos_acl()`: el FILTRO DE ACCESO SE APLICA DENTRO DE LA
--      BÚSQUEDA, antes de recuperar. Nunca después de generar una respuesta.
--   4. `retirar_documento_del_indice()`: un documento revocado u obsoleto sale
--      del índice.
--
-- DECISIÓN DE DISEÑO (declarada en el PR): el encargo pedía extender la tabla
-- del RAG existente (`maria_knowledge`, 024) con metadatos de ACL. Esa tabla es
-- de lectura pública (`using (true)` para anon) y sus dos funciones de búsqueda
-- están concedidas a anon y devuelven cualquier fila. Meter ahí fragmentos de
-- expedientes obligaría a reescribir en producción funciones que hoy usa María
-- y que aquí no se pueden probar (no hay pgvector local). Por eso los
-- fragmentos de expedientes van en una tabla APARTE, sin ningún acceso directo,
-- con la misma ACL por fragmento que se pedía. `maria_knowledge` (conocimiento
-- general: leyes y manual) NO se toca.
--
-- EMBEDDINGS: la columna `embedding vector(1536)` y su índice se crean solo si
-- la extensión `vector` está instalada (lo está en Supabase desde la 024). La
-- búsqueda de esta migración es por texto (FTS en español); la búsqueda
-- semántica con el mismo filtro queda "en implementación".
--
-- DEPENDENCIAS: 047 (recepciones, puntos_recepcion — alcance por punto), 046
-- (cliente_del_usuario), 045 (es_personal, bitacora_acciones), 043
-- (organizaciones, fn_append_only, current_rol, current_org), 004/039
-- (documentos, expedientes).
--
-- SIN CREDENCIALES: aquí no hay claves, tokens ni identificadores de carpeta.
-- La integración con el almacén externo lee SOLO nombres de variables de
-- entorno desde el código (lib/documentos/respaldo.ts).
--
-- Idempotente.
--
-- PLAN DE REVERSA (documentado; NO ejecutar sin decisión de Willis):
--   drop function if exists public.buscar_fragmentos_acl(text, uuid, integer);
--   drop function if exists public.retirar_documento_del_indice(uuid, uuid, text);
--   -- documentos_fragmentos es un índice DERIVADO: se puede vaciar y regenerar.
--   -- documentos_respaldo es el registro de respaldos: se conserva.

-- ═══ 0. Precondiciones ══════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.es_personal()') is null or to_regprocedure('public.cliente_del_usuario()') is null then
    raise exception '049: faltan la 045 / 046 (es_personal / cliente_del_usuario)';
  end if;
  if to_regclass('public.recepciones') is null then
    raise exception '049: falta la 047 (recepciones) para el alcance por punto';
  end if;
  if to_regclass('public.documentos') is null or to_regclass('public.expedientes') is null then
    raise exception '049: faltan public.documentos / public.expedientes';
  end if;
end $$;

-- ═══ 1. documentos_respaldo ═════════════════════════════════════════════════

create table if not exists public.documentos_respaldo (
  id                  uuid primary key default gen_random_uuid(),
  documento_id        uuid not null references public.documentos(id) on delete restrict,
  expediente_id       uuid not null references public.expedientes(id) on delete restrict,
  mina_id             uuid null,
  titular_cliente_id  uuid null references public.clientes(id) on delete restrict,
  organizacion_id     uuid null references public.organizaciones(id) on delete restrict,
  almacen             text not null,
  referencia_externa  text not null,
  sha256              text not null,
  tamano_bytes        bigint null,
  nivel_acceso        text not null,
  version             integer not null default 1,
  vigente             boolean not null default true,
  subido_por          uuid not null,
  revocado_por        uuid null,
  revocado_en         timestamptz null,
  revocacion_motivo   text null,
  created_at          timestamptz not null default now(),
  constraint documentos_respaldo_almacen_check check (almacen in ('google_drive', 'memoria')),
  constraint documentos_respaldo_sha_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint documentos_respaldo_nivel_check check (nivel_acceso in ('personal', 'titular', 'organizacion')),
  constraint documentos_respaldo_version_check check (version >= 1),
  constraint documentos_respaldo_org_check check (nivel_acceso <> 'organizacion' or organizacion_id is not null),
  constraint documentos_respaldo_revocado_check check (vigente or (revocado_por is not null and revocado_en is not null)),
  constraint documentos_respaldo_version_key unique (documento_id, version)
);

create index if not exists idx_documentos_respaldo_expediente on public.documentos_respaldo (expediente_id);
create index if not exists idx_documentos_respaldo_documento on public.documentos_respaldo (documento_id, version desc);

comment on table public.documentos_respaldo is
  'Respaldo digital de un documento del expediente: REFERENCIA al archivo en el almacén externo (nunca el contenido), huella SHA-256, nivel de acceso, versión y vigencia. El archivo no es público; el enlace lo sirve la API con control de acceso y bitácora de lectura. Lo sube el personal: el titular solo ve. Sin DELETE: un respaldo se revoca.';
comment on column public.documentos_respaldo.referencia_externa is
  'Identificador del archivo en el almacén externo (p. ej. el id del archivo). Es una referencia interna: no se expone al titular ni a organizaciones.';
comment on column public.documentos_respaldo.nivel_acceso is
  'personal: solo personal · titular: además, el titular del expediente · organizacion: además, la organización indicada.';

create or replace function public.fn_documento_respaldo_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exp uuid;
  v_cli uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'documentos_respaldo es indeleble: un respaldo se revoca' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select d.expediente_id into v_exp from public.documentos d where d.id = new.documento_id;
    if v_exp is distinct from new.expediente_id then
      raise exception 'documento_de_otro_expediente: el documento no pertenece a ese expediente' using errcode = '23514';
    end if;
    -- El titular se deriva del expediente: no se mezclan expedientes.
    select e.cliente_id into v_cli from public.expedientes e where e.id = new.expediente_id;
    new.titular_cliente_id := v_cli;
    select coalesce(max(r.version), 0) + 1 into new.version
      from public.documentos_respaldo r where r.documento_id = new.documento_id;
    new.vigente := true;
    new.revocado_por := null;
    new.revocado_en := null;
    new.revocacion_motivo := null;
    new.created_at := now();
    return new;
  end if;

  -- UPDATE: el único cambio es la revocación (vigente → no vigente).
  if not (old.vigente and not new.vigente) then
    raise exception 'documentos_respaldo: el único cambio permitido es la revocación' using errcode = '23514';
  end if;
  if new.documento_id <> old.documento_id or new.expediente_id <> old.expediente_id
     or new.referencia_externa <> old.referencia_externa or new.sha256 <> old.sha256
     or new.nivel_acceso <> old.nivel_acceso or new.version <> old.version
     or new.subido_por <> old.subido_por or new.almacen <> old.almacen then
    raise exception 'documentos_respaldo: al revocar solo cambian vigente, revocado_por, revocado_en y el motivo' using errcode = '23514';
  end if;
  new.revocado_en := coalesce(new.revocado_en, now());
  return new;
end;
$$;
alter function public.fn_documento_respaldo_integridad() owner to postgres;
revoke execute on function public.fn_documento_respaldo_integridad() from public, anon, authenticated;

drop trigger if exists documento_respaldo_integridad on public.documentos_respaldo;
create trigger documento_respaldo_integridad
  before insert or update or delete on public.documentos_respaldo
  for each row execute function public.fn_documento_respaldo_integridad();

-- Una versión nueva deja sin vigencia a la anterior (documento obsoleto).
create or replace function public.fn_documento_respaldo_reemplazo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.documentos_respaldo
     set vigente = false, revocado_por = new.subido_por, revocado_en = now(),
         revocacion_motivo = 'reemplazado por la versión ' || new.version
   where documento_id = new.documento_id and id <> new.id and vigente;
  delete from public.documentos_fragmentos f
   where f.documento_id = new.documento_id and f.documento_respaldo_id <> new.id;
  return null;
end;
$$;
alter function public.fn_documento_respaldo_reemplazo() owner to postgres;
revoke execute on function public.fn_documento_respaldo_reemplazo() from public, anon, authenticated;

alter table public.documentos_respaldo enable row level security;
revoke all on table public.documentos_respaldo from public, anon, authenticated, service_role;
grant select, insert, update on table public.documentos_respaldo to service_role;
-- Los usuarios autenticados no leen la referencia externa ni la huella completa
-- por PostgREST: solo las columnas de estado. El enlace lo entrega la API.
grant select (id, documento_id, expediente_id, mina_id, titular_cliente_id, organizacion_id, nivel_acceso, version, vigente, created_at)
  on table public.documentos_respaldo to authenticated;
revoke delete, truncate on table public.documentos_respaldo from anon, authenticated, service_role;

drop policy if exists documentos_respaldo_service_all on public.documentos_respaldo;
create policy documentos_respaldo_service_all on public.documentos_respaldo
  for all to service_role using (true) with check (true);
drop policy if exists documentos_respaldo_personal_read on public.documentos_respaldo;
create policy documentos_respaldo_personal_read on public.documentos_respaldo
  for select to authenticated using (public.es_personal());
drop policy if exists documentos_respaldo_titular_read_own on public.documentos_respaldo;
create policy documentos_respaldo_titular_read_own on public.documentos_respaldo
  for select to authenticated
  using (vigente and nivel_acceso = 'titular'
         and titular_cliente_id is not null
         and titular_cliente_id = (select public.cliente_del_usuario()));
drop policy if exists documentos_respaldo_organizacion_read on public.documentos_respaldo;
create policy documentos_respaldo_organizacion_read on public.documentos_respaldo
  for select to authenticated
  using (vigente and nivel_acceso = 'organizacion'
         and organizacion_id is not null
         and organizacion_id = (select public.current_org()));

-- ═══ 2. documentos_fragmentos (índice con ACL por fragmento) ════════════════

create table if not exists public.documentos_fragmentos (
  id                     bigint generated by default as identity primary key,
  documento_respaldo_id  uuid not null references public.documentos_respaldo(id) on delete restrict,
  documento_id           uuid not null,
  expediente_id          uuid not null,
  organizacion_id        uuid null,
  titular_cliente_id     uuid null,
  nivel_acceso           text not null,
  vigente                boolean not null default true,
  orden                  integer not null,
  titulo                 text not null,
  version                integer not null,
  fecha_documento        date null,
  contenido              text not null,
  busqueda               tsvector generated always as (to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(contenido, ''))) stored,
  created_at             timestamptz not null default now(),
  constraint documentos_fragmentos_nivel_check check (nivel_acceso in ('personal', 'titular', 'organizacion')),
  constraint documentos_fragmentos_orden_key unique (documento_respaldo_id, orden),
  constraint documentos_fragmentos_contenido_check check (length(contenido) between 1 and 8000)
);

create index if not exists idx_documentos_fragmentos_busqueda on public.documentos_fragmentos using gin (busqueda);
create index if not exists idx_documentos_fragmentos_documento on public.documentos_fragmentos (documento_id);
create index if not exists idx_documentos_fragmentos_expediente on public.documentos_fragmentos (expediente_id);

comment on table public.documentos_fragmentos is
  'Índice de texto de documentos de expedientes. Cada fragmento lleva su propia ACL (documento, expediente, organización, titular, nivel de acceso, vigencia) copiada del respaldo. NINGÚN rol autenticado lo lee directamente: solo se consulta con buscar_fragmentos_acl(), que filtra por acceso ANTES de recuperar. El texto llega ya enmascarado (sin números de identidad, cuentas ni teléfonos — lib/documentos/pii.ts). Es un índice derivado: un documento revocado u obsoleto se retira.';

-- La ACL del fragmento se copia SIEMPRE del respaldo: no se puede indexar un
-- fragmento con un nivel de acceso más abierto que el de su documento.
create or replace function public.fn_fragmento_acl()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.documentos_respaldo%rowtype;
begin
  select * into r from public.documentos_respaldo where id = new.documento_respaldo_id;
  if not found then
    raise exception 'respaldo_no_existe' using errcode = '23503';
  end if;
  if not r.vigente then
    raise exception 'documento_no_vigente: no se indexa un documento revocado u obsoleto' using errcode = '23514';
  end if;
  new.documento_id := r.documento_id;
  new.expediente_id := r.expediente_id;
  new.organizacion_id := r.organizacion_id;
  new.titular_cliente_id := r.titular_cliente_id;
  new.nivel_acceso := r.nivel_acceso;
  new.version := r.version;
  new.vigente := true;
  return new;
end;
$$;
alter function public.fn_fragmento_acl() owner to postgres;
revoke execute on function public.fn_fragmento_acl() from public, anon, authenticated;

drop trigger if exists fragmento_acl on public.documentos_fragmentos;
create trigger fragmento_acl
  before insert or update on public.documentos_fragmentos
  for each row execute function public.fn_fragmento_acl();

drop trigger if exists documento_respaldo_reemplazo on public.documentos_respaldo;
create trigger documento_respaldo_reemplazo
  after insert on public.documentos_respaldo
  for each row execute function public.fn_documento_respaldo_reemplazo();

alter table public.documentos_fragmentos enable row level security;
revoke all on table public.documentos_fragmentos from public, anon, authenticated, service_role;
grant select, insert, delete on table public.documentos_fragmentos to service_role;
drop policy if exists documentos_fragmentos_service_all on public.documentos_fragmentos;
create policy documentos_fragmentos_service_all on public.documentos_fragmentos
  for all to service_role using (true) with check (true);
-- Sin grants ni policies para anon/authenticated: no hay lectura directa.

-- Columna de embeddings solo si pgvector está instalado.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    execute 'alter table public.documentos_fragmentos add column if not exists embedding vector(1536)';
  else
    raise notice '049: extensión vector no instalada — columna embedding omitida (búsqueda por texto únicamente)';
  end if;
end $$;

-- ═══ 3. Búsqueda con el filtro de acceso ANTES de recuperar ═════════════════

create or replace function public.puede_leer_fragmento(
  p_rol text, p_org uuid, p_cliente uuid,
  f_nivel text, f_org uuid, f_titular uuid, f_vigente boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Réplica de lib/documentos/acl.ts puedeLeerFragmento().
  select case
    when not coalesce(f_vigente, false) then false
    when p_rol in ('admin', 'abogado', 'tecnico_ambiental', 'verificador') then true
    -- Un punto de recepción solo ve lo de su punto: titulares con recepciones
    -- en los puntos de su organización.
    when p_rol = 'recepcion' then
      p_org is not null and f_titular is not null and exists (
        select 1 from public.recepciones r
          join public.puntos_recepcion pr on pr.id = r.punto_id
         where r.titular_cliente_id = f_titular and pr.organizacion_id = p_org)
    when p_rol = 'cliente' then
      f_nivel = 'titular' and p_cliente is not null and f_titular = p_cliente
    when p_rol in ('comercializador', 'planta', 'auditor') then
      f_nivel = 'organizacion' and p_org is not null and f_org = p_org
    else false
  end;
$$;
alter function public.puede_leer_fragmento(text, uuid, uuid, text, uuid, uuid, boolean) owner to postgres;
revoke execute on function public.puede_leer_fragmento(text, uuid, uuid, text, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.puede_leer_fragmento(text, uuid, uuid, text, uuid, uuid, boolean) to service_role;

create or replace function public.buscar_fragmentos_acl(p_consulta text, p_user uuid, p_limite integer default 5)
returns table (
  fragmento_id bigint, documento_id uuid, expediente_id uuid, titulo text, version integer,
  fecha_documento date, contenido text, relevancia real)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol     text;
  v_org     uuid;
  v_cliente uuid;
  v_limite  integer := least(greatest(coalesce(p_limite, 5), 1), 10);
begin
  if p_user is null or coalesce(trim(p_consulta), '') = '' then
    return;
  end if;
  select ur.rol, ur.organizacion_id into v_rol, v_org
    from public.user_roles ur where ur.user_id = p_user and ur.activo limit 1;
  if v_rol is null then
    return;
  end if;
  select c.id into v_cliente from public.clientes c where c.user_id = p_user limit 1;

  return query
  select f.id, f.documento_id, f.expediente_id, f.titulo, f.version, f.fecha_documento, f.contenido,
         ts_rank(f.busqueda, plainto_tsquery('spanish', p_consulta)) as relevancia
    from public.documentos_fragmentos f
   -- El filtro de acceso va en el WHERE de la búsqueda: lo que el usuario no
   -- puede leer no se recupera ni participa del ordenamiento.
   where public.puede_leer_fragmento(v_rol, v_org, v_cliente, f.nivel_acceso, f.organizacion_id, f.titular_cliente_id, f.vigente)
     and f.busqueda @@ plainto_tsquery('spanish', p_consulta)
   order by relevancia desc, f.id
   limit v_limite;
end;
$$;
alter function public.buscar_fragmentos_acl(text, uuid, integer) owner to postgres;
revoke execute on function public.buscar_fragmentos_acl(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.buscar_fragmentos_acl(text, uuid, integer) to service_role;
comment on function public.buscar_fragmentos_acl(text, uuid, integer) is
  'Búsqueda de fragmentos de documentos de expedientes para el usuario indicado. Aplica la ACL por fragmento DENTRO de la consulta (antes de recuperar): un usuario sin acceso nunca obtiene el fragmento. EXECUTE solo service_role: la API pasa el id del usuario autenticado, nunca uno elegido por el cliente.';

-- ═══ 4. Retiro de un documento del índice ═══════════════════════════════════

create or replace function public.retirar_documento_del_indice(p_respaldo uuid, p_actor uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r        public.documentos_respaldo%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_n      integer;
begin
  select * into r from public.documentos_respaldo where id = p_respaldo for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'respaldo_no_existe');
  end if;
  if length(coalesce(v_motivo, '')) < 5 then
    return jsonb_build_object('ok', false, 'motivo', 'motivo_obligatorio');
  end if;
  delete from public.documentos_fragmentos where documento_respaldo_id = p_respaldo;
  get diagnostics v_n = row_count;
  if r.vigente then
    update public.documentos_respaldo
       set vigente = false, revocado_por = p_actor, revocado_en = now(), revocacion_motivo = v_motivo
     where id = p_respaldo;
  end if;
  insert into public.bitacora_acciones (actor_user_id, actor_rol, accion, recurso_tipo, recurso_id, resumen, detalle)
  select p_actor, (select ur.rol from public.user_roles ur where ur.user_id = p_actor limit 1),
         'documento_revocado', 'documento_respaldo', p_respaldo::text,
         format('Respaldo revocado y retirado del índice (versión %s)', r.version),
         jsonb_build_object('fragmentos_retirados', v_n, 'documento_id', r.documento_id);
  return jsonb_build_object('ok', true, 'fragmentos_retirados', v_n);
end;
$$;
alter function public.retirar_documento_del_indice(uuid, uuid, text) owner to postgres;
revoke execute on function public.retirar_documento_del_indice(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.retirar_documento_del_indice(uuid, uuid, text) to service_role;

-- ═══ 5. Verificación post-aplicación (a mano, en Studio) ════════════════════
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'documentos_fragmentos';   -- solo service_role
--   select column_name from information_schema.column_privileges
--    where table_name = 'documentos_respaldo' and grantee = 'authenticated';  -- sin referencia_externa ni sha256
