-- Expediente y documento del titular B (el del titular A viene del seed de la 043).
insert into public.expedientes (id, cliente_id, nombre) values
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'EXP-TEST-0002')
on conflict (id) do nothing;
insert into public.documentos (id, expediente_id, nombre) values
  ('f0000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000001', 'Licencia A'),
  ('f0000000-0000-4000-8000-000000000013', 'f0000000-0000-4000-8000-000000000001', 'Nota interna A'),
  ('f0000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000002', 'Licencia B'),
  ('f0000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000002', 'Documento para la planta')
on conflict (id) do nothing;
