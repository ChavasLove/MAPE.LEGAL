# System Architecture

## Description
Legal mining management system (MAPE / CHT).
The system manages mining formalization processes, tracking each project as an "expediente" (case file) through multiple legal and operational fases.

## Stack
- Frontend: Next.js 16.2.4 App Router + Turbopack (Vercel)
- Backend: Supabase (PostgreSQL + Auth + RLS)
- AI: Claude Haiku (`claude-haiku-4-5-20251001`) — María assistant + onboarding field extraction + broadcast commentary
- Messaging: Twilio (inbound WhatsApp) + Meta Cloud API v21.0 (outbound WhatsApp) + SendGrid (email)

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

### Workflow core
| Table | Purpose |
|---|---|
| `expedientes` | Core case file; holds `fase_actual_id` FK |
| `fases` | Ordered workflow phases (`nombre`, `orden`) |
| `transiciones_fase` | Explicit transition graph with `condicion` JSONB |
| `pagos` | Payments scoped per expediente + fase |
| `expediente_fases` | Full fase history per expediente (timeline) |
| `registro_auditoria` | Append-only audit trail with `user_id` and `accion` |

### People & assignments
| Table | Purpose |
|---|---|
| `clientes` | Miners and landowners — `telefono_whatsapp`, `dpi`, `municipio`, `tipo_mineral`, `situacion_tierra` |
| `perfiles_profesionales` | Lawyers, PSA staff |
| `asignaciones` | Abogado + PSA assignment per expediente |
| `user_roles` | User ↔ role mapping |
| `roles` | Role definitions |

### Content & config
| Table | Purpose |
|---|---|
| `contenido_cms` | CMS content blocks (editable from admin panel) |
| `configuracion_sistema` | Key-value config store — includes `broadcast_audience`, `broadcast_time` |
| `notificaciones` | System notifications |
| `contactos_web` | Web contact form submissions |

### Documents & tasks
| Table | Purpose |
|---|---|
| `documentos` | Documents per expediente (estado: verificado / rechazado / pendiente) |
| `mensajes` | Internal messages |
| `hitos_pago` | Payment milestones |
| `tareas` | 54-step task list per expediente |

### Mining operations
| Table | Purpose |
|---|---|
| `minas` | Mine coordinates, environmental category, legal status |
| `contratos` | Consulting, mining society, leasehold contracts |
| `indice_legalidad` | 5-component legality index per mina (0–100%) |
| `transacciones_oro` | Gold traceability |

### WhatsApp & broadcast
| Table | Purpose |
|---|---|
| `conversaciones_whatsapp` | Chat history per `numero_whatsapp` (role + content) |
| `transacciones_pendientes` | Pending confirmations from WhatsApp ("Listo" + "Confirmas") |
| `usuarios_broadcast` | Broadcast subscriber list with `rol` (minero/comprador/tecnico/admin) |
| `daily_report_config` | Per-metric config (enabled, currency, order_index) |
| `precios_diarios` | Daily gold/silver/copper/USD-HNL prices |
| `broadcast_log` | Log of every broadcast run |

### Admin & onboarding
| Table | Purpose |
|---|---|
| `admin_actions` | Log of every admin command executed via María |
| `onboarding_states` | Onboarding progress per phone number (estado + datos JSONB) |

---

## Workflow Engine

The core engine lives in `modules/workflow.ts` and `modules/expedientes.ts`.

**Decision flow:**
```
GET /api/expedientes/:id/next-actions
  → getNextActions(expedienteId)
      → getAvailableTransitions(fase_actual_id)   ← reads transiciones_fase graph
      → getBlockingReasons(expedienteId, faseId, condicion)  ← evaluates conditions
  → returns { can_advance, is_final, blocking[], available_transitions[] }
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
      [rollback expedientes.fase_actual_id if expediente_fases insert fails]
```

**Condition keys in `transiciones_fase.condicion`:**
- `requiere_pago: true` — checks `pagos` for a `completado` record for this fase
- `requiere_documentos: ["EIA"]` — checks `documentos` table (estado `verificado`)

---

## María WhatsApp Assistant (`app/api/whatsapp/route.js`)

Execution order per incoming message:
1. Admin passphrase report (`TENKA-2026`) → early exit
2. `expediente [id]` sub-command → early exit
3. Admin command interpreter (`interpretAndExecute`) → early exit if commands found
4. Onboarding check — new numbers routed to `handleOnboarding` → early exit
5. Normal María flow: history + client context + Claude call + response

---

## Folder Structure

```
/app
  /api
    /auth              login, logout, me
    /expedientes       CRUD + transition + next-actions
    /documentos        verify/reject
    /contacto          web contact form
    /email             send via SendGrid
    /whatsapp          Twilio webhook (María assistant)
    /webhook/whatsapp  Meta Cloud webhook
    /admin             cms, config, roles, usuarios
    /broadcast         run (cron), config, prices, status
  /admin               admin UI pages
  /dashboard           abogado/admin UI pages
  /portal              client read-only portal
  /login               unified login page
/modules
  workflow.ts          getNextActions, getBlockingReasons, getAvailableTransitions
  expedientes.ts       advancePhase, validatePaymentForPhase, logAction
  types.ts             domain types
/services
  adminSupabase.ts     service-role Supabase client (RLS bypass)
  supabase.ts          anon Supabase client
  emailService.ts      SendGrid — 6 templates
  whatsappService.ts   Meta Cloud API v21.0
  cmsService.ts        contenido_cms read/write
  configService.ts     configuracion_sistema + daily_report_config
  dashboardService.ts  expediente data for dashboard
  userService.ts       usuarios_broadcast CRUD
  pricingService.ts    goldapi.io + exchangerate-api
  broadcastService.ts  generateDailyMessage, sendDailyBroadcast, getLastBroadcastLog
  adminCommandService.ts  deterministic admin command interpreter
  onboardingService.ts    5-state onboarding machine
/jobs
  dailyBroadcast.ts    runDailyBroadcast() orchestrator
/components
  /landing             11 responsive landing page components
/supabase
  /migrations          001–010 SQL migration files
/scripts
  seed-super-admin.mjs  idempotent super admin seed
/docs
  architecture.md      this file
  current-state.md     production readiness checklist
  tasks.md             pending and completed work
  ai-context.md        language + coding conventions
/public
  /images              8 brand images
```

---

## Core Rules
- An expediente cannot advance to the next fase without payment validation
- Every fase must be fully validated before advancing
- Every action must be logged in `registro_auditoria`
- Backend is the source of truth — never trust frontend state
- All server DB operations use service-role client (RLS bypass) — no anon client on server
- TypeScript strict mode — zero compile errors enforced
- Admin commands intercepted server-side before Claude is called — María never executes config changes herself
