# Tasks

## Pending
- [ ] Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Environment Variables
- [ ] Implement `documentos` table and fill real document check in `getBlockingReasons`
- [ ] Add Row Level Security (RLS) policies to all Supabase tables
- [ ] Implement Supabase Auth and wire `user_id` to session
- [ ] Add UI for advancing fases (transition button + blocking reason display)
- [ ] Add UI for pagos management (register and validate payments)
- [ ] Add `GET /api/fases` endpoint for frontend fase listing
- [ ] Add `GET /api/expedientes/:id/fases` to retrieve fase history
- [ ] Define permissions per fase (which role can advance each phase)
- [ ] Populate `scripts/visual-guide.ts` — interactive token reference for designers

## In Progress
- (none)

## Completed
- [x] Project initial setup and Supabase integration
- [x] Database schema migrations 001–010 (all tables current)
- [x] Workflow tables: `fases`, `transiciones_fase`, `expedientes`, `pagos`, `expediente_fases`, `registro_auditoria`
- [x] Extended tables: `perfiles_profesionales`, `asignaciones`, `documentos`, `mensajes`, `hitos_pago`, `tareas`
- [x] `user_roles` table (migration 005)
- [x] `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones` (migration 006)
- [x] `contactos_web` (migration 007)
- [x] `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`, `conversaciones_whatsapp`, `transacciones_pendientes` (migration 008)
- [x] `usuarios_broadcast`, `daily_report_config`, `precios_diarios`, `broadcast_log` (migration 009)
- [x] `admin_actions`, `onboarding_states`; `clientes.telefono_whatsapp/situacion_tierra/tipo_mineral` (migration 010)
- [x] Payment validation logic (per-fase, via `pagos` table)
- [x] Audit log system (`registro_auditoria`)
- [x] Expediente workflow engine (`getNextActions`, `getBlockingReasons`, `advancePhase`)
- [x] Phase history tracking (`expediente_fases` with `entrada_en` / `salida_en`)
- [x] Bilingual naming convention (Spanish DB/domain, English code logic)
- [x] Decision endpoint `GET /api/expedientes/:id/next-actions`
- [x] Fix Vercel build failure — lazy Proxy on Supabase client + `force-dynamic` on all API routes
- [x] Add `.env.example` documenting required environment variables
