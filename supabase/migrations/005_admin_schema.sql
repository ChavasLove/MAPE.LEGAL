-- 005: Admin panel schema
-- Adds: perfiles_profesionales (lawyers + technicians), user_roles
-- These tables power the admin panel's user and professional profile management.

-- ─── Perfiles de profesionales ───────────────────────────────────────────────
-- Lawyers (abogados) and environmental technicians (técnicos ambientales)
-- referenced in expedientes.abogado_nombre / psa_nombre
create table if not exists perfiles_profesionales (
  id           uuid primary key default gen_random_uuid(),
  nombre       text    not null,
  iniciales    text    not null,
  rol          text    not null,
  especialidad text,
  email        text    unique,
  telefono     text,
  activo       boolean not null default true,
  -- optional link to a Supabase Auth user account
  usuario_id   uuid    references auth.users(id) on delete set null,
  created_at   timestamp default now(),
  updated_at   timestamp default now(),
  constraint perfiles_rol_check check (
    rol in ('abogado', 'tecnico_ambiental', 'admin')
  )
);

-- ─── Roles de usuarios ───────────────────────────────────────────────────────
-- Extends auth.users with application-level roles and profile links.
create table if not exists user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rol        text    not null default 'cliente',
  perfil_id  uuid    references perfiles_profesionales(id) on delete set null,
  activo     boolean not null default true,
  created_at timestamp default now(),
  constraint user_roles_rol_check check (
    rol in ('admin', 'abogado', 'tecnico_ambiental', 'cliente')
  )
);

-- ─── RLS policies ─────────────────────────────────────────────────────────────
alter table perfiles_profesionales enable row level security;
alter table user_roles             enable row level security;

-- Admins can do everything; non-admins can only read active profiles
create policy "Admins manage perfiles"
  on perfiles_profesionales for all
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and rol = 'admin' and activo = true
    )
  );

create policy "Public can read active perfiles"
  on perfiles_profesionales for select
  using (activo = true);

create policy "Admins manage user_roles"
  on user_roles for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo = true
    )
  );

create policy "Users can read own role"
  on user_roles for select
  using (user_id = auth.uid());

-- ─── Seed existing demo profiles ─────────────────────────────────────────────
-- Profiles referenced in the expedientes seed data — created without user accounts.
insert into perfiles_profesionales (nombre, iniciales, rol, activo) values
  ('Abg. Ana Rodríguez',  'AR', 'abogado',          true),
  ('Abg. Carlos Morales', 'CM', 'abogado',          true),
  ('PSA Pedro Méndez',    'PM', 'tecnico_ambiental', true),
  ('PSA Luisa García',    'LG', 'tecnico_ambiental', true)
on conflict (email) do nothing;
