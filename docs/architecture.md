# System Architecture

## Description
Legal mining management system (MAPE / CHT).
The system manages mining formalization processes, tracking each project as an "expediente" (case file) through multiple legal and operational fases.

## Stack
- Frontend: Next.js (Vercel)
- Backend: Supabase (PostgreSQL, Auth, Storage)
- AI: Claude Code

---

## Language Convention (CRITICAL — see also ai-context.md)

| Layer | Language | Examples |
|---|---|---|
| AI prompts / docs (`/docs`) | English | This file |
| Code logic (functions, utilities) | English | `advancePhase()`, `getNextActions()` |
| Domain entity names | Spanish | `expediente`, `fase`, `pago` |
| Database tables and columns | Spanish | `fases`, `fase_actual_id`, `registro_auditoria` |
| JSONB condition keys | Spanish | `requiere_pago`, `requiere_documentos` |
| UI labels | Spanish | "Sin fase", "Expedientes" |
| API route nouns | Spanish | `/api/expedientes/:id/transition` |

**Hard rules:**
- Never translate domain concepts. `expediente` = always `expediente`. Never "case", "file", or "record".
- JSONB keys stored in the DB follow the same rule as columns: Spanish always.
- `condition.requiere_pago` ✅ — `condition.requires_payment` ❌

---

## Database Tables

| Table | Purpose |
|---|---|
| `expedientes` | Core case file; holds `fase_actual_id` FK |
| `fases` | Ordered workflow phases (`nombre`, `orden`) |
| `transiciones_fase` | Explicit transition graph with `condicion` JSONB |
| `pagos` | Payments scoped per expediente + fase |
| `expediente_fases` | Full fase history per expediente (timeline) |
| `registro_auditoria` | Append-only audit trail with `user_id` and `accion` |

---

## Workflow Engine

The core engine lives in `modules/workflow.ts` and `modules/expedientes.ts`.

**Decision flow:**
```
GET /api/expedientes/:id/next-actions
  → getNextActions(expedienteId)
      → getAvailableTransitions(fase_actual_id)   ← reads transiciones_fase graph
      → getBlockingReasons(expedienteId, faseId, condicion)  ← evaluates conditions
  → returns { can_advance, blocking[], available_transitions[] }
```

**Execution flow:**
```
POST /api/expedientes/:id/transition
  → advancePhase(expedienteId, userId?, transitionId?)
      → getNextActions()          ← validates conditions
      → close expediente_fases row (salida_en)
      → update expedientes.fase_actual_id
      → open new expediente_fases row (entrada_en, ingresado_por)
      → insert registro_auditoria (TRANSICION_FASE)
```

**Condition keys in `transiciones_fase.condicion`:**
- `requiere_pago: true` — checks `pagos` for a `completado` record for this fase
- `requiere_documentos: ["EIA"]` — checks `documentos` table (stubbed, not yet implemented)

---

## Core Modules
- Expedientes (gestión de casos)
- Pagos (validación por fase)
- Usuarios / Roles
- Documentos
- Permisos / Control de acceso

## Core Rules
- An expediente cannot advance to the next fase without payment validation
- Every fase must be fully validated before advancing
- Every action must be logged in `registro_auditoria`
- Backend is the source of truth (not frontend)

## Folder Structure
- `/app` → UI and routing
  - `page.tsx` — public landing page (Client Component, bilingual ES/EN)
  - `layout.tsx` — root layout; loads Inter via `next/font/google`
  - `globals.css` — CSS custom properties (design tokens) + all landing page styles
  - `expedientes/` — internal dashboard route (in progress)
  - `api/` — REST API routes
- `/modules` → business logic (`expedientes.ts`, `workflow.ts`)
- `/services` → external integrations (`supabase.ts`, `expedientesService.ts`, `fasesService.ts`)
- `/docs` → system memory and AI context
- `/supabase` → database schema and migrations (`001`, `002`, `003`)

## Frontend Design System
- Font: **Inter** (Google Fonts, loaded via `next/font/google`)
- Color tokens in `globals.css` `:root`: `--blue`, `--blue-dk`, `--blue-lt`, `--green`, `--amber`, `--t1/t2/t3`, `--bg`, `--bg2`, `--bg3`, `--border`
- Language toggle: React `useState<'es'|'en'>` + `localStorage` persistence; no CSS body-class trick
- Reference design: institutional style (white + `#1a56db` blue), inspired by Honduran government portal aesthetics

## Design Principles
- Modular architecture
- Clear separation of concerns
- Scalable and maintainable
