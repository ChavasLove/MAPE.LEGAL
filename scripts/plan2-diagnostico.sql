-- plan2-diagnostico.sql — Diagnóstico de existencia previo a la reparación Plan 2
-- ─────────────────────────────────────────────────────────────────────────────
-- USO: pegar TODO el archivo en Supabase Studio → SQL Editor → Run.
-- Es 100% de SOLO LECTURA: no crea, altera ni escribe nada en el esquema public
-- (solo objetos temporales de sesión, que PostgreSQL descarta al cerrar).
--
-- Studio muestra el resultado de la última sentencia: la tabla-reporte con una
-- fila por chequeo. Interpretación de `estado`:
--   OK      → el objeto ya existe con la forma que el código espera
--   FALTA   → aplicar la migración indicada en `accion`
--   PARCIAL → la migración quedó a medias — re-ejecutarla (todas son idempotentes)
--   REVISAR → situación ambigua (p. ej. columna vieja y nueva coexisten) — ver `detalle`
--   N/A     → no aplica en esta base (nada que hacer)
--
-- Orden de aplicación de lo que salga FALTA (ver docs/plan2-runbook-produccion.md):
--   038 → 039 → 040 → 020 → 023 → 033 → 034 → 036   (+ 032 / 035 / 037 si faltan)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helpers de sesión (viven en pg_temp; desaparecen al cerrar el editor).
create or replace function pg_temp._tbl(text) returns boolean language sql stable as
$h$ select to_regclass('public.' || $1) is not null $h$;

create or replace function pg_temp._col(text, text) returns boolean language sql stable as
$h$ select exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = $1 and column_name = $2) $h$;

create or replace function pg_temp._fn(text) returns boolean language sql stable as
$h$ select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = $1) $h$;

create or replace function pg_temp._rls(text) returns boolean language sql stable as
$h$ select coalesce((select c.relrowsecurity
                       from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relname = $1), false) $h$;

create or replace function pg_temp._pol(text, text) returns boolean language sql stable as
$h$ select exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = $1 and policyname = $2) $h$;

-- Count defensivo: null si la tabla no existe (no rompe el reporte).
create or replace function pg_temp._cnt(text) returns bigint language plpgsql stable as
$h$
declare n bigint;
begin
  if to_regclass('public.' || $1) is null then return null; end if;
  execute format('select count(*) from public.%I', $1) into n;
  return n;
end
$h$;

drop table if exists pg_temp._plan2_diag;
create temp table _plan2_diag (
  orden   int,
  bloque  text,
  chequeo text,
  estado  text,
  detalle text,
  accion  text
);

insert into _plan2_diag values

-- ═══ Precondición: estamos apuntando a la base correcta ══════════════════════
(1, 'precondición', 'clientes / expedientes / documentos existen',
  case when pg_temp._tbl('clientes') and pg_temp._tbl('expedientes') and pg_temp._tbl('documentos')
       then 'OK' else 'REVISAR' end,
  concat_ws(' · ',
    'clientes=' || pg_temp._tbl('clientes'),
    'expedientes=' || pg_temp._tbl('expedientes'),
    'documentos=' || pg_temp._tbl('documentos')),
  'Si algo falta, NO es la base inventariada el 2026-08-03 — detener y confirmar proyecto'),

(2, 'precondición', 'infra de María (conversaciones_whatsapp / onboarding_states)',
  case when pg_temp._tbl('conversaciones_whatsapp') and pg_temp._tbl('onboarding_states')
       then 'OK' else 'REVISAR' end,
  concat_ws(' · ',
    'conversaciones_whatsapp=' || pg_temp._tbl('conversaciones_whatsapp'),
    'onboarding_states=' || pg_temp._tbl('onboarding_states')),
  'Informativo (010/032 según el caso)'),

-- ═══ 038 — esquema núcleo (renames + columnas + backfills) ═══════════════════
(10, '038 núcleo', 'clientes.dpi (era identidad)',
  case when pg_temp._col('clientes','dpi') and not pg_temp._col('clientes','identidad') then 'OK'
       when pg_temp._col('clientes','dpi') and pg_temp._col('clientes','identidad') then 'REVISAR'
       else 'FALTA' end,
  case when pg_temp._col('clientes','identidad') and pg_temp._col('clientes','dpi')
         then 'dpi e identidad coexisten — verificar en cuál viven los datos antes de seguir'
       when pg_temp._col('clientes','identidad') then 'columna vieja identidad presente, rename pendiente'
       when pg_temp._col('clientes','dpi') then 'renombrada'
       else 'ni identidad ni dpi' end,
  'Aplicar 038'),

