-- Usuarios con los roles nuevos (requiere la 045 aplicada).
insert into public.user_roles (user_id, rol, organizacion_id) values
  ('a0000000-0000-4000-8000-000000000011', 'verificador', null),
  ('a0000000-0000-4000-8000-000000000012', 'recepcion', 'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000013', 'recepcion', 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000014', 'abogado', null),
  ('a0000000-0000-4000-8000-000000000015', 'cliente', null),
  ('a0000000-0000-4000-8000-000000000016', 'verificador', null)
on conflict (user_id) do nothing;
