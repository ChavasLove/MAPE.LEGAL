-- 041_rls_tablas_operativas.sql — RLS en las tablas operativas del workflow
-- y del dashboard (hallazgo de la revisión de seguridad del 10-nov-2026).
--
-- PROBLEMA. La migración 039 creó el motor de workflow (fases,
-- transiciones_fase, expediente_fases, registro_auditoria, pagos) y las tablas
-- hijas del dashboard (hitos, mensajes_wa, legalidad_items, progress_fases,
-- progress_subpasos) SIN RLS y con `grant all ... to anon, authenticated`
-- (declarado en su comentario final como "paridad con el repo: dashboardService
-- las lee con el cliente anon"). expedientes y documentos — esquema a mano de
-- producción, reparado por 038 — tampoco tenían RLS. Resultado: con la
-- NEXT_PUBLIC_SUPABASE_ANON_KEY (pública por definición) cualquier visitante
-- podía leer y ESCRIBIR expedientes, documentos, pagos, auditoría e historial
-- vía PostgREST, sin pasar por la app. 040 sí puso RLS a minas / contratos /
-- indice_legalidad / transacciones_oro, pero dejó `grant all ... to anon`
-- sobre ellas (inofensivo mientras ninguna policy sea `to anon`, pero
-- innecesario y frágil).
--
-- QUÉ HACE (todo idempotente, re-ejecutable sin efectos secundarios):
--   1. Helper `public.is_internal_staff()` — SECURITY DEFINER, owner postgres,
--      search_path fijo: true si auth.uid() tiene fila activa en user_roles
--      con rol admin | abogado | tecnico_ambiental. Equivale al `exists (...)`
--      inline que usan 027/028/040 y al is_cht_staff() de 021 (migración que
--      NO forma parte de la cadena aplicada a producción — Plan 2 aplicó
--      038→039→040→020→023→033→034→036 — y que no fija search_path).
--   2. Para cada tabla operativa (si existe): enable RLS, `revoke all from
--      anon`, grants acotados a authenticated (la RLS filtra encima) y
--      `grant all` a service_role; policies:
--        - <tabla>_staff_all     FOR ALL  TO authenticated  — staff interno
--        - <tabla>_service_all   FOR ALL  TO service_role   — using(true)
--        - fases / transiciones_fase (catálogo): + <tabla>_authenticated_read
--        - expedientes y sus hijas de cliente: + <tabla>_cliente_read_own
--          (SELECT) ligando clientes.user_id = auth.uid() → expedientes.cliente_id.
--      NINGUNA policy es `to anon` ni `using (true)` para anon.
--   3. `revoke all from anon` también en minas, contratos, indice_legalidad y
--      transacciones_oro (sin tocar sus policies de 040).
--   4. Acota las RPC SECURITY DEFINER de 026 (search_document_chunks,
--      get_parent_document_chunks) a service_role: 026 las concedía a anon y
--      authenticated, lo que permitía consultar los chunks del Mercado de
--      Proyectos con la anon key saltando la RLS de document_chunks. El único
--      caller es app/api/admin/marketplace/projects/[projectId]/search
--      (requireRole('admin') + getAdminClient()).
--
-- SERVICE ROLE. El service_role de ESTE proyecto NO tiene BYPASSRLS (saga
-- 019/024/025/032). Sin la policy explícita `FOR ALL TO service_role` las
-- rutas server-side (requireRole + getAdminClient) quedarían bloqueadas —
-- por eso cada tabla la declara. Desde este PR dashboardService,
-- expedientesService, fasesService y modules/{workflow,expedientes} usan
-- getAdminClient() (ya no la anon key), así que ningún caller legítimo
-- depende de grants a anon.
--
-- CLIENTE ↔ auth.uid(). La liga existe: clientes.user_id (008 / 038) y
-- expedientes.cliente_id (011). Las policies *_cliente_read_own se crean solo
-- si ambas columnas existen. Hoy el portal (/portal) consume /api/expedientes
-- server-side; estas policies son defensa en profundidad para un futuro
-- cliente con JWT de usuario, no un cambio de comportamiento.
--
-- NOTA OPERATIVA: ESTA MIGRACIÓN NO SE APLICA AUTOMÁTICAMENTE. Vercel no
-- aplica migraciones de Supabase; la ejecuta un humano en Supabase Studio →
-- SQL Editor (o `supabase db push`) con aprobación de Willis, en el orden de
-- la cadena (después de 040). Verificación post-aplicación:
--   select tablename, rowsecurity from pg_tables
--    where schemaname='public' and tablename in ('expedientes','documentos','pagos');
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name='expedientes' and grantee='anon';   -- debe dar 0 filas
--
-- Compatibilidad: PostgreSQL 15/16 (Supabase).

-- ═══ 1. Helper de staff interno ═════════════════════════════════════════════

create or replace function public.is_internal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.activo
       and ur.rol in ('admin', 'abogado', 'tecnico_ambiental')
  );
$$;

alter function public.is_internal_staff() owner to postgres;
revoke execute on function public.is_internal_staff() from public;
grant  execute on function public.is_internal_staff() to authenticated, service_role;

comment on function public.is_internal_staff() is
  'RLS helper (041): true si el usuario autenticado es staff interno activo (admin|abogado|tecnico_ambiental). SECURITY DEFINER para no depender de la policy de lectura de user_roles.';

-- ═══ 2. RLS + grants + policies base en las tablas operativas ═══════════════

do $$
declare
  tbl text;
  tablas_operativas constant text[] := array[
    'expedientes', 'documentos',
    'fases', 'transiciones_fase', 'expediente_fases',
    'registro_auditoria', 'pagos',
    'hitos', 'mensajes_wa', 'legalidad_items',
    'progress_fases', 'progress_subpasos'
  ];
