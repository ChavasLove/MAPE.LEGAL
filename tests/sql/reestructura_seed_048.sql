-- Organizaciones de prueba de los tipos nuevos (requiere 047 + 048).
insert into public.organizaciones (id, tipo, nombre) values
  ('b0000000-0000-4000-8000-000000000021', 'cooperativa', 'Cooperativa X (prueba)'),
  ('b0000000-0000-4000-8000-000000000022', 'cooperativa', 'Cooperativa Y (prueba)'),
  ('b0000000-0000-4000-8000-000000000023', 'municipio',   'Municipio M (prueba)'),
  ('b0000000-0000-4000-8000-000000000024', 'otro',        'Otra organización (prueba)')
on conflict (id) do nothing;
