-- plan2-verificacion.sql — Verificación post-reparación Plan 2
-- ─────────────────────────────────────────────────────────────────────────────
-- USO: pegar TODO el archivo en Supabase Studio → SQL Editor → Run, DESPUÉS de
-- aplicar la cadena 038 → 039 → 040 → 020 → 023 → 033 → 034 → 036 (+032/035/037).
-- Es 100% de SOLO LECTURA (solo objetos temporales de sesión).
--
-- Resultado esperado: TODAS las filas en OK. Cualquier FALLA/PARCIAL indica qué
-- migración re-ejecutar (todas son idempotentes). Las filas INFO no son errores.
--
-- La verificación funcional (María, /verificar, /dashboard/minas, guardarriel)
-- va después de este script — ver docs/plan2-runbook-produccion.md paso 4.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function pg_temp._col(text, text) returns boolean language sql stable as
$h$ select exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = $1 and column_name = $2) $h$;

create or replace function pg_temp._fn(text) returns boolean language sql stable as
$h$ select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = $1) $h$;

-- Count defensivo con condición; null si tabla/columna no existen.
create or replace function pg_temp._cntw(text, text) returns bigint language plpgsql stable as
$h$
declare n bigint;
begin
  if to_regclass('public.' || $1) is null then return null; end if;
  begin
    execute format('select count(*) from public.%I where %s', $1, $2) into n;
  exception when undefined_column or undefined_table then
    return null;
  end;
  return n;
end
$h$;

-- Sonda de contrato: ejecuta el SELECT exacto que hace el código (limit 0 — no
-- lee datos) y reporta OK o la causa del fallo.
create or replace function pg_temp._probe(text) returns text language plpgsql stable as
$h$
begin
  execute $1;
  return 'OK';
exception
  when undefined_table  then return 'FALLA: tabla inexistente';
  when undefined_column then return 'FALLA: columna inexistente — ' || sqlerrm;
  when others           then return 'FALLA: ' || sqlerrm;
end
$h$;

drop table if exists pg_temp._plan2_verif;
create temp table _plan2_verif (
  orden   int,
  seccion text,
  chequeo text,
  estado  text,
  detalle text
);

-- ═══ 1. Query de 10 columnas — el contrato mínimo del código ═════════════════
insert into _plan2_verif
select 10 + row_number() over (order by c.tabla, c.columna)::int,
       '1. contrato de columnas',
       c.tabla || '.' || c.columna,
       case when pg_temp._col(c.tabla, c.columna) then 'OK' else 'FALLA' end,
       case when pg_temp._col(c.tabla, c.columna) then 'presente'
            else 'ausente — re-ejecutar ' || c.migracion end
  from (values
    ('clientes',         'dpi',               '038'),
    ('expedientes',      'numero_expediente', '038'),
    ('expedientes',      'tipo',              '038'),
    ('expedientes',      'inicio',            '038'),
    ('expedientes',      'cierre_estimado',   '038'),
    ('expedientes',      'paso',              '038'),
    ('expedientes',      'fase_numero',       '038'),
    ('expedientes',      'fase_actual_id',    '038'),
    ('documentos',       'estado',            '038'),
    ('indice_legalidad', 'mina_id',           '040')
  ) as c(tabla, columna, migracion);

insert into _plan2_verif values

-- ═══ 2. Seeds y backfills del workflow (039) ═════════════════════════════════
(30, '2. workflow', 'fases: 5 filas con orden 0-4',
  case when pg_temp._cntw('fases', 'orden between 0 and 4') = 5
            and pg_temp._cntw('fases', 'true') = 5
       then 'OK' else 'FALLA' end,
  coalesce(pg_temp._cntw('fases','true')::text, '—') || ' filas'),

(31, '2. workflow', 'transiciones_fase: grafo secuencial de 4 aristas',
  case when pg_temp._cntw('transiciones_fase', 'true') = 4 then 'OK' else 'FALLA' end,
  coalesce(pg_temp._cntw('transiciones_fase','true')::text, '—') || ' filas'),

(32, '2. workflow', 'expedientes sin fase_actual_id',
  case when coalesce(pg_temp._cntw('expedientes', 'fase_actual_id is null'), -1) = 0
       then 'OK' else 'FALLA' end,
  coalesce(pg_temp._cntw('expedientes','fase_actual_id is null')::text, 'columna ausente')
    || ' filas sin fase (esperadas 0 — backfill de 039)'),

(33, '2. workflow', 'expedientes sin historial en expediente_fases',
  case when coalesce(pg_temp._cntw('expedientes',
         'fase_actual_id is not null and not exists (select 1 from public.expediente_fases ef where ef.expediente_id = expedientes.id)'), -1) = 0
       then 'OK' else 'FALLA' end,
  'esperadas 0 — 039 abre un registro de historial por expediente'),

-- ═══ 3. Backfills del núcleo (038) ═══════════════════════════════════════════
(40, '3. backfills', 'documentos con estado null',
  case when coalesce(pg_temp._cntw('documentos', 'estado is null'), -1) = 0 then 'OK' else 'FALLA' end,
  'esperadas 0 — 038 derivó estado desde el boolean verificado'),

(41, '3. backfills', 'clientes con created_at null',
  case when coalesce(pg_temp._cntw('clientes', 'created_at is null'), -1) = 0 then 'OK' else 'FALLA' end,
  'esperadas 0 — 038 backfilleó desde fecha_registro'),

