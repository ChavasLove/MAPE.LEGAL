-- Datos de prueba de la recepción (requiere la 047). Organizaciones genéricas.
insert into public.organizaciones (id, tipo, nombre) values
  ('b0000000-0000-4000-8000-000000000010', 'laboratorio', 'Laboratorio de destino (prueba)')
on conflict (id) do nothing;
insert into public.puntos_recepcion (id, organizacion_id, tipo, nombre) values
  ('90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'centro_acopio', 'Punto A (prueba)'),
  ('90000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'oficina', 'Punto B (prueba)')
on conflict (id) do nothing;
