-- 042_certificados_documento_oficial_y_sello.sql
-- Certificado de Origen: separación entre el DOCUMENTO OFICIAL y el SELLO
-- complementario MAPE.LEGAL (brief 10-nov-2026, §2.4).
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no ejecuta SQL.      ║
-- ║ La aplica un humano en Supabase Studio → SQL Editor, DESPUÉS de la       ║
-- ║ aprobación expresa de Willis y de un respaldo (el proyecto no tiene      ║
-- ║ backups automáticos — ver docs/plan2-runbook-produccion.md).             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Marco legal (texto canónico en lib/content/copy-legal.ts, CERTIFICADO_ORIGEN_NOTA):
--   El Certificado de Origen / Certificación de Procedencia oficial lo EMITE el
--   TITULAR del derecho minero y lo AUTENTICA la Autoridad Minera o Municipal
--   (Art. 35 Regl. Especial MAPE, Acuerdo 088-B-2018; art. 43.e Regl. 042-2013).
--   La plataforma MAPE.LEGAL (dueña: Inversiones Zekaii, S. de R.L.) NO es
--   autoridad emisora: REGISTRA y DIGITALIZA el documento oficial y lleva un
--   SELLO o registro complementario (voluntario) con número de registro, folio
--   de talonario pre-numerado, QR que enlaza el papel con el asiento digital y
--   huella SHA-256 del ejemplar digital. /verificar consulta SOLO el sello.
--
-- Problema que corrige en el esquema de la 020:
--   * `emitido_por uuid references auth.users(id)` sugería que un usuario de la
--     plataforma "emite" el certificado. Se conserva por compatibilidad como
--     columna LEGACY y se agrega `registrado_por` (quien asentó el registro).
--   * No existía ninguna columna para el documento oficial (titular emisor,
--     autoridad que autentica, número del documento, escaneo) ni para el sello
--     (folio, QR, ejemplar) ni para la copia entregada al minero.
--
-- Diseño:
--   1. Bloque DOCUMENTO OFICIAL — datos del papel que emite el titular y
--      autentica la autoridad. `emisor_titular` es TEXTO (nombre del titular),
--      nunca una referencia a auth.users: el titular no es usuario de la
--      plataforma. Es dato personal → NO se expone en la vista pública.
--   2. Bloque SELLO COMPLEMENTARIO — `numero_sello` se BACKFILLEA desde
--      `numero_certificado` (decisión: hoy son la misma serie; /verificar/[numero]
--      resuelve por numero_certificado y el QR apunta ahí. Se mantiene columna
--      propia para que una futura renumeración del talonario no rompa la clave
--      histórica; unicidad parcial sobre no-NULL). `hash_sha256` (036) queda
--      re-documentada como huella del archivo digital del EJEMPLAR CON SELLO.
--   3. Bloque COPIA AL MINERO — estado + fecha + ruta de la constancia firmada.
--   4. `registrado_por` + backfill desde `emitido_por`; comentario LEGACY.
--   5. Indelebilidad: `revoke delete, truncate` (la 020 no lo hacía — su policy
--      FOR ALL a authenticated permitía DELETE a admin/abogado) + trigger
--      BEFORE UPDATE que rechaza cambios a los dos hashes una vez escritos.
--   6. Policy explícita FOR ALL TO service_role (el service_role de este proyecto
--      NO tiene BYPASSRLS — saga 019/024/025; sin ella las rutas de dashboard que
--      usan getAdminClient() verían 0 filas). El revoke de DELETE prevalece
--      sobre la policy: service_role tampoco puede borrar.
--   7. Vista pública: se agregan AL FINAL `numero_sello` y `copia_minero_estado`
--      (CREATE OR REPLACE VIEW no puede quitar ni reordenar columnas — gotcha
--      documentado en CLAUDE.md). NO se exponen: nombre del titular, rutas de
--      Storage, montos, notas, autoridad (texto libre), folio del talonario.
--
-- Rutas de Storage: en este PR se registran como TEXTO (ruta relativa dentro de
-- un bucket privado por definir). La subida de archivos NO existe aún —
-- ver docs/certificado-oficial-y-sello.md §Pendientes.
--
-- Idempotente: re-ejecutable sin efectos secundarios (add column if not exists,
-- drop policy/trigger if exists, constraints gateadas por pg_constraint,
-- backfills solo-NULL).

