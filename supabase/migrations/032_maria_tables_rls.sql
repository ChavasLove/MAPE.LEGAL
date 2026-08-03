-- 032_maria_tables_rls.sql
-- Blindaje Fase 0 (T1.5): RLS en las tablas de María.
--
-- conversaciones_whatsapp y transacciones_pendientes contienen PII y datos
-- comerciales de clientes. Todo acceso legítimo pasa por el service role:
--   - webhook Twilio  app/api/whatsapp/route.js   (getSupabase() = service key)
--   - panel admin     app/api/admin/maria/**      (getAdminClient())
-- Ninguna superficie usa el cliente anónimo contra estas tablas (verificado
-- por grep en la orden de limpieza/blindaje 2026-08).
--
-- IMPORTANTE: el service_role de ESTE proyecto NO tiene BYPASSRLS (saga
-- documentada en migraciones 019/024/025). Habilitar RLS sin la policy
-- explícita FOR ALL TO service_role bloquearía también al webhook y al panel
-- admin — por eso este archivo la declara (mismo patrón que 026/027/028/030).
--
-- Idempotente: re-ejecutable sin efectos secundarios.

alter table if exists public.conversaciones_whatsapp  enable row level security;
alter table if exists public.transacciones_pendientes enable row level security;

-- Sin acceso para anon/authenticated: ni grants ni policies permisivas.
revoke all on table public.conversaciones_whatsapp  from anon, authenticated;
revoke all on table public.transacciones_pendientes from anon, authenticated;

drop policy if exists conversaciones_whatsapp_service_all on public.conversaciones_whatsapp;
create policy conversaciones_whatsapp_service_all
  on public.conversaciones_whatsapp
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists transacciones_pendientes_service_all on public.transacciones_pendientes;
create policy transacciones_pendientes_service_all
  on public.transacciones_pendientes
  for all
  to service_role
  using (true)
  with check (true);
