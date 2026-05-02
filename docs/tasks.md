# Tasks

## Pending
- [ ] Wire CTA form (`/` landing page) to Supabase leads table or WhatsApp API
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

---

## Completed

- [x] Project initial setup and Supabase integration
- [x] Database schema (migrations 001–009): all tables with RLS
- [x] Payment validation logic (per-fase, via `pagos` table)
- [x] Audit log system (`registro_auditoria`)
- [x] Expedition workflow engine (`getNextActions`, `getBlockingReasons`, `advancePhase`)
- [x] Phase history tracking (`expediente_fases`)
- [x] Decision endpoint `GET /api/expedientes/:id/next-actions`
- [x] Public landing page (`/`) — bilingual ES/EN, all sections, animated mockup, CTA form