-- ---------------------------------------------------------------------------
-- 1. DOCUMENTO OFICIAL (lo emite el titular, lo autentica la autoridad)
-- ---------------------------------------------------------------------------
alter table public.certificados_origen
  add column if not exists emisor_titular                        text null,
  add column if not exists emisor_titular_tipo                   text null,
  add column if not exists autoridad_autentica                   text null,
  add column if not exists autoridad_autentica_fecha             date null,
  add column if not exists numero_documento_oficial              text null,
  add column if not exists escaneo_documento_oficial_path        text null,
  add column if not exists escaneo_documento_oficial_hash_sha256 text null;

comment on column public.certificados_origen.emisor_titular is
  'Nombre del TITULAR del derecho minero que emite y firma el Certificado de Origen oficial (Art. 35 Regl. Especial MAPE). Texto, NO referencia a auth.users: el titular no es usuario de la plataforma. Dato personal — nunca se expone en la vista pública.';
comment on column public.certificados_origen.emisor_titular_tipo is
  'Naturaleza del titular emisor: natural | juridica | grupo_organizado (Art. 5 Regl. Especial MAPE).';
comment on column public.certificados_origen.autoridad_autentica is
  'Autoridad Minera o Municipal que AUTENTICA el documento oficial (p. ej. "INHGEOMIN — Oficina Regional …", "Alcaldía Municipal de …"). Texto libre; no se expone en la vista pública.';
comment on column public.certificados_origen.autoridad_autentica_fecha is
  'Fecha de la autenticación por la autoridad (distinta de fecha_emision, que es la fecha en que el titular emite).';
comment on column public.certificados_origen.numero_documento_oficial is
  'Número/identificador que figura en el documento oficial emitido por el titular (no es el número de sello MAPE.LEGAL).';
comment on column public.certificados_origen.escaneo_documento_oficial_path is
  'Ruta en Storage del escaneo del documento oficial (bucket privado; subida pendiente de implementar — se registra como texto). Nunca pública.';
