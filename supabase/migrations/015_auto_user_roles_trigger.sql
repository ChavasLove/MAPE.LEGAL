-- 015: Auto-create user_roles row on auth.users insert + backfill missing rows
--
-- Background: until this migration, creating a user via the Supabase Studio UI
-- (or any path that bypasses POST /api/admin/usuarios) left the user with no
-- row in public.user_roles, so login returned 403 "Sin rol asignado". The
-- trigger below guarantees every auth.users row has a matching user_roles
-- row, defaulted to 'cliente'. Admin can promote later via /admin/usuarios.
--
-- The grant statements are required: without explicit INSERT privilege on
-- public.user_roles, the supabase_auth_admin role (which owns auth.users
-- inserts) cannot run the trigger body, and the entire user creation rolls
-- back with "Database error saving new user".

-- ─── Trigger function ────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, rol, activo)
  values (new.id, 'cliente', true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ─── Grants — supabase_auth_admin runs the trigger body ──────────────────────
grant usage  on schema public           to supabase_auth_admin;
grant insert on public.user_roles       to supabase_auth_admin;

-- ─── Trigger ─────────────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─── Backfill: existing auth.users without a user_roles row ──────────────────
-- Fixes any user created via Supabase Studio before this migration ran (e.g.
-- cachivo@gmail.com). New rows default to 'cliente'; admins can be promoted
-- afterwards via /admin/usuarios or the seed-super-admin script.
insert into public.user_roles (user_id, rol, activo)
  select id, 'cliente', true
    from auth.users
   where id not in (select user_id from public.user_roles)
on conflict (user_id) do nothing;
