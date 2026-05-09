-- 018: Restore INSERT path on user_roles after migration 017 dropped the
-- (recursive) "Admins manage user_roles" policy.
--
-- Symptom this fixes:
--   - OAuth users land on /login?error=Sin%20rol%20asignado because the
--     oauth-session fallback upsert (services/oauth-session/route.ts) hits
--     a missing INSERT policy.
--   - Email signups can fail with "Error al crear la cuenta" /
--     TRIGGER_FAILURE because trigger 015 (handle_new_auth_user) silently
--     fails inside auth.users INSERT for the same reason — its
--     SECURITY DEFINER bypass only works when the function owner has
--     BYPASSRLS, which depends on which Postgres role applied 015.
--
-- The new policy is constrained by WITH CHECK to the default cliente row
-- (rol='cliente', activo=true) so this cannot be abused for self-
-- promotion to admin/abogado/tecnico_ambiental. Admin role changes still
-- go through /admin/usuarios with the service-role client, which bypasses
-- RLS regardless of policies.

-- Idempotent: PostgreSQL has no `CREATE POLICY IF NOT EXISTS`, so drop
-- first to allow this migration to be re-run safely (e.g. when applied
-- partially in Supabase Studio and the second statement aborted).
drop policy if exists "Allow default cliente role insert" on public.user_roles;

create policy "Allow default cliente role insert"
  on public.user_roles for insert
  with check (rol = 'cliente' and activo = true);

-- Backfill: any auth.users row missing a user_roles row gets the default.
-- Covers users created before migration 015 was applied to this project,
-- or whose trigger silently failed under the dropped recursive policy.
-- Idempotent — safe to re-run.
insert into public.user_roles (user_id, rol, activo)
  select u.id, 'cliente', true
    from auth.users u
   where u.id not in (select user_id from public.user_roles)
on conflict (user_id) do nothing;
