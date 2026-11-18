-- tests/sql/043_seed.sql — datos de prueba para tests/rls-estandar-privado.test.ts.
-- Se carga como superusuario DESPUÉS de aplicar la migración 043 sobre
-- tests/sql/043_fixtures.sql. UUIDs fijos para que el test los referencie.
--
-- Usuarios (auth.users):               Organizaciones:
--   a…01 admin (staff CHT)               b…01 ORG_A comercializador
--   a…02 comercializador ORG_A           b…02 ORG_B comercializador
--   a…03 comercializador ORG_B           b…03 ORG_P planta
--   a…04 planta ORG_P                    b…04 ORG_AUD auditor
--   a…05 auditor ORG_AUD
--   a…06 cliente → clientes c…01
-- Clientes: c…01 (user a…06), c…02 (sin usuario).
-- Fuentes:  d…01 F_A1 (ORG_A, c…01, elegible) · d…02 F_B1 (ORG_B, c…02, elegible)
--           d…03 F_BAD (ORG_A, c…01, NO elegible: permiso vencido, fuera de
--           área, CLPI pendiente, sin declaración de mercurio).
-- Lotes:    e…01 LOTE-A1 (F_A1, planta ORG_P) con 4 pesajes 1000/995/990/900
--           e…02 LOTE-B1 (F_B1, sin planta)
--           11111111-1111-4111-8111-111111111111 LOTE-H (F_A1) — vector del hash,
--           sin eventos (el test los inserta).
-- Expediente f…01 del cliente c…01 con documento f…11.

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@test.local'),
  ('a0000000-0000-4000-8000-000000000002', 'comercializador-a@test.local'),
  ('a0000000-0000-4000-8000-000000000003', 'comercializador-b@test.local'),
  ('a0000000-0000-4000-8000-000000000004', 'planta@test.local'),
  ('a0000000-0000-4000-8000-000000000005', 'auditor@test.local'),
  ('a0000000-0000-4000-8000-000000000006', 'minero@test.local');

insert into public.organizaciones (id, tipo, nombre) values
  ('b0000000-0000-4000-8000-000000000001', 'comercializador', 'Comercializador A (prueba)'),
  ('b0000000-0000-4000-8000-000000000002', 'comercializador', 'Comercializador B (prueba)'),
  ('b0000000-0000-4000-8000-000000000003', 'planta',          'Planta de beneficio P (prueba)'),
  ('b0000000-0000-4000-8000-000000000004', 'auditor',         'Auditoría externa (prueba)');

insert into public.user_roles (user_id, rol, organizacion_id) values
  ('a0000000-0000-4000-8000-000000000001', 'admin',           null),
  ('a0000000-0000-4000-8000-000000000002', 'comercializador', 'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', 'comercializador', 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000004', 'planta',          'b0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000005', 'auditor',         'b0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000006', 'cliente',         null);

insert into public.clientes (id, nombre, user_id) values
  ('c0000000-0000-4000-8000-000000000001', 'Minero Uno (prueba)', 'a0000000-0000-4000-8000-000000000006'),
  ('c0000000-0000-4000-8000-000000000002', 'Minero Dos (prueba)', null);

insert into public.fuentes_comercializador
  (id, organizacion_id, cliente_id, permiso_municipal_numero, permiso_vigente_hasta,
   dentro_area_inhgeomin, declaracion_mercurio_cero, clpi_estado, registrado_por) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'PM-001', current_date + 365, true, true, 'documentado',
   'a0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000002', 'PM-002', current_date + 365, true, true, 'no_aplica',
   'a0000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'PM-003', current_date - 1, false, null, 'pendiente',
   'a0000000-0000-4000-8000-000000000002');

insert into public.lotes (id, codigo, fuente_id, cliente_id, comercializador_org_id, planta_org_id, created_by) values
  ('e0000000-0000-4000-8000-000000000001', 'LOTE-A1', 'd0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000002', 'LOTE-B1', 'd0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   null, 'a0000000-0000-4000-8000-000000000003'),
  ('11111111-1111-4111-8111-111111111111', 'LOTE-H', 'd0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   null, 'a0000000-0000-4000-8000-000000000002');

-- Pesajes del LOTE-A1 (origen → acopio → laboratorio → refinado).
insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol, fecha, lugar, peso_g, detalle_canonico) values
  ('e0000000-0000-4000-8000-000000000001', 'origen_mina', 'a0000000-0000-4000-8000-000000000002', 'comercializador',
   '2026-11-10T13:00:00.000Z', 'Bocamina', 1000.000, '{}'),
  ('e0000000-0000-4000-8000-000000000001', 'acopio', 'a0000000-0000-4000-8000-000000000002', 'comercializador',
   '2026-11-10T16:00:00.000Z', 'Acopio', 995.000, '{}'),
  ('e0000000-0000-4000-8000-000000000001', 'laboratorio', 'a0000000-0000-4000-8000-000000000004', 'planta',
   '2026-11-11T10:00:00.000Z', 'Laboratorio planta', 990.000, '{}'),
  ('e0000000-0000-4000-8000-000000000001', 'refinado', 'a0000000-0000-4000-8000-000000000004', 'planta',
   '2026-11-11T15:00:00.000Z', 'Planta', 900.000, '{}');

insert into public.expedientes (id, cliente_id, nombre) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'EXP-TEST-0001');
insert into public.documentos (id, expediente_id, nombre) values
  ('f0000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001', 'DPI');
