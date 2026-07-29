-- ============================================================================
-- 031_ensayes.sql  (Adenda 01 al encargo Precio de Referencia — Tarea 6)
-- Registro de determinaciones de ley. Indeleble.
-- Prohibido DELETE. Correcciones por reemplazo (estado + reemplaza_a).
--
-- Idempotente (drop constraint/policy if exists antes de cada create —
-- convención 018/019/025/030).
--
-- Adaptaciones respecto del SQL de la adenda, conforme a la nota del script
-- original sobre adaptarse a la convención del proyecto:
--   1. La adenda habilita RLS sin declarar policies — sin policies NADIE
--      puede leer ni escribir (el service_role de este proyecto no tiene
--      BYPASSRLS, saga 019/025-030). Se declaran: lectura pública limitada
--      a tipo='verificacion_externa' vigente (la Tarea 7 la necesita; los
--      ensayes de liquidación por transacción son datos comerciales del
--      vendedor y NO se exponen), y select/insert/update para service_role.
--   2. revoke delete, truncate — refuerza la indelebilidad al nivel de
--      grants (mismo patrón que 030). No existe policy de DELETE.
-- ============================================================================

create table if not exists ensayes (
  id                      uuid primary key default gen_random_uuid(),
  lote                    text not null,
  transaccion_id          uuid,
  tipo                    text not null check (tipo in ('liquidacion','contraste','dirimente','verificacion_externa')),
  metodo                  text not null,
  laboratorio             text,
  ley_oro_ppm             numeric(12,4) not null check (ley_oro_ppm >= 0),
  ley_plata_ppm           numeric(12,4),
  masa_muestra_g          numeric(12,4),
  superficie_preparada    boolean not null default false,
  testigo_sellado         boolean not null default false,
  testigo_identificador   text,
  testigo_conservado_hasta date,
  operador                uuid,
  presencia_vendedor      boolean not null default false,
  estado                  text not null default 'vigente'
                          check (estado in ('vigente','reemplazado')),
  reemplaza_a             uuid references ensayes(id),
  motivo_reemplazo        text,
  created_at              timestamptz not null default now()
);

create index if not exists ensayes_lote_idx on ensayes (lote);
create index if not exists ensayes_transaccion_idx on ensayes (transaccion_id);

-- Toda lectura de liquidación debe declarar superficie preparada y presencia
-- del vendedor. Constraint deliberada: una lectura de liquidación sin
-- superficie preparada sobrevalora sistemáticamente el contenido de oro —
-- la base de datos debe impedir que se registre.
alter table ensayes
  drop constraint if exists ensayes_liquidacion_chk;
alter table ensayes
  add constraint ensayes_liquidacion_chk
  check (tipo <> 'liquidacion' or (superficie_preparada = true and presencia_vendedor = true));

alter table ensayes
  drop constraint if exists ensayes_motivo_chk;
alter table ensayes
  add constraint ensayes_motivo_chk
  check (reemplaza_a is null or (motivo_reemplazo is not null and length(trim(motivo_reemplazo)) > 0));

alter table ensayes enable row level security;

-- Lectura pública: únicamente las verificaciones externas trimestrales
-- vigentes (Tarea 7 — sección pública de /politica-de-precios). Los ensayes
-- de liquidación/contraste/dirimente por transacción no son públicos.
drop policy if exists ensayes_lectura_publica on ensayes;
create policy ensayes_lectura_publica
  on ensayes for select
  using (tipo = 'verificacion_externa' and estado = 'vigente');

drop policy if exists ensayes_lectura_servicio on ensayes;
create policy ensayes_lectura_servicio
  on ensayes for select
  to service_role
  using (true);

drop policy if exists ensayes_escritura_servicio on ensayes;
create policy ensayes_escritura_servicio
  on ensayes for insert
  to service_role
  with check (true);

drop policy if exists ensayes_actualizacion_servicio on ensayes;
create policy ensayes_actualizacion_servicio
  on ensayes for update
  to service_role
  using (true);

-- No existe policy de DELETE; se revoca además el privilegio.
revoke delete, truncate on table ensayes from anon, authenticated, service_role;

grant select on table ensayes to anon, authenticated;
grant select, insert, update on table ensayes to service_role;

comment on table ensayes is
  'Registro indeleble de determinaciones de ley. Prohibido DELETE. Correcciones por reemplazo.';
