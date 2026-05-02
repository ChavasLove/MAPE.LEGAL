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