(11, '038 núcleo', 'clientes.created_at / updated_at / user_id / departamento',
  case when pg_temp._col('clientes','created_at') and pg_temp._col('clientes','updated_at')
            and pg_temp._col('clientes','user_id') and pg_temp._col('clientes','departamento')
       then 'OK' else 'FALTA' end,
  concat_ws(' · ',
    'created_at=' || pg_temp._col('clientes','created_at'),
    'updated_at=' || pg_temp._col('clientes','updated_at'),
    'user_id='    || pg_temp._col('clientes','user_id'),
    'departamento=' || pg_temp._col('clientes','departamento')),
  'Aplicar 038'),

(12, '038 núcleo', 'expedientes.numero_expediente (era numero)',
  case when pg_temp._col('expedientes','numero_expediente') and not pg_temp._col('expedientes','numero') then 'OK'
       when pg_temp._col('expedientes','numero_expediente') and pg_temp._col('expedientes','numero') then 'REVISAR'
       else 'FALTA' end,
  case when pg_temp._col('expedientes','numero') and pg_temp._col('expedientes','numero_expediente')
         then 'numero y numero_expediente coexisten — verificar datos'
       when pg_temp._col('expedientes','numero') then 'columna vieja numero presente'
       when pg_temp._col('expedientes','numero_expediente') then 'renombrada'
       else 'ninguna de las dos' end,
  'Aplicar 038'),

(13, '038 núcleo', 'expedientes.tipo (era tipo_servicio)',
  case when pg_temp._col('expedientes','tipo') and not pg_temp._col('expedientes','tipo_servicio') then 'OK'
       when pg_temp._col('expedientes','tipo') and pg_temp._col('expedientes','tipo_servicio') then 'REVISAR'
       else 'FALTA' end,
  case when pg_temp._col('expedientes','tipo_servicio') then 'columna vieja tipo_servicio presente' else '' end,
  'Aplicar 038'),

(14, '038 núcleo', 'expedientes.inicio (era fecha_inicio)',
  case when pg_temp._col('expedientes','inicio') and not pg_temp._col('expedientes','fecha_inicio') then 'OK'
       when pg_temp._col('expedientes','inicio') and pg_temp._col('expedientes','fecha_inicio') then 'REVISAR'
       else 'FALTA' end,
  case when pg_temp._col('expedientes','fecha_inicio') then 'columna vieja fecha_inicio presente' else '' end,
  'Aplicar 038'),

(15, '038 núcleo', 'expedientes.cierre_estimado (era fecha_estimada_cierre)',
  case when pg_temp._col('expedientes','cierre_estimado') then 'OK' else 'FALTA' end,
  case when pg_temp._col('expedientes','fecha_estimada_cierre') then 'columna vieja fecha_estimada_cierre presente' else '' end,
  'Aplicar 038'),

(16, '038 núcleo', 'expedientes.paso (era paso_actual)',
  case when pg_temp._col('expedientes','paso') then 'OK' else 'FALTA' end,
  case when pg_temp._col('expedientes','paso_actual') then 'columna vieja paso_actual presente' else '' end,
  'Aplicar 038'),

(17, '038 núcleo', 'expedientes.fase_numero / fase_actual_id / columnas 004',
  case when pg_temp._col('expedientes','fase_numero') and pg_temp._col('expedientes','fase_actual_id')
            and pg_temp._col('expedientes','nombre') and pg_temp._col('expedientes','total_pasos')
       then 'OK' else 'FALTA' end,
  concat_ws(' · ',
    'fase_numero='    || pg_temp._col('expedientes','fase_numero'),
    'fase_actual_id=' || pg_temp._col('expedientes','fase_actual_id'),
    'nombre='         || pg_temp._col('expedientes','nombre'),
    'total_pasos='    || pg_temp._col('expedientes','total_pasos')),
  'Aplicar 038'),

(18, '038 núcleo', 'documentos.estado (desde el boolean verificado)',
  case when pg_temp._col('documentos','estado') then 'OK' else 'FALTA' end,
  case when pg_temp._col('documentos','verificado')
         then 'boolean verificado se conserva (fuente del backfill)'
       else 'sin boolean verificado' end,
  'Aplicar 038'),

(19, '038 núcleo', 'indice_legalidad vieja preservada como indice_legalidad_legacy',
  case when pg_temp._tbl('indice_legalidad_legacy') then 'OK'
       when pg_temp._col('indice_legalidad','tierra_titulada') then 'FALTA'
       else 'N/A' end,
  case when pg_temp._tbl('indice_legalidad_legacy')
         then 'legacy preservada (' || coalesce(pg_temp._cnt('indice_legalidad_legacy')::text,'?') || ' filas)'
       when pg_temp._col('indice_legalidad','tierra_titulada')
         then 'indice_legalidad sigue en forma vieja (tierra_titulada) — rename pendiente'
       else 'no hay tabla vieja que preservar' end,
  'Aplicar 038'),

