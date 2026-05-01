# Current State

## Last Updated
2026-05-01

## System Status: Production-ready, awaiting Vercel env vars

---

## Completed

### Project foundation
- Next.js 16.2.4 App Router + Turbopack, Vercel hosting
- Supabase (PostgreSQL + Auth + RLS) — service role client for all server ops
- TypeScript strict mode — zero compile errors as of 2026-05-01

### Database schema (migrations 001–010)

| Migration | Tables added |
|---|---|
| 001–003 | `fases`, `transiciones_fase`, `expedientes`, `pagos`, `expediente_fases`, `registro_auditoria` |
| 004 | `perfiles_profesionales`, `asignaciones`, `documentos`, `mensajes`, `hitos_pago`, `tareas` |
| 005 | `user_roles` |
| 006 | `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones` |
| 007 | `contactos_web` |
| 008 | `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`, `conversaciones_whatsapp`, `transacciones_pendientes` |
| 009 | `usuarios_broadcast`, `daily_report_config`, `precios_diarios`, `broadcast_log` |
| 010 | `admin_actions`, `onboarding_states`; fixes `clientes.telefono_whatsapp/situacion_tierra/tipo_mineral` |

### Authentication & routing
- Unified login: `POST /api/auth/login` → httpOnly cookies (`auth-token`, `auth-role`, `user-email`)
- 4 roles: `admin`, `abogado`, `tecnico_ambiental`, `cliente`
- Route guard: `proxy.ts` (Next.js 16 — replaces deprecated `middleware.ts`)
- Admin-only routes, dashboard roles (abogado/tecnico/admin), portal (cliente only)
- Public routes: landing, login, webhook endpoints, broadcast/run (CRON_SECRET gated)

### Workflow engine (`modules/`)
- `modules/workflow.ts` — `getNextActions()`, `getBlockingReasons()`, `getAvailableTransitions()`
- `modules/expedientes.ts` — `advancePhase()`, `validatePaymentForPhase()`, `logAction()`
- Real document check against `documentos` table (estado `verificado`)
- `is_final: true` when no outgoing transitions
- Explicit `transition_id` required when multiple paths available
- Phase rollback on failed `expediente_fases` insert

### Dashboard & portal (UI)
- `/dashboard` — expediente list, detail (4 tabs), messages, stats (abogado/admin)
- `/portal` — client read-only view: estado, hitos, documentos
- `/admin` — roles, CMS editor, config, usuarios, profesionales panels
- `/login` — unified login with role-based redirect

### Services

| Service | Purpose |
|---|---|
| `services/emailService.ts` | SendGrid REST; 6 templates (avance, rechazo, pago, contacto interno, acuse, bienvenida) |
| `services/whatsappService.ts` | Meta Cloud API v21.0 — send text, template, webhook parser |
| `services/cmsService.ts` | `contenido_cms` read/write |
| `services/configService.ts` | `configuracion_sistema` + `daily_report_config` (enableMetric, disableMetric, updateMetricCurrency, updateAudience, updateSchedule) |
| `services/dashboardService.ts` | Expediente data for dashboard (`DashExpediente`, `DashHito`, `DashDoc`) |
| `services/userService.ts` | `usuarios_broadcast` CRUD — getOrCreateUserByPhone, assignRole, getActiveSubscribers |
| `services/pricingService.ts` | goldapi.io + exchangerate-api — fetch gold/silver/copper/USD-HNL, store in `precios_diarios` |
| `services/broadcastService.ts` | generateDailyMessage (Claude commentary), sendDailyBroadcast (Meta API), log |
| `services/adminCommandService.ts` | Deterministic admin command interpreter — parse, validate, execute, log |
| `services/onboardingService.ts` | 5-state onboarding machine — ASK_NAME→ASK_ID→ASK_LOCATION→ASK_ROLE→COMPLETE |
| `services/adminSupabase.ts` | Service-role Supabase client (RLS bypass for server ops) |

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Unified login → cookies |
| `/api/auth/logout` | POST | Clear cookies |
| `/api/auth/me` | GET | Current session |
| `/api/expedientes` | GET/POST | List + create |
| `/api/expedientes/[id]` | GET | Detail |
| `/api/expedientes/[id]/transition` | POST | Advance phase |
| `/api/expedientes/[id]/next-actions` | GET | Workflow state |
| `/api/documentos/[id]` | PATCH | Verify/reject document |
| `/api/contacto` | POST | Contact form → email to gerencia@mape.legal |
| `/api/email/send` | POST | Send email via SendGrid |
| `/api/whatsapp` | GET/POST | Twilio webhook — María assistant |
| `/api/whatsapp/send` | POST | Send outbound WhatsApp (Meta) |
| `/api/webhook/whatsapp` | GET/POST | Meta Cloud webhook |
| `/api/admin/cms` | GET/POST/DELETE | CMS content editor |
| `/api/admin/config` | GET/PATCH | System config |
| `/api/admin/roles` | GET/POST | Role list + create |
| `/api/admin/roles/[id]` | PATCH/DELETE | Role edit/delete |
| `/api/admin/usuarios` | GET/POST | User list + create (POST auto-sends welcome email) |
| `/api/admin/usuarios/[id]` | PATCH/DELETE | User management |
| `/api/broadcast` | GET | Broadcast status (last run, subscriber count, latest prices) |
| `/api/broadcast/run` | POST | Trigger daily broadcast (CRON_SECRET header) |
| `/api/broadcast/config` | GET/PATCH | Metric config (enable/disable/currency/order) |
| `/api/broadcast/prices` | GET | Price history (?days=N, ?latest=true) |

