# MAPE.LEGAL — Complete Code Analysis Report

**Architecture Review, Dashboard Gaps, Permit System Critique & Bug Analysis**

- **Project:** MAPE.LEGAL v1.1 — Piloto Iriona 2026
- **Owner:** Corporación Hondureña Tenka, S.A. (CHT)
- **Date:** May 3, 2026
- **Analysts:** 4 parallel specialist agents (Architecture, Dashboard, Permit System, Bug Hunter)
- **Files Reviewed:** 67+ source files, 11 database migrations, full schema

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overall Architecture Assessment](#2-overall-architecture-assessment)
3. [Employee Login Structure — Recommendations](#3-employee-login-structure--recommendations)
4. [Dashboard: Quarry Data & Client Tables](#4-dashboard-quarry-data--client-tables)
5. [Permit Follow-Up System Critique](#5-permit-follow-up-system-critique)
6. [Why It's Not Working — Root Cause Analysis](#6-why-its-not-working--root-cause-analysis)
7. [Complete Bug Inventory](#7-complete-bug-inventory)
8. [Prioritized Fix Roadmap](#8-prioritized-fix-roadmap)
9. [Production Readiness Scorecard](#9-production-readiness-scorecard)

---

## 1. Executive Summary

MAPE.LEGAL is a Next.js 16 + Supabase application for managing mining permit formalization (MAPE) in Honduras. It features a WhatsApp AI assistant ("Maria"), a phase-based workflow engine for permit tracking, a dashboard for employees, and an admin panel. After analysis by 4 specialist agents across 67+ files:

### The Bottom Line

The system is **NOT production-ready**. It has solid architectural foundations and many well-designed components, but critical bugs in authentication, missing middleware, a broken WhatsApp integration, and a permit workflow with race conditions make it unsuitable for the Iriona 2026 pilot without significant fixes.

### Verdicts at a Glance

| Dimension | Verdict | Score |
|---|---|---|
| Authentication & Login | POOR — `proxy.ts` is dead code, no middleware, cookie mismatch | 3.5/10 |
| Dashboard — Client Tables | PARTIAL — Works for clients, missing many columns | 7/10 |
| Dashboard — Quarry/Mine Data | ZERO — `minas` table has no UI at all | 0/10 |
| Permit Follow-Up System | AVERAGE — Good concept, 4 critical blockers | 3/10 |
| WhatsApp/Maria Bot | BROKEN — Import errors, env var mismatches | 2/10 |
| **Overall Production Readiness** | **NOT READY** | **3/10** |

### Top 5 Critical Issues (Fix These First)

1. **No `middleware.ts`** — `proxy.ts` exists but is never executed. All routes are publicly accessible.
2. **Cookie name mismatch** — Login sets `user-token`, layouts read `auth-token`. Real users can't stay logged in.
3. **No API route auth** — Not a single API endpoint validates authentication tokens.
4. **WhatsApp webhook broken** — Imports non-existent `supabase` export; env var names don't match.
5. **Permit workflow has race conditions** — No database locking; concurrent transitions can corrupt state.

---

## 2. Overall Architecture Assessment

### 2.1 Tech Stack

| Component | Technology | Assessment |
|---|---|---|
| Framework | Next.js 16.2.4 (App Router) | Good choice, latest version |
| Database | Supabase (PostgreSQL + Auth) | Solid for this use case |
| Auth | Supabase Auth + custom cookies | Partially implemented |
| Frontend | React 19 + Tailwind v4 | Modern, clean |
| AI | Anthropic Claude (Maria bot) | Good choice |
| Email | SendGrid REST API | Properly configured |
| WhatsApp | Meta Cloud API + Twilio | Dual approach, well-designed |
| Hosting | Vercel + Supabase | Appropriate stack |

### 2.2 Architecture Strengths

- **Clean separation of concerns** — Services, modules, API routes, and UI are well-organized
- **RLS on all tables** — Row Level Security is properly enabled with role-based policies
- **Good TypeScript discipline** — Well-defined types in `modules/types.ts`
- **Phase-based workflow engine** — Correctly identifies the need for a state machine
- **Dual Supabase client pattern** — Anon client for auth, service role for admin ops
- **Design system** — Comprehensive DESIGN.md with tokens, colors, typography
- **Seed data** — Demo data for 4 expedientes, 4 clients, 4 mines pre-loaded

### 2.3 Architecture Weaknesses

- **`proxy.ts` is dead code** — Next.js never executes it. No `middleware.ts` exists.
- **Dual login system** — `/api/auth/login` AND `/api/admin/auth/login` overlap
- **No token refresh** — Sessions die after 1 hour with no graceful handling
- **No rate limiting** — Login endpoints vulnerable to brute force
- **Hardcoded credentials** — Admin password `'jackjack'` in seed script
- **Service role key overused** — Bypasses RLS, makes security testing impossible
- **No error boundaries** — API routes return generic 500s
- **No observability** — Console logs only, no metrics

---

## 3. Employee Login Structure — Recommendations

### 3.1 Current Login Flow

```
Employee → /login → POST /api/auth/login
  → Supabase signInWithPassword
  → Fetch role from user_roles (server-side, service role)
  → Set auth-token (httpOnly) + auth-role + user-email
  → Redirect by role: admin→/admin, abogado→/dashboard, etc.
```

### 3.2 What Works

- Supabase Auth handles credential validation correctly (bcrypt hashing)
- httpOnly cookies protect against XSS
- Role-based redirect is clean and intuitive
- Unified login page for all 4 roles
- `activo` flag allows account deactivation

### 3.3 What's Broken

| Issue | Severity | File |
|---|---|---|
| `proxy.ts` never executes — no middleware protection | CRITICAL | `proxy.ts` |
| Cookie name mismatch (`user-token` vs `auth-token`) | CRITICAL | `login/route.ts` |
| No token verification in API routes | CRITICAL | All API files |
| No token refresh — 1-hour expiry | HIGH | `login/route.ts` |
| No rate limiting | HIGH | `login/route.ts` |
| Hardcoded admin password | HIGH | `seed-super-admin.mjs` |
| Legacy admin auth endpoints redundant | MEDIUM | `admin/auth/*` |
| No password reset flow | MEDIUM | — |
| No session timeout warning | MEDIUM | — |
| No login audit trail | MEDIUM | — |

### 3.4 Recommended Login Structure

```
lib/
  auth.ts              # Auth helper: requireAuth()
  rateLimit.ts         # Rate limiting utility
  permissions.ts       # Permission checking from roles table
  session.ts           # Session refresh logic
middleware.ts          # Edge middleware (REPLACES proxy.ts)
hooks/
  useSessionRefresh.ts # Client-side token refresh every 50min
  useSessionTimeout.ts # Session expiry warning
```

```
Employee → /login
  → Rate limit check (5 attempts / 15 min)
  → Supabase signInWithPassword
  → Fetch role from user_roles
  → Check activo flag
  → Set auth-token (httpOnly, access_token, 1hr)
  → Set auth-refresh (httpOnly, refresh_token, 30 days)
  → Set auth-role (httpOnly)
  → Set user-email (SIGNED, not httpOnly)
  → Log login attempt to registro_auditoria
  → Redirect by role

Post-Login:
  → useSessionRefresh hook (every 50 min)
  → POST /api/auth/refresh
  → On failure: redirect to /login?error=session_expired
```

### 3.5 Immediate Actions

1. Create `middleware.ts` from `proxy.ts` content (30 min)
2. Fix cookie name — `user-token` → `auth-token` (5 min)
3. Add rate limiting to login (~30 lines)
4. Delete legacy admin auth endpoints (3 files)
5. Add `/api/auth/refresh` endpoint + hook
6. Move seed credentials to env vars

---

## 4. Dashboard: Quarry Data & Client Tables

### 4.1 Can the Dashboard See Quarry (Mina) Data? — NO

The `minas` table exists in the database with full schema (coordinates, area, mineral type, concession type) and 4 seeded demo mines. But there is absolutely zero UI representation:

| Check | Result |
|---|---|
| Page at `/dashboard/minas`? | No |
| API at `/api/minas`? | No |
| Nav item in sidebar? | No |
| Referenced in any page/service? | No (only in migrations) |
| Maria writes to `minas` table? | No |

**The `minas` table is completely orphaned.**

### 4.2 Can the Dashboard See Client Tables? — YES (Partially)

The `/dashboard/clientes` page works and displays:

- `nombre`, `municipio`, `tipo_mineral`, `situacion_tierra`, `telefono_whatsapp`
- Registration date
- Linked expediente (if any)
- Smart stats: "N registrados · X sin expediente · Y con expediente"

**But these DB columns are hidden:**

- `dpi`, `rtn` (identity/tax documents)
- `email`
- `departamento`
- `tipo_minero` (artesanal / pequena_escala / mediana_empresa)
- `activo` status
- `notas`

### 4.3 Is Maria's Data Connected? — YES for Clients, NO for Mines

```
WhatsApp → Maria (Claude AI) → clientes table → /dashboard/clientes ✓ WORKS
WhatsApp → Maria → minas table → /dashboard/minas ✗ BROKEN (no UI, Maria doesn't write mines)
```

Maria registers clients through 3 paths (direct, AI extraction, onboarding state machine). All write to `clientes` correctly. But Maria **never** writes to the `minas` table.

### 4.4 DB Table → UI Mapping

| # | DB Table | Has UI? | Severity | Notes |
|---|---|---|---|---|
| 1 | `expedientes` | YES Full | None | Complete CRUD + detail with 4 tabs |
| 2 | `clientes` | YES Partial | Low | Summary table, missing detail view |
| 3 | `minas` | NO | CRITICAL | Full schema, 4 seed records, zero UI |
| 4 | `contratos` | NO | HIGH | Contracts linked to clients + mines |
| 5 | `indice_legalidad` | PARTIAL | Medium | Shown per-expediente, not per-mine |
| 6 | `transacciones_oro` | NO | HIGH | Gold sales — financial data invisible |
| 7 | `conversaciones_whatsapp` | NO | Medium | Only document feed shown |
| 8 | `transacciones_pendientes` | NO | Medium | Pending confirmations invisible |

**8 of 15 core tables have NO UI representation.**

### 4.5 Recommendations

**Week 1 — Mine Visibility (CRITICAL)**

1. Create `app/api/minas/route.ts` — GET all minas with client join
2. Create `app/dashboard/minas/page.tsx` — Table with name, code, coordinates, area, mineral, status, linked client
3. Add Minas to sidebar nav in `layout.tsx`
4. Update clientes page to show mine count per client

**Week 2 — Connect Maria to Mines**

5. Extend onboarding flow: ask for mine location/area after client registration
6. Add mine insert logic to `onboardingService.ts`

**Weeks 3-4 — Additional Data Views**

7. Create Contratos page
8. Create Transacciones de Oro page
9. Add Transacciones Pendientes panel

---

## 5. Permit Follow-Up System Critique

### 5.1 What Is the Permit Follow-Up System?

The "permit follow-up system" tracks mining permits (`expedientes`) through a phase-based workflow:

```
Fase 0: Onboarding → Fase 1: INHGEOMIN → Fase 2: Publicacion → Fase 3: Oposicion → Fase 4: SERNA → Final
```

Each phase has required documents and payments. The workflow engine checks conditions before allowing advancement.

### 5.2 Overall Verdict: AVERAGE (3/10 Production Readiness)

Good conceptual foundation with clean TypeScript architecture, but **4 critical production blockers** make it unsuitable for the 60-miner Iriona pilot without fixes.

### 5.3 What's Working Well

- Clean API: `GET /next-actions` returns `{ can_advance, is_final, blocking[], available_transitions[] }`
- Condition-based blocking: checks documents + payments before allowing transition
- Phase history tracking with entry/exit timestamps
- Multi-path disambiguation when multiple transitions available
- WhatsApp webhook foundation
- RLS security on all tables

### 5.4 Critical Production Blockers

| # | Issue | File | Impact |
|---|---|---|---|
| 1 | **Dual Schema Desynchronization** | `modules/expedientes.ts:86-92` | `advancePhase()` updates `fase_actual_id` (workflow) but NEVER updates `fase_numero`, `estado`, `progress_fases` (dashboard). After one transition, dashboard shows stale data. |
| 2 | **Race Conditions** | `modules/expedientes.ts:38-123` | No `SELECT FOR UPDATE`, no advisory locks, no RPC. Two concurrent `POST /transition` requests can corrupt the same permit. |
| 3 | **Fake "Revert" Logic** | `modules/expedientes.ts:96-109` | Compensating update on history-insert failure can itself fail. If it fails, permit is in new phase with no history record. |
| 4 | **Notifications Never Triggered** | `services/whatsappService.ts:73-100` | `notifyExpedienteAvance()`, `emailExpedienteAvance()` etc. exist as polished templates but are NEVER called by the workflow engine. Phase transitions happen silently. |

### 5.5 High-Severity Gaps

| # | Issue | Severity |
|---|---|---|
| 5 | Document upload doesn't auto-link to `documentos` table — manual assignment required | HIGH |
| 6 | No escalation/SLA tracking — `fecha_vencimiento` exists but never checked | HIGH |
| 7 | No payment API — `pagos` table checked but no endpoint to create/update payments | HIGH |
| 8 | Audit trail incomplete — only `TRANSICION_FASE` logged; document verification, payment, notification events missing | HIGH |
| 9 | No completion/archival lifecycle — permits can advance but never formally complete | HIGH |

### 5.6 File-by-File Critique

| File | Lines | Issue | Severity |
|---|---|---|---|
| `modules/expedientes.ts` | 87-92 | Only updates `fase_actual_id`, not dashboard columns | CRITICAL |
| `modules/expedientes.ts` | 96-109 | Revert is compensatory, not transactional | CRITICAL |
| `modules/expedientes.ts` | 38-123 | No concurrency control | CRITICAL |
| `modules/expedientes.ts` | 111-120 | Audit log is fire-and-forget | MEDIUM |
| `modules/workflow.ts` | 48-49 | Only `'verificado'` passes; `'pendiente'` treated same as `'faltante'` | MEDIUM |
| `modules/types.ts` | 11-14 | Conditions only support payment + docs; no approval gates, time conditions | MEDIUM |
| `modules/types.ts` | 52-55 | `AccionAuditoria` too small — missing document, payment, notification events | MEDIUM |
| `app/api/expedientes/[id]/transition` | 1-25 | No authentication check | CRITICAL |
| `app/api/documentos/[id]` | 1-27 | No authentication check + no audit logging | CRITICAL |
| `services/whatsappService.ts` | 73-100 | Notification templates exist but never called | CRITICAL |

### 5.7 Recommendations

**Phase 1 — Critical Fixes (Must-Have Before Production)**

1. Unify the schema: either single source of truth or database trigger to sync
2. Add concurrency control: `SELECT ... FOR UPDATE` or Supabase RPC with transaction
3. Replace compensating revert with atomic Postgres function
4. Add authentication to ALL mutation APIs
5. Wire up notifications: call templates from workflow engine

**Phase 2 — High-Impact Features (1-2 Sprints)**

6. Auto-link WhatsApp uploads by phone number → cliente → expediente
7. Build payment recording API with amount validation
8. Add SLA/escalation cron job for overdue phases
9. Complete audit trail for all mutation events
10. Add completion/archival lifecycle

---

## 6. Why It's Not Working — Root Cause Analysis

### Primary Root Cause: Authentication Is Fundamentally Broken

Three interconnected failures:

1. **No middleware** — `proxy.ts` exists but Next.js never runs it. There is no `middleware.ts` file. Zero route protection.
2. **Cookie name mismatch** — Login routes set `user-token` (per BugFinder), but layouts read `auth-token`. Users log in successfully, then immediately get kicked back to `/login`.
3. **No token verification** — Layouts only check cookie *presence*, not *validity*. API routes don't validate tokens at all.

**Result:**

- Anyone can access any page (no middleware)
- Real users can't access protected pages (cookie mismatch)
- Auth is trivially bypassable (no token verification)

### Secondary Root Cause: WhatsApp Bot Is Broken

- Webhook imports `{ supabase }` from `services/supabase.ts`, but that file only exports `getClient()` — runtime import crash
- Environment variable names don't match (`.env.example` has `WHATSAPP_ACCESS_TOKEN`, code uses `WHATSAPP_TOKEN`)

### Tertiary Root Cause: Permit Workflow Data Sync

After advancing a permit's phase, the dashboard still shows the old phase because `advancePhase()` only updates the workflow column, not the dashboard display columns.

---

## 7. Complete Bug Inventory

### Critical Bugs (System Won't Work)

| ID | Bug | File | Fix Effort |
|---|---|---|---|
| C1 | `proxy.ts` is dead code — Next.js never executes it, no `middleware.ts` exists | `proxy.ts` | 30 min |
| C2 | Cookie name mismatch — Login sets `user-token`, layouts read `auth-token` | `login/route.ts` | 5 min |
| C3 | Admin login redirects to `/dashboard` instead of `/admin` | `admin/auth/login/route.ts` | 1 min |
| C4 | Logout returns `redirect()` on POST — unreliable cookie clearing | `logout/route.ts` | 15 min |
| C5 | WhatsApp imports non-existent `supabase` export — runtime crash | `services/supabase.ts` | 2 min |
| C6 | WhatsApp env var names don't match — `WHATSAPP_TOKEN` vs `WHATSAPP_ACCESS_TOKEN` | `services/whatsappService.ts` | 10 min |

### High Severity (Major Features Broken)

| ID | Bug | File | Fix Effort |
|---|---|---|---|
| H1 | Missing `jobs/dailyBroadcast.ts` path resolution | `api/broadcast/run/route.ts` | 10 min |
| H2 | Claude model name is non-existent | `services/onboardingService.ts` | 2 min |
| H3 | Admin roles DELETE handler lacks `return` statement | `api/admin/roles/[id]/route.ts` | 2 min |
| H4 | Type import conflict on `fase` property | `app/expedientes/page.tsx` | 20 min |
| H5 | `check-env.mjs` doesn't match actual env vars | `scripts/check-env.mjs` | 10 min |
| H6 | `broadcastService` references possibly non-existent column | `services/broadcastService.ts` | 10 min |
| H7 | Price widgets show error on first boot | `components/landing/PriceWidgets.tsx` | 15 min |
| H8 | Admin broadcast command fires without awaiting | `services/adminCommandService.ts` | 10 min |

### Medium Severity (Degraded Functionality)

| ID | Bug | File | Fix Effort |
|---|---|---|---|
| M1 | Admin usuarios page sends DELETE but API has no DELETE handler | `api/admin/usuarios/[id]/route.ts` | 10 min |
| M2 | `whatsapp/route.js` is JavaScript importing TypeScript | `api/whatsapp/route.js` | 5 min |
| M3 | Duplicate clientes references between services | multiple | 20 min |
| M4 | Hardcoded `OWNER_PHONE` | `services/onboardingService.ts` | 5 min |
| M5 | Empty `devIndicators` in `next.config.ts` | `next.config.ts` | 2 min |
| M6 | `vercel.json` uses old version format | `vercel.json` | 2 min |

### Low Severity (Code Quality)

| ID | Bug | File | Fix Effort |
|---|---|---|---|
| L1 | Inconsistent cookie naming across auth routes | multiple | 10 min |
| L2 | `proxy.ts` has complex rewrite logic never used | `proxy.ts` | 5 min |
| L3 | Type conflicts between `modules/expedientes.ts` and `modules/types.ts` | `modules/*` | 20 min |
| L4 | Hardcoded password in seed script | `scripts/seed-super-admin.mjs` | 5 min |
| L5 | Missing error handling in WhatsApp API calls | `services/whatsappService.ts` | 10 min |
| L6 | Price widget fetches every 60s even when tab hidden | `PriceWidgets.tsx` | 10 min |
| L7 | Missing error boundaries throughout | — | 1 hour |

---

## 8. Prioritized Fix Roadmap

### Week 1 — Make It Work (Critical Fixes Only)

| Day | Task | Effort | Impact |
|---|---|---|---|
| 1 | Create `middleware.ts` from `proxy.ts` | 30 min | HIGH — Enables auth protection |
| 1 | Fix cookie name mismatch (`user-token` → `auth-token`) | 5 min | HIGH — Users can log in |
| 1 | Fix `supabase` export in `services/supabase.ts` | 2 min | HIGH — WhatsApp bot works |
| 1 | Fix Claude model name | 2 min | HIGH — AI onboarding works |
| 2 | Fix logout to clear cookies properly | 15 min | MEDIUM — Clean session termination |
| 2 | Add DELETE handler to admin usuarios API | 10 min | MEDIUM — Admin can delete users |
| 2 | Fix admin roles DELETE return statement | 2 min | MEDIUM — Roles deletion works |
| 3 | Align env var names with `.env.example` | 10 min | MEDIUM — Consistent configuration |
| 3 | Update `check-env.mjs` to match actual env vars | 10 min | MEDIUM — Accurate env validation |
| 3 | Fix TypeScript type conflicts | 20 min | MEDIUM — Build succeeds |
| 4 | Test auth flow end-to-end | 1 hour | HIGH — Verify login→dashboard→logout |
| 4 | Test WhatsApp webhook | 30 min | HIGH — Verify bot responses |

### Week 2 — Dashboard Gaps

| Task | Effort | Impact |
|---|---|---|
| Create `/api/minas` route | 30 min | HIGH — Mine data available |
| Create `/dashboard/minas` page | 2 hours | HIGH — Employees can see quarries |
| Add Minas to sidebar nav | 5 min | HIGH — Navigation |
| Update clientes page with mine count | 30 min | MEDIUM — Better client overview |

### Week 3 — Permit Workflow Fixes

| Task | Effort | Impact |
|---|---|---|
| Add database trigger to sync `fase_numero`/`estado` | 1 hour | HIGH — Dashboard shows correct phase |
| Create Supabase RPC for atomic phase transition | 2 hours | HIGH — No race conditions |
| Wire up notifications in workflow engine | 1 hour | HIGH — Users get notified of changes |
| Add auth checks to mutation APIs | 1 hour | HIGH — Secure API endpoints |

### Week 4 — Production Hardening

| Task | Effort | Impact |
|---|---|---|
| Add rate limiting to login | 30 min | MEDIUM — Brute force protection |
| Add `/api/auth/refresh` endpoint + hook | 1 hour | MEDIUM — No session expiry |
| Move seed credentials to env vars | 10 min | LOW — Security |
| Add password reset flow | 3 hours | MEDIUM — User self-service |
| Add login audit logging | 30 min | LOW — Compliance |

**Total estimated effort: 2-3 weeks for a production-ready system.**

---

## 9. Production Readiness Scorecard

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Authentication & Authorization | 3.5/10 | 20% | 0.70 |
| Dashboard Completeness | 4.5/10 | 20% | 0.90 |
| Permit Workflow Engine | 3.0/10 | 20% | 0.60 |
| WhatsApp/Maria Integration | 2.0/10 | 15% | 0.30 |
| Code Quality & Type Safety | 6.5/10 | 10% | 0.65 |
| Security (RLS, headers, cookies) | 4.0/10 | 10% | 0.40 |
| Documentation & Design System | 7.5/10 | 5% | 0.38 |
| **OVERALL** | | | **3.93/10** |

### Recommendation

**DO NOT** deploy to the Iriona 2026 pilot (60 miners) without at minimum:

1. Fix C1-C6 (authentication works)
2. Create `/dashboard/minas` page (employees can see quarries)
3. Fix permit workflow dual-schema sync (dashboard shows correct phases)
4. Wire up notifications (clients know when permits advance)

With these fixes, the system reaches approximately **6/10** — functional for a pilot with known limitations.

For full production readiness (Phase 2), add:

- Atomic transactions for phase transitions
- Auto-linking WhatsApp documents
- Payment recording API
- SLA/escalation cron job
- Complete audit trail
- Password reset flow

---

*Report generated on May 3, 2026, based on analysis of the MAPE.LEGAL codebase at https://github.com/ChavasLove/MAPE.LEGAL.git*