-- ═══ 039 — motor de workflow + tablas hijas del dashboard ════════════════════
(30, '039 workflow', 'tabla fases + seed (5 fases, orden 0-4)',
  case when not pg_temp._tbl('fases') then 'FALTA'
       when pg_temp._cnt('fases') >= 5 then 'OK'
       else 'PARCIAL' end,
  coalesce(pg_temp._cnt('fases')::text, '—') || ' filas (esperadas 5)',
  'Aplicar 039'),

(31, '039 workflow', 'transiciones_fase (grafo secuencial 0→4)',
  case when not pg_temp._tbl('transiciones_fase') then 'FALTA'
       when pg_temp._cnt('transiciones_fase') >= 4 then 'OK'
       else 'PARCIAL' end,
  coalesce(pg_temp._cnt('transiciones_fase')::text, '—') || ' filas (esperadas 4)',
  'Aplicar 039'),

(32, '039 workflow', 'expediente_fases (historial)',
  case when pg_temp._tbl('expediente_fases') then 'OK' else 'FALTA' end, '', 'Aplicar 039'),

(33, '039 workflow', 'registro_auditoria',
  case when pg_temp._tbl('registro_auditoria') then 'OK' else 'FALTA' end, '', 'Aplicar 039'),

(34, '039 workflow', 'pagos',
  case when pg_temp._tbl('pagos') then 'OK' else 'FALTA' end, '', 'Aplicar 039'),

(35, '039 dashboard', 'hitos',
  case when pg_temp._tbl('hitos') then 'OK' else 'FALTA' end, '', 'Aplicar 039'),

(36, '039 dashboard', 'mensajes_wa',
  case when pg_temp._tbl('mensajes_wa') then 'OK' else 'FALTA' end, '', 'Aplicar 039'),

(37, '039 dashboard', 'legalidad_items',
  case when pg_temp._tbl('legalidad_items') then 'OK' else 'FALTA' end, '', 'Aplicar 039'),

(38, '039 dashboard', 'progress_fases + progress_subpasos',
  case when pg_temp._tbl('progress_fases') and pg_temp._tbl('progress_subpasos') then 'OK' else 'FALTA' end,
  concat_ws(' · ',
    'progress_fases='    || pg_temp._tbl('progress_fases'),
    'progress_subpasos=' || pg_temp._tbl('progress_subpasos')),
  'Aplicar 039'),

-- ═══ 040 — estructura del piloto ═════════════════════════════════════════════
(50, '040 piloto', 'minas',
  case when pg_temp._tbl('minas') then 'OK' else 'FALTA' end,
  coalesce(pg_temp._cnt('minas')::text || ' filas', ''), 'Aplicar 040'),

(51, '040 piloto', 'contratos',
  case when pg_temp._tbl('contratos') then 'OK' else 'FALTA' end, '', 'Aplicar 040'),

(52, '040 piloto', 'indice_legalidad (forma nueva: mina_id + componente)',
  case when pg_temp._col('indice_legalidad','mina_id') and pg_temp._col('indice_legalidad','componente') then 'OK'
       when pg_temp._col('indice_legalidad','tierra_titulada') then 'FALTA'
       when not pg_temp._tbl('indice_legalidad') then 'FALTA'
       else 'REVISAR' end,
  case when pg_temp._col('indice_legalidad','tierra_titulada')
         then 'la tabla actual es la forma VIEJA — primero 038 (rename a legacy), luego 040'
       else '' end,
  'Aplicar 040 (tras 038)'),

(53, '040 piloto', 'transacciones_oro',
  case when pg_temp._tbl('transacciones_oro') then 'OK' else 'FALTA' end, '', 'Aplicar 040'),

(54, '040 piloto', 'RLS habilitada en las 4 tablas del piloto',
  case when pg_temp._rls('minas') and pg_temp._rls('contratos')
            and pg_temp._rls('indice_legalidad') and pg_temp._rls('transacciones_oro')
       then 'OK' else 'FALTA' end,
  concat_ws(' · ',
    'minas='             || pg_temp._rls('minas'),
    'contratos='         || pg_temp._rls('contratos'),
    'indice_legalidad='  || pg_temp._rls('indice_legalidad'),
    'transacciones_oro=' || pg_temp._rls('transacciones_oro')),
  'Aplicar 040'),

(55, '040 piloto', 'policies FOR ALL TO service_role (el proyecto no tiene BYPASSRLS)',
  case when pg_temp._pol('minas','Service role all minas')
            and pg_temp._pol('contratos','Service role all contratos')
            and pg_temp._pol('indice_legalidad','Service role all indice_legalidad')
            and pg_temp._pol('transacciones_oro','Service role all transacciones_oro')
       then 'OK' else 'FALTA' end,
  'sin estas policies las rutas admin quedan bloqueadas',
  'Aplicar 040'),

