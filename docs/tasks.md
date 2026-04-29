# Tasks

## Pending
- [ ] Add Row Level Security (RLS) policies to all Supabase tables
- [ ] Move `ADMIN_PASSPHRASE` to env var (`ADMIN_PASSPHRASE=TENKA-2026`) instead of hardcoded
- [ ] Confirm `hitos_pago` table name matches Supabase migration (currently referenced in admin report)
- [ ] Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` to Vercel env vars
- [ ] Implement Supabase Auth and wire `user_id` to session
- [ ] Add `GET /api/fases` endpoint for frontend fase listing
- [ ] Add `GET /api/expedientes/:id/fases` to retrieve fase history
- [ ] Define roles and permissions per fase (who can advance SERNA phase)
- [ ] Populate `scripts/visual-guide.ts` — interactive token reference for designers

## In Progress
- (none)

## Completed
- [x] Project initial setup and Supabase integration
- [x] Database schema (migrations 001–006): workflow tables, CMS, roles, notifications
- [x] `clientes`, `conversaciones_whatsapp`, `transacciones_pendientes` tables for WhatsApp
- [x] Payment validation logic (per-fase, via `pagos` table)
- [x] Audit log system (`registro_auditoria`)
- [x] Expediente workflow engine (`getNextActions`, `getBlockingReasons`, `advancePhase`)
- [x] Phase history tracking (`expediente_fases`)
- [x] Decision endpoint `GET /api/expedientes/:id/next-actions`
- [x] CHT design system enforcement — all UI components (2026-04-26)
- [x] Role-based auth system (admin / abogado / tecnico_ambiental / cliente)
- [x] Email service — SendGrid, 6 templates including welcome email
- [x] WhatsApp Meta Cloud API webhook (`/api/webhook/whatsapp`)
- [x] María assistant — Twilio webhook, Claude Haiku, conversation history, dynamic prompt
- [x] Client auto-registration via secondary Claude extraction call
- [x] JSON parse robustness — strip markdown fences before parse, detailed logging
- [x] Willis Yang executive report — 3-part WhatsApp admin report, 8 parallel DB queries
- [x] `expediente [id]` drill-down sub-command
- [x] Contact forwarding — alert to Willis when María promises callback
- [x] XML injection fix — `esc()` on all TwiML dynamic content
- [x] Null safety — `incomingMessage`/`fromNumber` default to `''` for media messages
- [x] Contact alert wrapped in try/catch (non-fatal)
- [x] Removed overly broad `'el equipo cht'` contact trigger
