-- 004: Expand schema for full dashboard support
-- Adds: hitos, documentos, mensajes_wa, legalidad_items, progress_fases, progress_subpasos
-- Expands: expedientes with all dashboard fields
-- Seeds: demo data matching the dashboard prototype (idempotent)

alter table expedientes
  add column if not exists numero_expediente text,
  add column if not exists cliente        text,
  add column if not exists tipo           text,
  add column if not exists municipio      text,
  add column if not exists estado         text default 'activo',
  add column if not exists fase_numero    int  default 0,
  add column if not exists paso           int  default 1,
  add column if not exists total_pasos    int  default 6,
  add column if not exists abogado_nombre    text,
  add column if not exists abogado_iniciales text,
  add column if not exists psa_nombre        text,
  add column if not exists psa_iniciales     text,
  add column if not exists legalidad      int  default 0,
  add column if not exists inicio         date,
  add column if not exists cierre_estimado date;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expedientes_numero_expediente_key'
      and conrelid = 'expedientes'::regclass
  ) then
    alter table expedientes
      add constraint expedientes_numero_expediente_key unique (numero_expediente);
  end if;
end $$;

-- ─── Hitos de pago ───────────────────────────────────────────────────────────
create table if not exists hitos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes(id) on delete cascade,
  numero         int  not null,
  monto          numeric not null,
  porcentaje     int  not null,
  trigger_evento text not null,
  estado         text default 'pendiente',
  referencia     text,
  fecha_cobro    date,
  created_at     timestamp default now(),
  constraint hitos_estado_check check (estado in ('pendiente','cobrado','bloqueado'))
);

-- ─── Documentos ──────────────────────────────────────────────────────────────
create table if not exists documentos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes(id) on delete cascade,
  nombre         text not null,
  estado         text default 'faltante',
  info           text,
  created_at     timestamp default now(),
  updated_at     timestamp default now(),
  constraint documentos_estado_check check (estado in ('faltante','pendiente','verificado','rechazado'))
);

-- ─── Mensajes WhatsApp ───────────────────────────────────────────────────────
create table if not exists mensajes_wa (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes(id) on delete cascade,
  cliente        text,
  hora           text,
  archivo        text,
  tipo           text,
  doc_tipo       text,
  estado         text default 'listo',
  documento_id   uuid references documentos(id),
  campos         jsonb default '[]',
  created_at     timestamp default now(),
  constraint mensajes_wa_estado_check check (estado in ('listo','procesando','ilegible','verificado','rechazado'))
);

-- ─── Índice de legalidad (5 componentes por expediente) ──────────────────────
create table if not exists legalidad_items (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes(id) on delete cascade,
  nombre         text not null,
  estado         text default 'pendiente',
  orden          int  not null,
  unique (expediente_id, orden)
);

-- ─── Progreso visual por fases ───────────────────────────────────────────────
create table if not exists progress_fases (
  id               uuid primary key default gen_random_uuid(),
  expediente_id    uuid references expedientes(id) on delete cascade,
  nombre           text not null,
  estado           text default 'pendiente',
  pasos            int  default 0,
  total_pasos      int  default 0,
  responsable      text,
  fecha_vencimiento date,
  orden            int  not null
);

create table if not exists progress_subpasos (
  id               uuid primary key default gen_random_uuid(),
  progress_fase_id uuid references progress_fases(id) on delete cascade,
  nombre           text not null,
  estado           text default 'pendiente',
  orden            int  not null
);

-- ─── Seed demo data (idempotent via numero_expediente unique key) ─────────────
do $$
declare
  e1 uuid; e2 uuid; e3 uuid; e4 uuid;
  d1_1 uuid; d1_2 uuid; d1_3 uuid; d1_4 uuid;
  d2_1 uuid; d2_2 uuid; d2_3 uuid; d2_4 uuid;
  d3_1 uuid; d3_2 uuid; d3_3 uuid; d3_4 uuid;
  d4_1 uuid; d4_2 uuid; d4_3 uuid; d4_4 uuid;
  pf1 uuid; pf2 uuid; pf3 uuid; pf4 uuid; pf5 uuid;
  pg1 uuid; pg2 uuid; pg3 uuid; pg4 uuid; pg5 uuid; pg6 uuid; pg7 uuid; pg8 uuid;
