# Current State

## Last Updated
2026-05-01

## Current Module
Landing page — public-facing marketing page complete

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

### Architecture
- Bilingual naming convention enforced: Spanish for DB + domain, English for code logic
- Documented in `/docs/architecture.md`

### Landing page (`app/page.tsx`)
- Full bilingual (ES/EN) landing page implemented as Next.js Client Component
- Language persisted in `localStorage`; defaults to Spanish
- Sections: Nav, Hero (with animated dashboard mockup), Stats bar, How it works, Traceability (with progress card), 5 Fases, Quote, CTA form, Footer
- CTA form uses React state — no external service wired yet (shows success message on submit)
- Font switched from Geist to Inter via `next/font/google` in `layout.tsx`
- All design tokens (colors, spacing) in `globals.css` as CSS custom properties
- Build passes: Turbopack ✓ · TypeScript ✓ · 6 routes generated ✓

---

## In Progress
- Nothing active

---

## Known Issues
- Document check in `getBlockingReasons` is a stub — always returns `pending` for any `requiere_documentos` condition until the `documentos` table is built
- No Row Level Security (RLS) policies defined yet
- No user authentication implemented

---

## Next Step
- Wire CTA form to a real backend (Supabase table or WhatsApp API)
- Implement `documentos` table and real document check in `getBlockingReasons`
- Add RLS policies to all Supabase tables
- Implement Supabase Auth integration
- Add UI for advancing fases and managing pagos (dashboard view at `/expedientes`)