### María WhatsApp assistant (`app/api/whatsapp/route.js`)
- Model: `claude-haiku-4-5-20251001`
- Honduran persona — tuteo, local expressions, max 5 lines, no emojis
- Execution order per incoming message:
  1. Admin passphrase report (TENKA-2026) → early exit
  2. `expediente [id]` sub-command → early exit
  3. Admin command interpreter (`interpretAndExecute`) → early exit if commands found
  4. Onboarding check — new numbers routed to `handleOnboarding` → early exit
  5. Normal María flow: history + client context + Claude call + response
- Contact forwarding: callback trigger phrases → Twilio alert to Willis, non-fatal
- Transaction trigger: "Listo" + "Confirmas" → insert `transacciones_pendientes`
- XML safety: all TwiML content via `esc()`

### Admin command interpreter (`services/adminCommandService.ts`)
- Pre-Claude interception for users with `usuarios_broadcast.rol = 'admin'`
- Rule-based NL parser with accent normalisation, multi-command support
- Allowlists: metrics `[gold,silver,usd_hnl,copper]`, roles `[minero,comprador,tecnico,admin]`
- All executions logged to `admin_actions` (non-fatal)
- Returns `null` if no commands → falls through to Claude normally

### Onboarding state machine (`services/onboardingService.ts`)
- Triggered for new numbers not in `clientes` and not in `onboarding_states`
- Admins bypass onboarding
- Claude Haiku extracts fields from natural responses; 1/2/3 for role requires no LLM
- Multi-field: extracts and saves all present fields per message, skips answered steps
- On COMPLETE: writes to `clientes` + `usuarios_broadcast`

### Daily broadcast system
- `jobs/dailyBroadcast.ts` → `runDailyBroadcast()` — fetch prices → store → generate → send → log
- `services/pricingService.ts` — goldapi.io for metals, exchangerate-api for USD/HNL
- `services/broadcastService.ts` — Claude Haiku writes a 2-sentence market commentary
- Config stored in `daily_report_config` — per-metric enabled/currency/order
- Audience stored in `configuracion_sistema.broadcast_audience`
- Schedule stored in `configuracion_sistema.broadcast_time`

### Landing page
- 11 responsive components in `components/landing/`
- Mobile-first: scaled typography, conditional line breaks, flex-wrap lists
- 8 images from `public/images/` (no duplicates)
- Open Graph + Twitter Card (`app/layout.tsx`)

### Design system (DESIGN.md)
- Tailwind v4 with `@theme inline` — no `tailwind.config.js`
- Playfair Display (headings) + Inter (UI/body)
- Token set: primary navy, deep navy, slate, forest, earth, sand + semantic badges

---

## Known Issues / Accepted Limitations
- `ADMIN_PASSPHRASE` (`TENKA-2026`) hardcoded in `route.js` by operator preference
- `expediente [id]` sub-command open to any number (intentional — admin UX)
- `transacciones_pendientes` columns `mensaje_original`/`respuesta_asistente` not in migration DDL (added as hotfix)

---

## Required Vercel Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
SENDGRID_FROM_NAME
WHATSAPP_TOKEN
WHATSAPP_PHONE_ID
WHATSAPP_VERIFY_TOKEN
ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
GOLDAPI_KEY
EXCHANGE_RATE_API_KEY   (optional — free tier fallback)
CRON_SECRET
```
