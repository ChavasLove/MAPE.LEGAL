# System Architecture

## Description
MAPE.LEGAL — legal mining management platform (CHT / MAPE).
Manages mining formalization processes in Honduras, tracking each project as an `expediente` (case file) through legal and operational phases, and certifying the legal origin of gold for commercialization.

## Stack
- **Frontend/Backend**: Next.js 16.2.4 (App Router, Turbopack) on Vercel
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **IA**: Anthropic Claude Haiku — WhatsApp virtual assistant María
- **Email**: SendGrid REST API
- **WhatsApp**: Meta Cloud API v21.0 + Twilio (María bot)

---

## Language Convention (CRITICAL — see also ai-context.md)

| Layer | Language | Examples |
|---|---|---|
| Docs (`/docs`) | English | This file |
| Code logic (functions) | English | `advancePhase()`, `getNextActions()` |
| Domain entity names | Spanish | `expediente`, `fase`, `pago` |
| Database tables and columns | Spanish | `fases`, `fase_actual_id`, `registro_auditoria` |
| JSONB condition keys | Spanish | `requiere_pago`, `requiere_documentos` |
| UI labels | Spanish | "Sin fase", "Expedientes" |
| API route nouns | Spanish | `/api/expedientes/:id/transition` |

**Hard rules:**
- Never translate domain concepts. `expediente` = always `expediente`.
- `condition.requiere_pago` ✅ — `condition.requires_payment` ❌

---

## Folder Structure

```
/app              → Pages (App Router) and API routes
/modules          → Business logic (workflow.ts, expedientes.ts, types.ts)
/services         → External integrations (supabase, email, whatsapp, cms, dashboard)
/components       → UI components (landing/, ui/)
/scripts          → Utility scripts (seed, env check)
/docs             → System documentation and AI context
/supabase         → Database schema and migrations (001–009)
/public           → Static assets (images, dashboard prototype)
```

---

## Database Tables

### Workflow engine
| Table | Purpose |
|---|---|
| `expedientes` | Core case file; holds `fase_actual_id` FK and all progress fields |
| `fases` | Ordered workflow phases (`nombre`, `orden`) |
| `transiciones_fase` | Explicit transition graph with `condicion` JSONB |
| `pagos` | Payments scoped per expediente + fase |
| `expediente_fases` | Full fase history per expediente (timeline) |
| `registro_auditoria` | Append-only audit trail with `user_id` and `accion` |

### Dashboard / documents
| Table | Purpose |
|---|---|
| `hitos` | Payment milestones (3 per expediente); estados: `pendiente`, `cobrado`, `bloqueado` |
| `documentos` | Required documents; estados: `faltante`, `pendiente`, `verificado`, `rechazado` |
| `mensajes_wa` | WhatsApp document submissions with AI field extraction |
| `legalidad_items` | 5-component legality snapshot per expediente |
| `progress_fases` / `progress_subpasos` | Visual progress tracking |

### Admin & users
| Table | Purpose |
|---|---|
| `perfiles_profesionales` | Lawyers and environmental technicians |
| `user_roles` | App-level roles linked to auth.users |
| `roles` | Dynamic role catalog with JSON permissions |

### CMS & config
| Table | Purpose |
|---|---|
| `contenido_cms` | Landing page editable content |
| `configuracion_sistema` | Global system settings |
| `notificaciones` | Notification log (email / whatsapp / interna) |
| `contactos` | Landing page contact form submissions |

### Pilot core (migration 008–009)
| Table | Purpose |
|---|---|
| `clientes` | Minero entity; optionally linked to auth.users |
| `minas` | Mining site with UTM coordinates, area, mineral type |
| `contratos` | Service contract CHT ↔ client per expediente |
| `indice_legalidad` | Per-mine legality index, 5 components × 20 pts = 100 max |
| `transacciones_oro` | Gold sales; `total_usd` and `total_hnl` are generated columns |

### WhatsApp bot
| Table | Purpose |
|---|---|
| `conversaciones_whatsapp` | Message history per number (service-role only) |
| `transacciones_pendientes` | Short-lived confirmation records from María |

---

## Workflow Engine

**Decision flow:**
```
GET /api/expedientes/:id/next-actions
  → getNextActions(expedienteId)
      → getAvailableTransitions(fase_actual_id)   ← reads transiciones_fase graph
      → getBlockingReasons(expedienteId, faseId)  ← evaluates condicion JSONB
  → { can_advance, is_final, blocking[], available_transitions[] }
```

**Execution flow:**
```
POST /api/expedientes/:id/transition  { transition_id }
  → advancePhase(expedienteId, userId, transitionId)
      → getNextActions()              ← validates conditions
      → close expediente_fases row (salida_en)
      → update expedientes.fase_actual_id
      → open new expediente_fases row (entrada_en, ingresado_por)
      → insert registro_auditoria (TRANSICION_FASE)
      → revert expedientes.fase_actual_id if insert fails
```

**Condition keys in `transiciones_fase.condicion`:**
- `requiere_pago: true` — checks `pagos` for a `completado` record for this fase
- `requiere_documentos: ["RTN"]` — checks `documentos` table (estado `verificado`)

---

## Authentication Flow

```
POST /api/auth/login  { email, password }
  → supabase.auth.signInWithPassword()
  → fetch user_roles for role
  → set httpOnly cookies: auth-token, auth-role, user-email
  → return { role } for client-side redirect

proxy.ts (Next.js 16 middleware replacement)
  → reads auth-token + auth-role cookies
  → guards /admin (admin only), /dashboard (abogado/tecnico/admin), /portal (cliente)
  → unauthenticated → redirect /login?from=<path>
```

---

## Core Rules
- An expediente cannot advance without all required documents and payments validated
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