comment on column public.certificados_origen.escaneo_documento_oficial_hash_sha256 is
  'SHA-256 (hex, 64 chars) del escaneo del documento oficial. Indeleble: el trigger trg_certificados_hash_inmutable rechaza cambios una vez escrito.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'certificados_origen_emisor_titular_tipo_chk'
      and conrelid = 'public.certificados_origen'::regclass
  ) then
    alter table public.certificados_origen
      add constraint certificados_origen_emisor_titular_tipo_chk
      check (emisor_titular_tipo is null
             or emisor_titular_tipo in ('natural', 'juridica', 'grupo_organizado'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'certificados_origen_escaneo_oficial_hash_chk'
      and conrelid = 'public.certificados_origen'::regclass
  ) then
    alter table public.certificados_origen
      add constraint certificados_origen_escaneo_oficial_hash_chk
      check (escaneo_documento_oficial_hash_sha256 is null
             or escaneo_documento_oficial_hash_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. SELLO COMPLEMENTARIO MAPE.LEGAL (folio, QR, ejemplar, hash)
-- ---------------------------------------------------------------------------
alter table public.certificados_origen
  add column if not exists numero_sello                text null,
  add column if not exists folio_talonario             text null,
  add column if not exists qr_url                      text null,
  add column if not exists ejemplar_sello_escaneo_path text null;

-- Backfill: hoy numero_sello = numero_certificado (misma serie). Solo-NULL.
update public.certificados_origen
   set numero_sello = numero_certificado
 where numero_sello is null;

create unique index if not exists uq_certificados_numero_sello
  on public.certificados_origen (numero_sello)
  where numero_sello is not null;

create unique index if not exists uq_certificados_folio_talonario
  on public.certificados_origen (folio_talonario)
  where folio_talonario is not null;

comment on column public.certificados_origen.numero_sello is
  'Número de registro del SELLO complementario MAPE.LEGAL (voluntario, no sustituye el documento oficial). Backfilleado desde numero_certificado (misma serie); columna propia para permitir renumeración futura del talonario sin romper la clave histórica. Único (parcial sobre no-NULL). Se expone en la vista pública.';
comment on column public.certificados_origen.folio_talonario is
  'Folio del talonario pre-numerado (ejemplar físico del sello). Único (parcial). Interno — no se expone en la vista pública.';
comment on column public.certificados_origen.qr_url is
  'URL codificada en el QR impreso en el ejemplar con sello: <NEXT_PUBLIC_SITE_URL>/verificar/<numero>. Enlaza el papel con el asiento digital. Se calcula en el servidor (lib/certificados/sello.ts:buildQrUrl); la imagen QR no se genera todavía.';
comment on column public.certificados_origen.ejemplar_sello_escaneo_path is
  'Ruta en Storage del escaneo del ejemplar CON sello MAPE.LEGAL (el archivo cuyo SHA-256 es hash_sha256). Subida pendiente — se registra como texto. Nunca pública.';
comment on column public.certificados_origen.hash_sha256 is
  'SHA-256 (hex, 64 chars) del archivo digital del EJEMPLAR CON SELLO MAPE.LEGAL (ejemplar_sello_escaneo_path). Distinto de hash_verificacion (020, hash del cuerpo canónico del registro) y de escaneo_documento_oficial_hash_sha256 (documento oficial). Indeleble: el trigger trg_certificados_hash_inmutable rechaza cambios una vez escrito. Cálculo: lib/certificados/hash.ts:sha256Hex.';

-- Formato hex sobre hash_sha256 (036). NOT VALID: no falla si existieran
-- filas legacy con otro formato; se exige en toda escritura nueva.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'certificados_origen_hash_sha256_chk'
      and conrelid = 'public.certificados_origen'::regclass
  ) then
    alter table public.certificados_origen
      add constraint certificados_origen_hash_sha256_chk
      check (hash_sha256 is null or hash_sha256 ~ '^[0-9a-f]{64}$') not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. COPIA AL MINERO
-- ---------------------------------------------------------------------------
alter table public.certificados_origen
  add column if not exists copia_minero_estado          text not null default 'pendiente',
  add column if not exists copia_minero_fecha           date null,
  add column if not exists copia_minero_constancia_path text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'certificados_origen_copia_minero_estado_chk'
      and conrelid = 'public.certificados_origen'::regclass
  ) then
    alter table public.certificados_origen
      add constraint certificados_origen_copia_minero_estado_chk
      check (copia_minero_estado in ('pendiente', 'entregada', 'constancia_firmada'));
  end if;
end $$;

comment on column public.certificados_origen.copia_minero_estado is
  'Entrega de la copia del ejemplar con sello al minero: pendiente | entregada | constancia_firmada. Se expone en la vista pública (sin fecha ni constancia).';
comment on column public.certificados_origen.copia_minero_fecha is
  'Fecha de entrega de la copia al minero.';
comment on column public.certificados_origen.copia_minero_constancia_path is
  'Ruta en Storage de la constancia de entrega firmada por el minero. Subida pendiente — se registra como texto. Nunca pública.';

-- ---------------------------------------------------------------------------
-- 4. QUIÉN REGISTRÓ EN LA PLATAFORMA — emitido_por pasa a LEGACY
-- ---------------------------------------------------------------------------
alter table public.certificados_origen
  add column if not exists registrado_por uuid null references auth.users(id);

update public.certificados_origen
   set registrado_por = emitido_por
 where registrado_por is null
   and emitido_por is not null;

create index if not exists idx_certificados_registrado_por
  on public.certificados_origen (registrado_por);

comment on column public.certificados_origen.emitido_por is
  'LEGACY (020). La plataforma MAPE.LEGAL NO emite el Certificado de Origen oficial: lo emite el titular del derecho minero (emisor_titular) y lo autentica la Autoridad Minera o Municipal (autoridad_autentica). Se conserva por compatibilidad; el flujo nuevo escribe registrado_por. No volver a poblar.';
comment on column public.certificados_origen.registrado_por is
  'Usuario de la plataforma (auth.users) que REGISTRÓ y digitalizó el documento oficial y asentó el sello complementario. No es el emisor del documento. Estampado por el servidor desde la sesión validada (requireRole).';

