-- 034_minas_llaves_institucionales.sql
-- Interoperabilidad Fase 1 (T2.1): llaves de referencia institucional en minas.
--
-- Campos INTERNOS (regla R6 de la orden 2026-08): se capturan y consultan solo
-- en superficies autenticadas (/dashboard/minas/[id]); ninguna superficie
-- pública debe afirmar vínculo, aval o interoperabilidad con INHGEOMIN, AMHON
-- ni municipalidad alguna a partir de estos campos.
--
-- Nota de no-duplicación: expedientes.numero_expediente es la numeración
-- INTERNA de MAPE (EXP-YYYY-NNNN, generada por dashboardService) — no es el
-- número de expediente INHGEOMIN. Por eso la llave institucional vive aquí,
-- en minas, sin duplicar numeración existente.
--
-- Idempotente: re-ejecutable sin efectos secundarios.

alter table public.minas
  add column if not exists numero_expediente_inhgeomin text null,
  add column if not exists numero_permiso_municipal    text null,
  add column if not exists municipio_permiso           text null;

create index if not exists idx_minas_num_exp_inhgeomin
  on public.minas (numero_expediente_inhgeomin);

comment on column public.minas.numero_expediente_inhgeomin is
  'Número de expediente asignado por INHGEOMIN (referencia institucional interna).';
comment on column public.minas.numero_permiso_municipal is
  'Número del permiso de operación municipal (referencia institucional interna).';
comment on column public.minas.municipio_permiso is
  'Municipalidad que emitió el permiso de operación (referencia institucional interna).';
