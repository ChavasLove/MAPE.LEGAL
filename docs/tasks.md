# Tasks

## Pending

### Deployment
- [ ] Apply migrations 007–009 to Supabase production
- [ ] Configure Vercel environment variables (see README.md section 9)
- [ ] Run `node scripts/seed-super-admin.mjs` post-deploy
- [ ] Configure SPF + DKIM for `gerencia@mape.legal` in SendGrid
- [ ] Configure Meta Business Portal webhook → `/api/webhook/whatsapp`
- [ ] Configure Twilio webhook → `/api/whatsapp`

### Features
- [ ] Client registration form in `/portal` — let clients complete their own profile
- [ ] Gold transaction logging UI in `/dashboard` — wire to `transacciones_oro` table
- [ ] `GET /api/expedientes/:id/fases` endpoint — full fase history for detail page
- [ ] `GET /api/fases` endpoint — list all available fases for dropdowns
- [ ] `/portal` — show `indice_legalidad` components per mina
- [ ] Admin report sub-command `cliente [nombre]` — drill-down client card

### Hardening
- [ ] Move `ADMIN_PASSPHRASE` to env var (`ADMIN_PASSPHRASE=TENKA-2026`)
- [ ] Define permissions per fase (who can advance SERNA phase vs INHGEOMIN)
- [ ] Add `GET /api/clientes` endpoint for admin panel client management page

---

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
- [x] CHT design system enforcement — all UI components, DESIGN.md, globals.css
- [x] Role-based auth system (admin / abogado / tecnico_ambiental / cliente)
- [x] Email service — SendGrid, 6 templates including welcome email
- [x] WhatsApp Meta Cloud API webhook (`/api/webhook/whatsapp`)
- [x] María assistant — Twilio webhook, Claude Haiku, conversation history, dynamic prompt
- [x] María legal knowledge base — Reglamento Minería Honduras (Acuerdo 042-2013)
- [x] Client auto-registration via secondary Claude extraction call
- [x] JSON parse robustness — strip markdown fences before parse
- [x] Willis Yang executive report — 3-part WhatsApp admin report, 8 parallel DB queries
- [x] `expediente [id]` drill-down sub-command
- [x] Contact forwarding — alert to Willis when María promises callback
- [x] XML injection fix — `esc()` on all TwiML dynamic content
- [x] Null safety — `incomingMessage`/`fromNumber` default to `''`
- [x] Bug fix — `hitos_pago` → `hitos`, `tipo_servicio` → `tipo`, `fecha_inicio` → `inicio`
- [x] Bug fix — `hitos.estado === 'confirmado'` → `'cobrado'` (correct enum value)
- [x] Bug fix — removed invalid Supabase join `clientes(...)` on `expedientes` (no FK)
- [x] Pilot core tables — `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`
- [x] Pilot seed data — 4 demo expedientes linked to clients, mines, contracts, legality index
- [x] `scripts/check-env.mjs` — environment variable validation script
- [x] `.env.example` — template for all required variables
- [x] `package.json` name fixed (`temp-app` → `mape-legal`)
- [x] `docs/` files updated to current state (2026-05-02)
