# Current State

## Last Updated
2026-04-29

## Current Module
WhatsApp assistant (María) — admin tooling and data extraction complete

---

## Completed

### Project foundation
- Initial project structure
- Supabase connection
- Basic expediente creation

### Database schema (migrations 001–006)
- `fases`, `transiciones_fase`, `expedientes`, `pagos`, `expediente_fases`, `registro_auditoria`
- `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones`
- `conversaciones_whatsapp` — chat history by WhatsApp number (`role`, `content`)
- `transacciones_pendientes` — gold transactions awaiting confirmation
- `clientes` — auto-registered from WhatsApp conversations

### Business logic (workflow engine)
- `validatePaymentForPhase`, `logAction`, `advancePhase` in `modules/expedientes.ts`
- `getNextActions`, `getBlockingReasons`, `getAvailableTransitions` in `modules/workflow.ts`
- Real document check against `documentos` table (estado `verificado`)
- `is_final: true` when no outgoing transitions

### Services
- `emailService.ts` — SendGrid; 6 templates (avance, rechazo, pago, contacto, acuse, bienvenida)
- `whatsappService.ts` — Meta Cloud API v21.0
- `cmsService.ts`, `configService.ts`, `dashboardService.ts`

### API routes
- Full CRUD for expedientes, documentos, admin/cms, admin/config, admin/roles, admin/usuarios
- `POST /api/whatsapp/send`, `GET+POST /api/webhook/whatsapp` — Meta Cloud webhook
- `GET+POST /api/whatsapp` — Twilio webhook / María assistant

### María WhatsApp assistant (`app/api/whatsapp/route.js`)
- **Model**: `claude-haiku-4-5-20251001`
- **Persona**: María, CHT assistant — plain Spanish, max 5 lines, no emojis
- **History**: last 20 messages from `conversaciones_whatsapp` per number
- **Dynamic prompt**: suppresses re-greetings when conversation is in progress
- **Dedup**: filters consecutive assistant messages before sending to Claude
- **Client lookup**: loads known client from `clientes` table by phone number; injects context into prompt
- **Auto-registration**: secondary Claude call extracts name/municipio from conversation text; strips markdown fences before JSON.parse; inserts into `clientes` if not already present
- **Transaction trigger**: reply containing "Listo" + "Confirmas" → inserts into `transacciones_pendientes`
- **XML safety**: all dynamic content escaped via `esc()` before embedding in TwiML

### Admin mode (Willis Yang)
- Trigger: message contains `willis yang` + `TENKA-2026`
- Fires as first check after parsing `incomingMessage`/`fromNumber`, before any DB or Claude calls
- Returns 3 WhatsApp messages: activity + clients / expedientes + transactions / billing + regulations
- All 8 Supabase queries run in parallel via `Promise.all`
- Sub-command `expediente [id]`: returns drill-down card; fires before passphrase check

### Contact forwarding
- After Claude reply, scans for: `te va a llamar`, `te contactamos`, `nos comunicamos`, `te vamos a contactar`
- Sends Twilio WhatsApp alert to Willis (+504 3210 0683) with client name, number, message excerpt
- Wrapped in try/catch — failure is non-fatal, client always receives their response

### Design system (CHT brand — 2026-04-26)
- `app/globals.css` — `--cht-*` CSS variables + Tailwind v4 `@theme` token set
- Fonts: Playfair Display (headings) + Inter (UI/body)
- All 11 landing components purged of generic Tailwind colors
- `DESIGN.md` — single source of truth for brand

---

## In Progress
- Nothing active

---

## Known Issues / Limitations
- `expediente [id]` sub-command open to any WhatsApp number (by design — session-scoped admin UX)
- `ADMIN_PASSPHRASE` hardcoded in source code (intentional per operator preference)
- `hitos_pago` table referenced in admin report — confirm table name matches migration
- No Row Level Security (RLS) policies defined on Supabase tables

---

## Next Steps
- Add RLS policies to all Supabase tables
- Move `ADMIN_PASSPHRASE` to env var (`ADMIN_PASSPHRASE=TENKA-2026`)
- Implement Supabase Auth and wire `user_id` to session
- Populate `scripts/visual-guide.ts` with interactive token reference
