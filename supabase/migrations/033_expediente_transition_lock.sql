-- 033_expediente_transition_lock.sql
-- Blindaje Fase 0 (T1.6): transiciones de expediente sin condición de carrera.
--
-- El avance de fase pasaba por varias statements PostgREST separadas
-- (UPDATE expedientes + cierre de expediente_fases + INSERT historial +
-- INSERT auditoría) protegidas solo por un guard optimista (PR #176). Este
-- RPC hace todo el tramo crítico en UNA transacción con SELECT ... FOR UPDATE
-- sobre la fila del expediente: de dos transiciones concurrentes, una aplica
-- y la otra recibe un error controlado (EXPEDIENTE_MODIFICADO) — sin
-- corrupción de fase_actual_id / fase_numero / expediente_fases y sin doble
-- avance.
--
-- División de responsabilidades (documentada también en modules/expedientes.ts):
--   - La validación RICA (documentos verificados, pagos, elección de
--     transición cuando hay varias) sigue en modules/workflow.ts — produce
--     los mensajes de bloqueo que ve el dashboard.
--   - Este RPC re-verifica dentro del lock lo que la carrera puede invalidar:
--     que la fase actual siga siendo la leída y que la transición exista en
--     el grafo. Luego avanza + historial + auditoría, atómico.
--
-- SECURITY DEFINER owner postgres (patrón 019/023/025/030): funciona aunque
-- el service_role del proyecto no tenga BYPASSRLS. EXECUTE solo para
-- service_role — el handler ya pasó requireRole() antes de llegar aquí; no se
-- expone a anon/authenticated.
--
-- Idempotente: drop de overloads previos antes de crear (lección migración 024).

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'avanzar_expediente_fase'
  loop
    execute format('drop function if exists %s', fn.sig);
  end loop;
end $$;

create function public.avanzar_expediente_fase(
  p_expediente_id  uuid,
  p_fase_origen_id uuid,          -- null cuando el expediente aún no tiene fase
  p_fase_destino_id uuid,
  p_user_id        uuid default null
) returns setof public.expedientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual        uuid;
  v_destino_orden int;
  v_destino_nombre text;
begin
  -- Serializa transiciones concurrentes sobre el mismo expediente. El
  -- perdedor espera aquí y al despertar ve la fase ya cambiada.
  select fase_actual_id
    into v_actual
    from public.expedientes
   where id = p_expediente_id
   for update;

  if not found then
    raise exception 'EXPEDIENTE_NO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if v_actual is distinct from p_fase_origen_id then
    raise exception 'EXPEDIENTE_MODIFICADO'
      using errcode = '55000',
            hint = 'El expediente fue modificado por otra operación.';
  end if;

  select orden, nombre
    into v_destino_orden, v_destino_nombre
    from public.fases
   where id = p_fase_destino_id;

  if not found then
    raise exception 'FASE_DESTINO_NO_ENCONTRADA' using errcode = 'P0002';
  end if;

  -- La transición debe existir en el grafo (salvo el arranque sin fase).
  if p_fase_origen_id is not null and not exists (
    select 1
      from public.transiciones_fase
     where fase_origen_id  = p_fase_origen_id
       and fase_destino_id = p_fase_destino_id
  ) then
    raise exception 'TRANSICION_INVALIDA' using errcode = '23514';
  end if;

  update public.expedientes
     set fase_actual_id = p_fase_destino_id,
         fase_numero    = v_destino_orden
   where id = p_expediente_id;

  -- Cierra el registro de historial abierto de la fase anterior.
  if p_fase_origen_id is not null then
    update public.expediente_fases
       set salida_en = now()
     where expediente_id = p_expediente_id
       and fase_id = p_fase_origen_id
       and salida_en is null;
  end if;

  insert into public.expediente_fases (expediente_id, fase_id, ingresado_por)
  values (p_expediente_id, p_fase_destino_id, p_user_id);

  insert into public.registro_auditoria (expediente_id, accion, metadata, user_id)
  values (
    p_expediente_id,
    'TRANSICION_FASE',
    jsonb_build_object(
      'fase_anterior_id',  p_fase_origen_id,
      'fase_nueva_id',     p_fase_destino_id,
      'fase_nueva_nombre', v_destino_nombre
    ),
    p_user_id
  );

  return query
    select * from public.expedientes where id = p_expediente_id;
end
$$;

alter function public.avanzar_expediente_fase(uuid, uuid, uuid, uuid)
  owner to postgres;

revoke execute on function public.avanzar_expediente_fase(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.avanzar_expediente_fase(uuid, uuid, uuid, uuid)
  to service_role;
