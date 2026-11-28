-- tests/sql/reestructura_fixtures.sql — complemento de 043_fixtures.sql + 043_seed.sql
-- para las migraciones 045 en adelante. Se aplica DESPUÉS del seed de la 043
-- (que crea lotes cuando todavía no existe la regla del perfil aprobado).
-- Solo datos de prueba genéricos: titulares A y B, sin nombres reales.

-- Columnas reales de `minas` (008/040) que el stub de la 043 no trae.
alter table public.minas add column if not exists cliente_id uuid references public.clientes(id) on delete cascade;
alter table public.minas add column if not exists codigo text;
alter table public.minas enable row level security;
grant select on public.minas to authenticated;

-- auth.users real tiene deleted_at (lo consulta auth_usuario_id_por_correo).
alter table auth.users add column if not exists deleted_at timestamptz;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000011', 'verificador@test.local'),
  ('a0000000-0000-4000-8000-000000000012', 'recepcion-a@test.local'),
  ('a0000000-0000-4000-8000-000000000013', 'recepcion-b@test.local'),
  ('a0000000-0000-4000-8000-000000000014', 'abogado@test.local'),
  ('a0000000-0000-4000-8000-000000000015', 'minero-b@test.local'),
  ('a0000000-0000-4000-8000-000000000016', 'verificador-2@test.local')
on conflict (id) do nothing;

update public.clientes set user_id = 'a0000000-0000-4000-8000-000000000015'
 where id = 'c0000000-0000-4000-8000-000000000002' and user_id is null;

insert into public.minas (id, nombre, cliente_id, codigo) values
  ('70000000-0000-4000-8000-000000000001', 'Mina del titular A (prueba)', 'c0000000-0000-4000-8000-000000000001', 'MINA-A'),
  ('70000000-0000-4000-8000-000000000002', 'Mina del titular B (prueba)', 'c0000000-0000-4000-8000-000000000002', 'MINA-B'),
  ('70000000-0000-4000-8000-000000000003', 'Segunda mina del titular A (prueba)', 'c0000000-0000-4000-8000-000000000001', 'MINA-A2')
on conflict (id) do nothing;