(42, '3. backfills', 'expedientes con fase_numero null',
  case when coalesce(pg_temp._cntw('expedientes', 'fase_numero is null'), -1) = 0 then 'OK' else 'FALLA' end,
  'esperadas 0 — 038 backfilleó desde fase_actual y default 0'),

-- ═══ 4. Sondas del contrato exacto del código (limit 0 — sin leer datos) ═════
(50, '4. sondas de código', 'lookup de María (route.js:725)',
  pg_temp._probe('select id, nombre, situacion_tierra, municipio, tipo_mineral, dpi, telefono_whatsapp from public.clientes limit 0'),
  'la query que fallaba con identidad — María reconoce clientes cuando da OK'),

(51, '4. sondas de código', 'contexto de expediente de María (route.js:860)',
  pg_temp._probe('select numero_expediente, tipo, estado, fase_numero, paso, total_pasos, cierre_estimado from public.expedientes limit 0'),
  'columnas del bloque de contexto de expediente'),

(52, '4. sondas de código', 'reporte ejecutivo (route.js:513)',
  pg_temp._probe('select estado, tipo, inicio from public.expedientes limit 0'),
  'orden por inicio del modo admin'),

(53, '4. sondas de código', 'finalise() del onboarding',
  pg_temp._probe('select nombre, dpi, municipio, telefono_whatsapp, updated_at from public.clientes limit 0'),
  'el insert/update que dejaba usuarios COMPLETE sin fila'),

(54, '4. sondas de código', 'cadena de inserts de dashboardService — hitos',
  pg_temp._probe('select expediente_id, numero, monto, porcentaje, trigger_evento, estado from public.hitos limit 0'), ''),

(55, '4. sondas de código', 'cadena de inserts de dashboardService — legalidad_items / progress',
  case when pg_temp._probe('select expediente_id, nombre, estado, orden from public.legalidad_items limit 0') = 'OK'
            and pg_temp._probe('select expediente_id, nombre, estado, pasos, total_pasos, orden from public.progress_fases limit 0') = 'OK'
            and pg_temp._probe('select progress_fase_id, nombre, estado, orden from public.progress_subpasos limit 0') = 'OK'
       then 'OK' else 'FALLA' end,
  concat_ws(' · ',
    'legalidad_items='   || pg_temp._probe('select expediente_id, nombre, estado, orden from public.legalidad_items limit 0'),
    'progress_fases='    || pg_temp._probe('select expediente_id, nombre, estado, pasos, total_pasos, orden from public.progress_fases limit 0'),
    'progress_subpasos=' || pg_temp._probe('select progress_fase_id, nombre, estado, orden from public.progress_subpasos limit 0'))),

(56, '4. sondas de código', '/api/admin/minas (dashboard de minas)',
  pg_temp._probe('select id, cliente_id, nombre, codigo, latitud, longitud, municipio, departamento, area_hectareas, tipo_mineral, tipo_concesion, estado, created_at from public.minas limit 0'),
  '/dashboard/minas carga cuando da OK'),

(57, '4. sondas de código', 'llaves institucionales de minas (034)',
  pg_temp._probe('select numero_expediente_inhgeomin, numero_permiso_municipal, municipio_permiso from public.minas limit 0'), ''),

(58, '4. sondas de código', 'upsert del índice de legalidad — unique (mina_id, componente)',
  case when exists (select 1 from pg_constraint
                     where conrelid = to_regclass('public.indice_legalidad')
                       and contype = 'u') then 'OK' else 'FALLA' end,
  'sin el unique, el PATCH de /api/admin/indice-legalidad no puede hacer upsert'),

(59, '4. sondas de código', 'RPC avanzar_expediente_fase (033)',
  case when pg_temp._fn('avanzar_expediente_fase') then 'OK' else 'FALLA' end,
  'sin él, advancePhase() usa el guard optimista con warning'),

-- ═══ 5. Superficies públicas ═════════════════════════════════════════════════
(70, '5. superficies', 'vista certificados_origen_publicos legible',
  pg_temp._probe('select numero_certificado, fecha_emision, peso_oro_g, estado, valido_hasta, hash_verificacion, mina_nombre, hash_sha256, certificado_id from public.certificados_origen_publicos limit 0'),
  'contrato de /verificar y /api/verificar (020 + 036)'),

(71, '5. superficies', 'certificados publicados',
  'INFO',
  coalesce(pg_temp._cntw('certificados_origen','true')::text, '—')
    || ' filas — con 0, /verificar muestra VERIFICAR_CARGA_INICIAL (estado inicial honesto, correcto)'),

(72, '5. superficies', 'concesiones INHGEOMIN',
  'INFO',
  coalesce(pg_temp._cntw('concesiones_mineras_registro','true')::text, '—')
    || ' filas — 0 = seed pendiente (paso opcional: node scripts/seed-concesiones-mineras.mjs)'),

(73, '5. superficies', 'indice_legalidad_legacy preservada',
  'INFO',
  case when to_regclass('public.indice_legalidad_legacy') is not null
         then coalesce(pg_temp._cntw('indice_legalidad_legacy','true')::text,'?')
              || ' filas — datos viejos intactos; migrar al modelo por-mina es decisión de operador'
       else 'no existe (no había tabla vieja que preservar)' end);

-- ═══ Reporte final ═══════════════════════════════════════════════════════════
select orden, seccion, chequeo, estado, detalle
  from _plan2_verif
 order by orden;