begin

  -- ── EXP-2026-001 ───────────────────────────────────────────────────────────
  insert into expedientes (numero_expediente, nombre, cliente, tipo, municipio, estado,
    fase_numero, paso, total_pasos, abogado_nombre, abogado_iniciales,
    psa_nombre, psa_iniciales, legalidad, inicio, cierre_estimado)
  values ('EXP-2026-001', 'Zelaya — Exploración Iriona', 'Juan Antonio Zelaya',
    'Exploración minera', 'Iriona, Colón', 'activo', 1, 9, 13,
    'Abg. Ana Rodríguez', 'AR', 'PSA Pedro Méndez', 'PM', 20,
    '2026-04-12', '2026-10-01')
  on conflict (numero_expediente) do nothing;
  select id into e1 from expedientes where numero_expediente = 'EXP-2026-001';

  if e1 is not null and not exists (select 1 from hitos where expediente_id = e1) then
    insert into hitos (expediente_id, numero, monto, porcentaje, trigger_evento, estado, referencia, fecha_cobro) values
      (e1, 1, 320000, 30, 'Firma del contrato',              'cobrado',   'Finacoop #4521', '2026-04-12'),
      (e1, 2, 480000, 40, 'Constancia INHGEOMIN emitida',    'pendiente', null, null),
      (e1, 3, 800000, 30, 'Lic. ambiental + permiso minero', 'bloqueado', null, null);

    insert into documentos (id, expediente_id, nombre, estado, info) values
      (gen_random_uuid(), e1, 'RTN autenticado',              'verificado', 'Verificado 09:30 · PSA Méndez'),
      (gen_random_uuid(), e1, 'Documento de identidad (DPI)','pendiente',  'Recibido 10:48 · en revisión'),
      (gen_random_uuid(), e1, 'Escritura del terreno',        'faltante',   'Pendiente del cliente'),
      (gen_random_uuid(), e1, 'Garantía bancaria',            'faltante',   'Pendiente del cliente');
    select id into d1_1 from documentos where expediente_id = e1 and nombre = 'RTN autenticado';
    select id into d1_2 from documentos where expediente_id = e1 and nombre = 'Documento de identidad (DPI)';

    insert into legalidad_items (expediente_id, nombre, estado, orden) values
      (e1, 'Tierra',     'ok',       1),
      (e1, 'INHGEO',     'proceso',  2),
      (e1, 'Ambiental',  'pendiente',3),
      (e1, 'Municipal',  'pendiente',4),
      (e1, 'Registro',   'pendiente',5);

    insert into progress_fases (id, expediente_id, nombre, estado, pasos, total_pasos, responsable, fecha_vencimiento, orden) values
      (gen_random_uuid(), e1, 'Fase 0 · Onboarding',                'completada', 6, 6, null, null, 0),
      (gen_random_uuid(), e1, 'Fase 1 · INHGEOMIN',                 'activa',     9, 13,'Abg. Rodríguez', '2026-04-22', 1),
      (gen_random_uuid(), e1, 'Fase 2 · SERNA',                     'pendiente',  0, 0, null, null, 2),
      (gen_random_uuid(), e1, 'Fase 3 · Resolución minera',         'pendiente',  0, 0, null, null, 3),
      (gen_random_uuid(), e1, 'Fase 4 · Municipal + Comercializador','pendiente',  0, 0, null, null, 4);
    select id into pf1 from progress_fases where expediente_id = e1 and orden = 1;
    insert into progress_subpasos (progress_fase_id, nombre, estado, orden) values
      (pf1, 'Paso 8 · Recolección de documentos', 'completado', 1),
      (pf1, 'Paso 9 · Publicación en periódico',  'activo',     2),
      (pf1, 'Paso 10 · Constancia INHGEOMIN',     'pendiente',  3);

    insert into mensajes_wa (expediente_id, cliente, hora, archivo, tipo, doc_tipo, estado, documento_id, campos) values
      (e1, 'Juan Zelaya', '10:48', 'DPI-zelaya.jpg', 'imagen', 'Documento de identidad (DPI)', 'listo', d1_2,
       '[{"label":"Tipo de documento","valor":"DPI Honduras","confianza":"ok"},{"label":"Nombres","valor":"Juan Antonio","confianza":"ok"},{"label":"Apellidos","valor":"Zelaya Martínez","confianza":"ok"},{"label":"Número DPI","valor":"0801-1985-01234","confianza":"warn","nota":"Confianza media — verifica el último dígito"},{"label":"Fecha de nacimiento","valor":"15/03/1985","confianza":"ok"},{"label":"Vencimiento","valor":"15/03/2028","confianza":"ok"}]'),
      (e1, 'Juan Zelaya', '09:30', 'RTN-zelaya.pdf', 'PDF', 'RTN autenticado', 'verificado', d1_1, '[]');
  end if;

  -- ── EXP-2026-007 ───────────────────────────────────────────────────────────
  insert into expedientes (numero_expediente, nombre, cliente, tipo, municipio, estado,
    fase_numero, paso, total_pasos, abogado_nombre, abogado_iniciales,
    psa_nombre, psa_iniciales, legalidad, inicio, cierre_estimado)
  values ('EXP-2026-007', 'López — Explotación Trujillo', 'María Isabel López',
    'Explotación minera', 'Trujillo, Colón', 'alerta', 1, 11, 13,
    'Abg. Carlos Morales', 'CM', 'PSA Luisa García', 'LG', 35,
    '2026-02-03', '2026-08-01')
  on conflict (numero_expediente) do nothing;
  select id into e2 from expedientes where numero_expediente = 'EXP-2026-007';

  if e2 is not null and not exists (select 1 from hitos where expediente_id = e2) then
    insert into hitos (expediente_id, numero, monto, porcentaje, trigger_evento, estado) values
      (e2, 1, 480000, 30, 'Firma del contrato',      'cobrado'),
      (e2, 2, 640000, 40, 'Permiso de explotación',  'pendiente'),
      (e2, 3, 480000, 30, 'Inicio de operaciones',   'bloqueado');

    insert into documentos (id, expediente_id, nombre, estado, info) values
      (gen_random_uuid(), e2, 'RTN autenticado',              'verificado', 'Verificado 3 feb'),
      (gen_random_uuid(), e2, 'DPI',                          'verificado', 'Verificado 3 feb'),
      (gen_random_uuid(), e2, 'Escritura del terreno',        'verificado', 'Verificado 10 feb'),
      (gen_random_uuid(), e2, 'Estudio de impacto ambiental','pendiente',  'En revisión por SERNA');
    select id into d2_4 from documentos where expediente_id = e2 and nombre = 'Estudio de impacto ambiental';

    insert into legalidad_items (expediente_id, nombre, estado, orden) values
      (e2, 'Tierra',    'ok',       1),
      (e2, 'INHGEO',    'alerta',   2),
      (e2, 'Ambiental', 'pendiente',3),
      (e2, 'Municipal', 'pendiente',4),
      (e2, 'Registro',  'pendiente',5);

    insert into progress_fases (id, expediente_id, nombre, estado, pasos, total_pasos, responsable, fecha_vencimiento, orden) values
      (gen_random_uuid(), e2, 'Fase 0 · Onboarding',  'completada', 6,  6,  null,            null,         0),
      (gen_random_uuid(), e2, 'Fase 1 · INHGEOMIN',   'alerta',     11, 13, 'Abg. Morales', '2026-04-29',  1),
      (gen_random_uuid(), e2, 'Fase 2 · SERNA',        'pendiente',  0,  0,  null,            null,         2);
    select id into pf2 from progress_fases where expediente_id = e2 and orden = 1;
    insert into progress_subpasos (progress_fase_id, nombre, estado, orden) values
      (pf2, 'Paso 10 · Constancia provisional', 'completado', 1),
      (pf2, 'Paso 11 · Oposición de terceros',  'alerta',     2),
      (pf2, 'Paso 12 · Resolución de oposición','pendiente',  3);

    insert into mensajes_wa (expediente_id, cliente, hora, archivo, tipo, doc_tipo, estado, documento_id, campos) values
      (e2, 'M. López', '10:15', 'estudio-ambiental.jpg', 'imagen', 'Estudio de impacto ambiental', 'ilegible', d2_4,
       '[{"label":"Tipo de documento","valor":"Estudio ambiental","confianza":"ok"},{"label":"Propietario","valor":"María Isabel López","confianza":"warn","nota":"Verificar segunda inicial"},{"label":"Número expediente SERNA","valor":"???","confianza":"err","nota":"No legible — imagen borrosa"}]');
  end if;

  -- ── EXP-2026-003 ───────────────────────────────────────────────────────────
  insert into expedientes (numero_expediente, nombre, cliente, tipo, municipio, estado,
    fase_numero, paso, total_pasos, abogado_nombre, abogado_iniciales,
    psa_nombre, psa_iniciales, legalidad, inicio, cierre_estimado)
  values ('EXP-2026-003', 'Mejía — Artesanal Copán', 'Carlos Eduardo Mejía',
    'Concesión artesanal', 'El Paraíso, Copán', 'activo', 0, 4, 6,
    'Abg. Ana Rodríguez', 'AR', 'PSA Pedro Méndez', 'PM', 0,
    '2026-04-01', '2026-12-01')
  on conflict (numero_expediente) do nothing;
  select id into e3 from expedientes where numero_expediente = 'EXP-2026-003';

  if e3 is not null and not exists (select 1 from hitos where expediente_id = e3) then
    insert into hitos (expediente_id, numero, monto, porcentaje, trigger_evento, estado) values
      (e3, 1, 160000, 30, 'Firma del contrato',  'cobrado'),
      (e3, 2, 213000, 40, 'Concesión aprobada',  'pendiente'),
      (e3, 3, 160000, 30, 'Operación iniciada',  'bloqueado');

    insert into documentos (id, expediente_id, nombre, estado, info) values
      (gen_random_uuid(), e3, 'RTN autenticado',    'verificado', 'Verificado 1 abr'),
      (gen_random_uuid(), e3, 'DPI',                'pendiente',  'Recibido 10:42 · en revisión'),
      (gen_random_uuid(), e3, 'Escritura del terreno','faltante', 'Pendiente del cliente'),
      (gen_random_uuid(), e3, 'Garantía bancaria',   'faltante',  'Pendiente del cliente');
    select id into d3_2 from documentos where expediente_id = e3 and nombre = 'DPI';

    insert into legalidad_items (expediente_id, nombre, estado, orden) values
      (e3, 'Tierra',    'pendiente',1),
      (e3, 'INHGEO',    'pendiente',2),
      (e3, 'Ambiental', 'pendiente',3),
      (e3, 'Municipal', 'pendiente',4),
      (e3, 'Registro',  'pendiente',5);

    insert into progress_fases (id, expediente_id, nombre, estado, pasos, total_pasos, responsable, fecha_vencimiento, orden) values
      (gen_random_uuid(), e3, 'Fase 0 · Onboarding', 'activa',   4, 6, 'PSA Méndez', '2026-04-28', 0),
      (gen_random_uuid(), e3, 'Fase 1 · INHGEOMIN',  'pendiente',0, 0, null, null, 1);
    select id into pf3 from progress_fases where expediente_id = e3 and orden = 0;
    insert into progress_subpasos (progress_fase_id, nombre, estado, orden) values
      (pf3, 'Paso 3 · Viabilidad INHGEOMIN',   'completado', 1),
      (pf3, 'Paso 4 · Recolección de documentos','activo',   2),
      (pf3, 'Paso 5 · Revisión documental',     'pendiente', 3);

    insert into mensajes_wa (expediente_id, cliente, hora, archivo, tipo, doc_tipo, estado, documento_id, campos) values
      (e3, 'C. Mejía', '10:42', 'DPI-mejia.jpg', 'imagen', 'DPI', 'procesando', d3_2, '[]');
  end if;

  -- ── EXP-2026-008 ───────────────────────────────────────────────────────────
  insert into expedientes (numero_expediente, nombre, cliente, tipo, municipio, estado,
    fase_numero, paso, total_pasos, abogado_nombre, abogado_iniciales,
    psa_nombre, psa_iniciales, legalidad, inicio, cierre_estimado)
  values ('EXP-2026-008', 'Paz — Exploración Iriona', 'Roberto Paz Andino',
    'Exploración minera', 'Iriona, Colón', 'nuevo', 0, 1, 6,
    'Abg. Carlos Morales', 'CM', 'PSA Pedro Méndez', 'PM', 0,
    '2026-04-22', '2027-01-01')
  on conflict (numero_expediente) do nothing;
  select id into e4 from expedientes where numero_expediente = 'EXP-2026-008';

  if e4 is not null and not exists (select 1 from hitos where expediente_id = e4) then
    insert into hitos (expediente_id, numero, monto, porcentaje, trigger_evento, estado) values
      (e4, 1, 320000, 30, 'Firma del contrato',      'pendiente'),
      (e4, 2, 480000, 40, 'Constancia INHGEOMIN',    'bloqueado'),
      (e4, 3, 800000, 30, 'Permiso completo',         'bloqueado');

    insert into documentos (expediente_id, nombre, estado, info) values
      (e4, 'RTN autenticado',    'faltante', 'Pendiente del cliente'),
      (e4, 'DPI',                'faltante', 'Pendiente del cliente'),
      (e4, 'Escritura del terreno','faltante','Pendiente del cliente'),
      (e4, 'Garantía bancaria',   'faltante', 'Pendiente del cliente');

    insert into legalidad_items (expediente_id, nombre, estado, orden) values
      (e4, 'Tierra',    'pendiente',1),
      (e4, 'INHGEO',    'pendiente',2),
      (e4, 'Ambiental', 'pendiente',3),
      (e4, 'Municipal', 'pendiente',4),
      (e4, 'Registro',  'pendiente',5);

    insert into progress_fases (id, expediente_id, nombre, estado, pasos, total_pasos, responsable, fecha_vencimiento, orden) values
      (gen_random_uuid(), e4, 'Fase 0 · Onboarding', 'activa', 1, 6, 'Abg. Morales', '2026-04-24', 0);
    select id into pf4 from progress_fases where expediente_id = e4 and orden = 0;
    insert into progress_subpasos (progress_fase_id, nombre, estado, orden) values
      (pf4, 'Paso 1 · Consulta SIMHON/INHGEOMIN', 'activo', 1);
  end if;

end $$;
