-- 019: SECURITY DEFINER RPC for role lookup + tighten INSERT policy + backfill
--
-- Background: every auth route (login, oauth-session, callback, refresh,
-- serverAuth) does a direct SELECT on public.user_roles with the service-role
-- client, assuming `service_role` has BYPASSRLS. In Supabase projects where
-- BYPASSRLS is missing on `service_role` (config-dependent), the SELECT
-- silently returns 0 rows because the only matching policy
-- ("Users can read own role") evaluates auth.uid() = null. supabase-js
-- doesn't surface that as an error, so the routes fall through to a
-- self-heal upsert which fails for the same reason → users land on
-- /login?error=Sin%20rol%20asignado.
--
-- Fix: call a SECURITY DEFINER function instead. SECURITY DEFINER runs
-- with the privileges of the function OWNER (postgres after this migration
-- runs in Supabase Studio), and postgres always has BYPASSRLS — so the
-- lookup works regardless of `service_role` config drift.
--
-- Idempotent: safe to re-run; uses CREATE OR REPLACE / DROP IF EXISTS.

-- ─── (a) RPC: get_user_role_for_login ────────────────────────────────────────
create or replace function public.get_user_role_for_login(p_user_id uuid)
returns table(rol text, activo boolean)
language sql
security definer
set search_path = public
as $$
  select ur.rol, ur.activo
    from public.user_roles ur
   where ur.user_id = p_user_id;
$$;

-- Lock down execute privileges. Anonymous callers should never invoke this;
-- service_role uses it from server routes; authenticated is allowed so a
-- future client-side caller could read its own role without RLS plumbing.
revoke all on function public.get_user_role_for_login(uuid) from public;
grant execute on function public.get_user_role_for_login(uuid)
  to service_role, authenticated;

-- ─── (b) Tighten INSERT policy from migration 018 ────────────────────────────
-- Original 018 policy: WITH CHECK (rol = 'cliente' AND activo = true).
-- That allowed any authenticated user to seed a 'cliente' row for an
-- arbitrary user_id (the PK collides if the victim already has a row, but
-- it would still allow seeding cliente rows for newly-created users before
-- the trigger fires, etc.). Tighten by also requiring user_id = auth.uid().
drop policy if exists "Allow default cliente role insert"      on public.user_roles;
drop policy if exists "Allow default cliente role self-insert" on public.user_roles;

create policy "Allow default cliente role self-insert"
  on public.user_roles for insert
  with check (
    rol = 'cliente'
    and activo = true
    and user_id = auth.uid()
  );

-- ─── (c) Defensive backfill (idempotent) ─────────────────────────────────────
-- Anything in auth.users that somehow lacks a user_roles row gets the
-- default 'cliente'. Same query as migration 018; re-running covers any
-- users created between then and now whose trigger 015 silently failed.
insert into public.user_roles (user_id, rol, activo)
  select u.id, 'cliente', true
    from auth.users u
   where u.id not in (select user_id from public.user_roles)
on conflict (user_id) do nothing;