-- ---------------------------------------------------------------------------
-- 5. INDELEBILIDAD — sin DELETE/TRUNCATE; hashes inmutables una vez escritos
-- ---------------------------------------------------------------------------
-- La 020 no revocaba DELETE y su policy FOR ALL a authenticated lo permitía
-- a admin/abogado. Los registros de certificados son evidencia: no se borran;
-- el retiro es estado = 'revocado' | 'expirado' | 'suspendido'.
revoke delete, truncate on table public.certificados_origen from anon, authenticated, service_role;

create or replace function public.fn_certificados_hash_inmutable()
returns trigger
language plpgsql
as $$
begin
  if old.hash_sha256 is not null
     and new.hash_sha256 is distinct from old.hash_sha256 then
    raise exception 'hash_sha256 es indeleble: no se puede modificar una vez escrito (certificado %)', old.numero_certificado
      using errcode = '23514', hint = 'Corrija registrando un nuevo ejemplar; nunca sobrescriba la huella.';
  end if;

  if old.escaneo_documento_oficial_hash_sha256 is not null
     and new.escaneo_documento_oficial_hash_sha256 is distinct from old.escaneo_documento_oficial_hash_sha256 then
    raise exception 'escaneo_documento_oficial_hash_sha256 es indeleble: no se puede modificar una vez escrito (certificado %)', old.numero_certificado
      using errcode = '23514', hint = 'Corrija registrando un nuevo escaneo; nunca sobrescriba la huella.';
  end if;

  return new;
end;
$$;

comment on function public.fn_certificados_hash_inmutable() is
  'BEFORE UPDATE en certificados_origen: rechaza (SQLSTATE 23514) cualquier cambio a hash_sha256 o escaneo_documento_oficial_hash_sha256 cuando el valor previo no es NULL. Permite el primer llenado (NULL → valor).';

drop trigger if exists trg_certificados_hash_inmutable on public.certificados_origen;
create trigger trg_certificados_hash_inmutable
  before update on public.certificados_origen
  for each row execute function public.fn_certificados_hash_inmutable();

-- ---------------------------------------------------------------------------
-- 6. RLS — policy explícita para service_role (sin BYPASSRLS en este proyecto)
-- ---------------------------------------------------------------------------
-- Las policies de la 020 (lectura staff / escritura admin|abogado) se conservan.
-- FOR ALL incluye DELETE a nivel de policy, pero el REVOKE de arriba lo niega a
-- nivel de privilegio — el resultado neto es SELECT/INSERT/UPDATE.
alter table public.certificados_origen enable row level security;

drop policy if exists "service_role_all_certificados" on public.certificados_origen;
create policy "service_role_all_certificados"
  on public.certificados_origen
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update on public.certificados_origen to service_role;

-- ---------------------------------------------------------------------------
-- 7. VISTA PÚBLICA — agrega AL FINAL numero_sello y copia_minero_estado
-- ---------------------------------------------------------------------------
-- Orden de columnas 020 + 036 preservado. NO se exponen: emisor_titular
-- (dato personal del titular), autoridad_autentica, numero_documento_oficial,
-- folio_talonario, ninguna ruta *_path, montos, notas, registrado_por.
create or replace view public.certificados_origen_publicos as
select
  c.numero_certificado,
  c.fecha_emision,
  c.peso_oro_g,
  c.estado,
  c.valido_hasta,
  c.hash_verificacion,
  m.nombre        as mina_nombre,
  m.codigo        as mina_codigo,
  m.municipio     as mina_municipio,
  m.departamento  as mina_departamento,
  c.hash_sha256,
  c.id            as certificado_id,
  c.numero_sello,
  c.copia_minero_estado
from public.certificados_origen c
left join public.minas m on m.id = c.mina_id;

comment on view public.certificados_origen_publicos is
  'Superficie pública de /verificar. Expone SOLO datos del sello complementario MAPE.LEGAL y de la mina (no PII). numero_sello y copia_minero_estado agregados por la 042. El nombre del titular emisor (emisor_titular) es dato personal y NO se expone; /verificar consulta el sello, no valida el documento oficial.';

grant select on public.certificados_origen_publicos to anon, authenticated;
