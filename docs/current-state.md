# Current State

## Last Updated
2026-05-01

## Current Module
Expedientes — workflow engine complete

---

## Completed

### Project foundation
- Initial project structure
- Supabase connection
- Basic expediente creation

### Database schema (migrations 001–003)
- `fases` table with `nombre` and `orden`
- `transiciones_fase` table — explicit transition graph with `condicion` (JSONB)
- `expedientes` table with `fase_actual_id` FK (replaces generic `status` column)
- `pagos` table scoped per fase (`fase_id`, `monto`, `estado`)
- `expediente_fases` table — full phase history per expediente (`entrada_en`, `salida_en`, `ingresado_por`)
- `registro_auditoria` table with `user_id` and `accion`
- Seeded MAPE/CHT fases: INHGEOMIN → Publicación → Oposición → SERNA
- Seeded transition graph: each edge carries `{"requiere_pago": true}`

### Business logic
- `validatePaymentForPhase(expedienteId, faseId)` — payment check scoped per fase
- `logAction(expedienteId, accion, metadata, userId)` — audit trail with actor
- `advancePhase(expedienteId, userId?, transitionId?)` — executes a transition:
  reads workflow graph → validates conditions → closes/opens `expediente_fases` rows → logs audit

### Workflow engine (`modules/workflow.ts`)
- `getAvailableTransitions(faseOrigenId)` — reads `transiciones_fase` graph
- `getBlockingReasons(expedienteId, faseId, condicion)` — evaluates each condition key; document check stubbed
- `getNextActions(expedienteId)` — decision engine: returns `{ can_advance, blocking[], available_transitions[] }`

### Services
- `expedientesService.ts` — `createExpediente`, `getExpedientes`, `getExpedienteById` (with fase join)
- `fasesService.ts` — `getFases`, `getFaseById`

### API
- `GET  /api/expedientes` — list all expedientes with joined fase
- `POST /api/expedientes` — create expediente (body: `{ nombre }`)
- `GET  /api/expedientes/:id/next-actions` — returns decision result
- `POST /api/expedientes/:id/transition` — executes advance (body: `{ user_id?, transition_id? }`)
- All routes use `export const dynamic = 'force-dynamic'` (prevents build-time pre-render)

### Vercel deployment
- Supabase client uses a lazy Proxy — `createClient` deferred to first request
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set in
  Vercel → Project → Settings → Environment Variables (Production + Preview)

### Architecture
- Bilingual naming convention enforced: Spanish for DB + domain, English for code logic
- Documented in `/docs/architecture.md`

---

## In Progress
- Nothing active

---

## Known Issues
- Document check in `getBlockingReasons` is a stub — always returns `pending` for any `requiere_documentos` condition until the `documentos` table is built
- No Row Level Security (RLS) policies defined yet
- No user authentication implemented
- Vercel env vars must be configured manually in the dashboard — not in code

---

## Next Step
- Implement `documentos` table and real document check in `getBlockingReasons`
- Add RLS policies to all Supabase tables
- Implement Supabase Auth integration
- Add UI for advancing fases and managing pagos
