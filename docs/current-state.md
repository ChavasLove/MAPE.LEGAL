# Current State

## Last Updated
2026-05-02

## Current Module
Pilot core schema complete. María legal knowledge base added. Bug fixes in progress.

---

## Completed

### Project foundation
- Initial project structure, Supabase connection, basic expediente creation
- Next.js 16.2.4 App Router with Turbopack
- `proxy.ts` route guard (replaces deprecated `middleware.ts`)

### Database schema (migrations 001–009)
- **001–003**: `fases`, `transiciones_fase`, `expedientes`, `pagos`, `expediente_fases`, `registro_auditoria`
- **004**: `hitos`, `documentos`, `mensajes_wa`, `legalidad_items`, `progress_fases`, `progress_subpasos`
- **005**: `perfiles_profesionales`, `user_roles`
- **006**: `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones`
- **007**: `contactos`
- **008**: `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`, `conversaciones_whatsapp`, `transacciones_pendientes`
- **009**: Patch — adds `telefono_whatsapp`, `situacion_tierra`, `tipo_mineral`, `fecha_registro` to `clientes`; adds `mensaje_original`, `respuesta_asistente` to `transacciones_pendientes`
- RLS policies active on all tables (migrations 005–009)

### Authentication & roles
- Unified login `POST /api/auth/login` → httpOnly cookies (`auth-token`, `auth-role`, `user-email`)
- 4 roles: `admin`, `abogado`, `tecnico_ambiental`, `cliente`
- Role-based redirect: admin→`/admin`, abogado/tecnico→`/dashboard`, cliente→`/portal`
- `proxy.ts` guards all protected routes

### Business logic (workflow engine)
- `validatePaymentForPhase`, `logAction`, `advancePhase` — `modules/expedientes.ts`
- `getNextActions`, `getBlockingReasons`, `getAvailableTransitions` — `modules/workflow.ts`
- Real document check against `documentos` table (estado `verificado`)
- `is_final: true` when no outgoing transitions
- Explicit `transition_id` required when multiple paths exist

### Pages & UI
- Landing page — 8 components, all images assigned, Open Graph configured
- `/login` — unified login with role-based redirect
- `/dashboard` — operational view for abogado / tecnico_ambiental / admin
- `/dashboard/expedientes` — expediente list with status badges
- `/dashboard/expedientes/[id]` — detail with 4 tabs (overview, documents, hitos, messages)
- `/dashboard/mensajes` — WhatsApp feed
- `/portal` — read-only client view
- `/admin` — full admin panel (users, roles, CMS, config, profesionales)

### Services
- `emailService.ts` — SendGrid REST; 6 templates (avance, rechazo, pago, contacto, acuse, bienvenida)
- `whatsappService.ts` — Meta Cloud API v21.0
- `cmsService.ts`, `configService.ts`, `dashboardService.ts`

### API routes
- Full CRUD for expedientes, documentos, admin/cms, admin/config, admin/roles, admin/usuarios
- `POST /api/whatsapp/send`, `GET+POST /api/webhook/whatsapp` — Meta Cloud webhook
- `GET+POST /api/whatsapp` — Twilio webhook / María assistant

### María WhatsApp assistant
- **Model**: `claude-haiku-4-5-20251001`
- **Knowledge base**: CHT service catalog + Reglamento Minería Honduras (Acuerdo 042-2013)
  - Key legal numbers: 10 ha max, oposición 15 días, publicación 3 días, canon enero, 6% FOB, comercializador
  - 8 pre-written quick-response scripts in Honduran Spanish
  - Excluded areas enforcement (áreas protegidas, territorios indígenas)
- **History**: last 20 messages per number from `conversaciones_whatsapp`
- **Dynamic prompt**: suppresses re-greetings in ongoing conversations
- **Client context**: loads known client from `clientes` by `telefono_whatsapp`
- **Auto-registration**: secondary Claude call extracts name/municipio → inserts into `clientes`
- **Transaction trigger**: "Listo" + "Confirmas" → inserts into `transacciones_pendientes`
- **Dedup**: filters consecutive assistant messages before sending to Claude
- **XML safety**: `esc()` on all TwiML dynamic content

### Admin mode (Willis Yang)
- Trigger: `willis yang` + `TENKA-2026`
- Returns 3 WhatsApp messages: activity + clients / expedientes + transactions / billing + regulations
- All 8 Supabase queries run in parallel via `Promise.all`
- Sub-command `expediente [id]`: drill-down card; fires before passphrase check

### Contact forwarding
- Scans Claude reply for: `te va a llamar`, `te contactamos`, `nos comunicamos`, `te vamos a contactar`
- Sends Twilio WhatsApp alert to Willis (+504 3210 0683)
- Wrapped in try/catch — non-fatal

### Seed scripts
- `scripts/seed-super-admin.mjs` — idempotent, creates admin account and assigns role
- `scripts/check-env.mjs` — validates all required environment variables before deploy

---

## Known Issues / Limitations

- `expediente [id]` sub-command open to any WhatsApp number (by design — operator preference)
- `ADMIN_PASSPHRASE` hardcoded in source (intentional per operator preference)
- `clientes` populated from WhatsApp auto-registration has only `nombre`, `municipio`, `telefono_whatsapp` — full profiles filled manually in admin panel

---

## Next Steps

- Apply migrations 007–009 to Supabase production
- Configure Vercel environment variables (see README.md section 9)
- Configure SendGrid domain verification for `gerencia@mape.legal`
- Configure Meta Business Portal webhook → `/api/webhook/whatsapp`
- Configure Twilio sandbox/sender → `/api/whatsapp`
- Build client registration flow in `/portal` (form to complete profile)
- Build gold transaction logging UI in `/dashboard`