-- ═══ 020 + 036 — certificados de origen ══════════════════════════════════════
(60, '020 certificados', 'certificados_origen',
  case when pg_temp._tbl('certificados_origen') then 'OK' else 'FALTA' end,
  coalesce(pg_temp._cnt('certificados_origen')::text || ' filas', ''),
  'Aplicar 020'),

(61, '020 certificados', 'vista certificados_origen_publicos',
  case when to_regclass('public.certificados_origen_publicos') is not null then 'OK' else 'FALTA' end,
  '', 'Aplicar 020'),

(62, '036 interop', 'certificados_origen.hash_sha256',
  case when pg_temp._col('certificados_origen','hash_sha256') then 'OK' else 'FALTA' end,
  '', 'Aplicar 036 (tras 020)'),

(63, '036 interop', 'vista pública con hash_sha256 + certificado_id',
  case when pg_temp._col('certificados_origen_publicos','hash_sha256')
            and pg_temp._col('certificados_origen_publicos','certificado_id')
       then 'OK' else 'FALTA' end,
  '', 'Aplicar 036 (tras 020)'),

-- ═══ 023 — registro INHGEOMIN ════════════════════════════════════════════════
(70, '023 concesiones', 'concesiones_mineras_registro',
  case when pg_temp._tbl('concesiones_mineras_registro') then 'OK' else 'FALTA' end,
  coalesce(pg_temp._cnt('concesiones_mineras_registro')::text, '—')
    || ' filas (587 tras el seed; 0 = seed pendiente, paso opcional del runbook)',
  'Aplicar 023'),

(71, '023 concesiones', 'vista concesiones_mineras_publicas',
  case when to_regclass('public.concesiones_mineras_publicas') is not null then 'OK' else 'FALTA' end,
  '', 'Aplicar 023'),

(72, '023 concesiones', 'RPC search_concesion_minera + concesiones_minera_stats',
  case when pg_temp._fn('search_concesion_minera') and pg_temp._fn('concesiones_minera_stats')
       then 'OK' else 'FALTA' end,
  concat_ws(' · ',
    'search=' || pg_temp._fn('search_concesion_minera'),
    'stats='  || pg_temp._fn('concesiones_minera_stats')),
  'Aplicar 023'),

-- ═══ 033 — lock de transiciones ══════════════════════════════════════════════
(80, '033 workflow lock', 'RPC avanzar_expediente_fase',
  case when pg_temp._fn('avanzar_expediente_fase') then 'OK' else 'FALTA' end,
  'sin él, advancePhase() cae al guard optimista pre-033 (con warning)',
  'Aplicar 033 (tras 039)'),

-- ═══ 034 — llaves institucionales en minas ═══════════════════════════════════
(85, '034 interop', 'minas.numero_expediente_inhgeomin / numero_permiso_municipal / municipio_permiso',
  case when pg_temp._col('minas','numero_expediente_inhgeomin')
            and pg_temp._col('minas','numero_permiso_municipal')
            and pg_temp._col('minas','municipio_permiso')
       then 'OK' else 'FALTA' end,
  '', 'Aplicar 034 (tras 040)'),

-- ═══ 032 / 035 / 037 — blindaje (aplicar si faltan) ══════════════════════════
(90, '032 blindaje', 'RLS + policy service_role en conversaciones_whatsapp / transacciones_pendientes',
  case when pg_temp._rls('conversaciones_whatsapp') and pg_temp._rls('transacciones_pendientes')
            and pg_temp._pol('conversaciones_whatsapp','conversaciones_whatsapp_service_all')
            and pg_temp._pol('transacciones_pendientes','transacciones_pendientes_service_all')
       then 'OK' else 'FALTA' end,
  concat_ws(' · ',
    'rls_conv='  || pg_temp._rls('conversaciones_whatsapp'),
    'rls_trans=' || pg_temp._rls('transacciones_pendientes'),
    'pol_conv='  || pg_temp._pol('conversaciones_whatsapp','conversaciones_whatsapp_service_all'),
    'pol_trans=' || pg_temp._pol('transacciones_pendientes','transacciones_pendientes_service_all')),
  'Aplicar 032'),

(91, '035 blindaje', 'verificaciones_fuente (append-only)',
  case when pg_temp._tbl('verificaciones_fuente') then 'OK' else 'FALTA' end,
  '', 'Aplicar 035'),

(92, '037 blindaje', 'conversaciones_whatsapp.tipo_interlocutor',
  case when pg_temp._col('conversaciones_whatsapp','tipo_interlocutor') then 'OK' else 'FALTA' end,
  'base del gate institucional pegajoso de María',
  'Aplicar 037');

-- ═══ Reporte final ═══════════════════════════════════════════════════════════
select orden, bloque, chequeo, estado, detalle, accion
  from _plan2_diag
 order by orden;
