# Current State

## Last Updated
2026-04-26

## Current Module
Design system — CHT brand enforcement complete across all UI

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

### Design system (CHT brand enforcement — 2026-04-26)
- `app/globals.css` — Complete overhaul: `--cht-*` CSS variables + Tailwind v4 `@theme` token set
  - Primary palette: `primary-950` (#1F2A44) through `primary-50` (#F5F6F7)
  - Natural palette: `forest-800` (#2F5D50), `earth-50` (#F0EDE8), `earth-200` (#D8C3A5), etc.
  - Functional palette: `action-green`, `action-gold`, `action-red`, `action-blue`
  - Badge surface tokens: `badge-success-bg`, `badge-warning-bg`, `badge-danger-bg`, `badge-info-bg`
- `app/layout.tsx` — Fonts replaced: Geist → **Playfair Display** (headings) + **Inter** (UI/body)
- `app/page.tsx` — Background fixed: `bg-white` → `bg-primary-50`
- `components/ui/button.tsx` — Primary: `bg-primary-950`, `rounded-lg`, `shadow-sm` max
- `components/ui/card.tsx` — `bg-white border-[#E5E7EB] rounded-xl shadow-sm`
- All 11 landing components — purged every generic Tailwind color (`green-*`, `slate-*`, `amber-*`, `emerald-*`)
  - Alternating section backgrounds: `bg-primary-50` ↔ `bg-earth-50`
  - `font-black` → `font-bold` everywhere
  - `rounded-2xl`/`rounded-3xl` → `rounded-xl`/`rounded-lg`
  - Hero image: `/images/hero-rio-honduras.jpg` with correct filter treatment
- `DESIGN.md` — Consolidated with new brand DNA, updated all token values, added spacing + shadow rules
- `scripts/visual-guide.ts` — Empty placeholder for designer visual reference script

---

## In Progress
- Nothing active

---

## Known Issues
- Document check in `getBlockingReasons` is a stub — always returns `pending` for any `requiere_documentos` condition until the `documentos` table is built
- No Row Level Security (RLS) policies defined yet
- No user authentication implemented
- Hero image `/public/images/hero-rio-honduras.jpg` must be placed manually in repo

---

## Next Step
- Drop hero image into `public/images/hero-rio-honduras.jpg`
- Implement `documentos` table and real document check in `getBlockingReasons`
- Add RLS policies to all Supabase tables
- Implement Supabase Auth integration
- Add UI for advancing fases and managing pagos
- Populate `scripts/visual-guide.ts` with interactive token reference for designers
