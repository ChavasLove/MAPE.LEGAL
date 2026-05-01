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
- [ ] Define roles and permissions per fase (e.g. who can advance SERNA)

## In Progress
- (none)

## Completed
- [x] Project initial setup
- [x] Supabase integration
- [x] Create fases table in database
- [x] Implement payment validation logic (per-fase, via `pagos` table)
- [x] Add audit log system (`registro_auditoria` with `user_id` and `accion`)
- [x] Define expediente state transitions (explicit graph in `transiciones_fase`)
- [x] Expediente workflow engine (`getNextActions`, `getBlockingReasons`, `advancePhase`)
- [x] Phase history tracking (`expediente_fases` with `entrada_en` / `salida_en`)
- [x] Bilingual naming convention (Spanish DB/domain, English code logic)
- [x] Decision endpoint `GET /api/expedientes/:id/next-actions`
- [x] Fix Vercel build failure — lazy Proxy on Supabase client + `force-dynamic` on all API routes
- [x] Add `.env.example` documenting required environment variables
