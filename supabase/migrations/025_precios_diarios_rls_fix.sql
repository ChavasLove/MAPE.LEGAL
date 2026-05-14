-- Migration 025 — Unblock `precios_diarios` cache writes.
--
-- Context: even with `service_all_precios_diarios` declared in migration 009,
-- the `fetchAndStorePrices()` call from María's webhook keeps failing in
-- production with `new row violates row-level security policy for table
-- "precios_diarios"`. Root cause: in this Supabase project the `service_role`
-- does not own `rolbypassrls`, and either the 009 policy drifted out of
-- production or RLS was re-enabled after the policy was dropped manually.
--
-- Same pattern as migrations 019 / 023 / 024: re-declare the policy
-- idempotently AND expose a `SECURITY DEFINER` upsert RPC owned by `postgres`
-- so the auth path is independent of whether `service_role` ever gains
-- `BYPASSRLS` again.

-- ─── Idempotent policy re-creation ───────────────────────────────────────────
-- Postgres has no `create policy if not exists`, so drop + create.
drop policy if exists "service_all_precios_diarios" on public.precios_diarios;
create policy "service_all_precios_diarios"
  on public.precios_diarios
  for all
  to service_role
  using (true)
  with check (true);

-- ─── SECURITY DEFINER upsert RPC ─────────────────────────────────────────────
-- Drop overloads dynamically (Postgres allows multiple signatures with
-- different OUT params; cleaner to wipe everything than to track them).
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as fn_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'upsert_precios_diarios'
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      fn.schema_name, fn.fn_name, fn.args
    );
  end loop;
end$$;

create function public.upsert_precios_diarios(
  p_fecha       date,
  p_oro         numeric,
  p_plata       numeric,
  p_usd_hnl     numeric,
  p_cobre       numeric,
  p_fuente      text,
  p_fetched_at  timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.precios_diarios
    (fecha, oro, plata, usd_hnl, cobre, fuente, fetched_at)
  values
    (p_fecha, p_oro, p_plata, p_usd_hnl, p_cobre, p_fuente, p_fetched_at)
  on conflict (fecha) do update set
    oro        = excluded.oro,
    plata      = excluded.plata,
    usd_hnl    = excluded.usd_hnl,
    cobre      = excluded.cobre,
    fuente     = excluded.fuente,
    fetched_at = excluded.fetched_at
  returning id into v_id;

  return v_id;
end;
$$;

-- Postgres-owned so SECURITY DEFINER bypasses RLS regardless of caller role.
alter function public.upsert_precios_diarios(
  date, numeric, numeric, numeric, numeric, text, timestamptz
) owner to postgres;

-- service_role is the only legitimate caller; do NOT grant to anon/authenticated.
revoke all on function public.upsert_precios_diarios(
  date, numeric, numeric, numeric, numeric, text, timestamptz
) from public;
grant execute on function public.upsert_precios_diarios(
  date, numeric, numeric, numeric, numeric, text, timestamptz
) to service_role;