begin
  foreach tbl in array tablas_operativas loop
    if to_regclass(format('public.%I', tbl)) is null then
      raise notice '041: tabla public.% no existe — se omite', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    -- anon: nada. authenticated: CRUD acotado por RLS. service_role: todo.
    execute format('revoke all on table public.%I from anon', tbl);
    execute format('revoke all on table public.%I from authenticated', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);
    execute format('grant all on table public.%I to service_role', tbl);

    -- Staff interno: lectura y escritura.
    execute format('drop policy if exists %I on public.%I', tbl || '_staff_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_internal_staff())
         with check (public.is_internal_staff())',
      tbl || '_staff_all', tbl);

    -- Service role (sin BYPASSRLS en este proyecto): todo.
    execute format('drop policy if exists %I on public.%I', tbl || '_service_all', tbl);
    execute format(
      'create policy %I on public.%I for all to service_role
         using (true) with check (true)',
      tbl || '_service_all', tbl);
  end loop;
end $$;

-- ═══ 3. Catálogo del workflow: lectura para cualquier sesión autenticada ════
-- fases y transiciones_fase no contienen datos de clientes; un usuario
-- autenticado (incluido un cliente del portal) puede necesitar los nombres de
-- fase para interpretar su expediente. anon sigue sin acceso.

do $$
declare
  tbl text;
begin
  foreach tbl in array array['fases', 'transiciones_fase'] loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', tbl || '_authenticated_read', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      tbl || '_authenticated_read', tbl);
  end loop;
end $$;

-- ═══ 4. Cliente lee lo suyo (SELECT) ═══════════════════════════════════════
-- Requiere clientes.user_id y expedientes.cliente_id. Si falta cualquiera de
-- las dos (esquema previo a 038/011), se omite con NOTICE y el acceso del
-- cliente sigue pasando exclusivamente por rutas server-side con service role.

do $$
declare
  tbl text;
  tiene_user_id    boolean;
  tiene_cliente_id boolean;
  hijas_por_expediente constant text[] := array[
    'documentos', 'hitos', 'legalidad_items', 'progress_fases',
    'expediente_fases', 'pagos'
  ];
begin
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'clientes'
                    and column_name = 'user_id')
    into tiene_user_id;
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'expedientes'
                    and column_name = 'cliente_id')
    into tiene_cliente_id;

  if not (tiene_user_id and tiene_cliente_id) then
    raise notice '041: falta clientes.user_id o expedientes.cliente_id — policies *_cliente_read_own omitidas';
    return;
  end if;

  -- expedientes: el cliente ve los expedientes ligados a su fila en clientes.
  if to_regclass('public.expedientes') is not null then
    drop policy if exists expedientes_cliente_read_own on public.expedientes;
    create policy expedientes_cliente_read_own on public.expedientes
      for select to authenticated
      using (exists (select 1 from public.clientes c
                      where c.id = expedientes.cliente_id
                        and c.user_id = auth.uid()));
  end if;

  -- Hijas con expediente_id: por join a expedientes → clientes.
  foreach tbl in array hijas_por_expediente loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = tbl
                      and column_name = 'expediente_id') then
      raise notice '041: public.% sin expediente_id — policy cliente omitida', tbl;
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', tbl || '_cliente_read_own', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (exists (select 1
                          from public.expedientes e
                          join public.clientes c on c.id = e.cliente_id
                         where e.id = %I.expediente_id
                           and c.user_id = auth.uid()))',
      tbl || '_cliente_read_own', tbl, tbl);
  end loop;

  -- progress_subpasos: cuelga de progress_fases, no de expedientes.
  if to_regclass('public.progress_subpasos') is not null
     and to_regclass('public.progress_fases') is not null then
    drop policy if exists progress_subpasos_cliente_read_own on public.progress_subpasos;
    create policy progress_subpasos_cliente_read_own on public.progress_subpasos
      for select to authenticated
      using (exists (select 1
                       from public.progress_fases pf
                       join public.expedientes e on e.id = pf.expediente_id
                       join public.clientes c on c.id = e.cliente_id
                      where pf.id = progress_subpasos.progress_fase_id
                        and c.user_id = auth.uid()));
  end if;

  -- mensajes_wa y registro_auditoria son internas: sin policy de cliente.
end $$;

-- ═══ 5. Piloto core (040): retirar los grants a anon ═══════════════════════
-- 040 hizo `grant all ... to anon, authenticated, service_role`. Sus policies
-- ya restringen por rol (ninguna es `to anon`), así que el grant a anon no
-- abría datos; se retira igual para que un error futuro en una policy no
-- vuelva a exponer la tabla. Las policies de 040 NO se tocan.

do $$
declare
  tbl text;
begin
  foreach tbl in array array['minas', 'contratos', 'indice_legalidad', 'transacciones_oro'] loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;
    execute format('revoke all on table public.%I from anon', tbl);
    execute format('revoke all on table public.%I from authenticated', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);
    execute format('grant all on table public.%I to service_role', tbl);
  end loop;
end $$;

-- ═══ 6. RPC del Mercado de Proyectos (026): solo service_role ══════════════
-- SECURITY DEFINER + grant a anon = la anon key leía document_chunks de
-- cualquier proyecto saltando la RLS de la tabla. Se enumeran los overloads
-- por nombre (patrón 024/026) para no depender de la firma exacta ni de que
-- la extensión `vector` esté instalada en este ambiente. También se revoca de
-- PUBLIC: EXECUTE sobre funciones se concede a PUBLIC por defecto en
-- PostgreSQL y quitárselo solo a anon/authenticated no bastaría.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('search_document_chunks', 'get_parent_document_chunks')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.firma);
    execute format('grant execute on function %s to service_role', r.firma);
  end loop;
end $$;
