# Current State

## Last Updated
2026-05-10

## Current Module
Phase 1 — public-surface realignment shipped (PR #102 merged into `main`):
institutional landing, public Certificate of Origin verification surface
(`/verificar`, `/verificar/[numero]`, `/api/verificar/[numero]`), migration
020, canonical SEO metadata.

---

## Completed

### Project foundation
- Initial project structure
- Supabase connection
- Basic expediente creation

### Database schema (migrations 001–003)
- `fases` table with `nombre` and `orden`
- `transiciones_fase` table — explicit transition graph with `condicion` (JSONB)
- `expedientes` table with `fase_actual_id` FK
- `pagos` table scoped per fase
- `expediente_fases` table — full phase history
- `registro_auditoria` table with `user_id` and `accion`
- Seeded fases and transition graph

### Business logic
- `validatePaymentForPhase`, `logAction`, `advancePhase`
- Workflow engine: `getAvailableTransitions`, `getBlockingReasons`, `getNextActions`

### Services & API
- `expedientesService.ts`, `fasesService.ts`
- `GET/POST /api/expedientes`, `GET /api/expedientes/:id/next-actions`, `POST /api/expedientes/:id/transition`

### Design system (2026-04-26)
- `app/globals.css` — token set definido (algunos tokens `--green`, `--amber` violan DESIGN.md, ver auditoría)
- `app/layout.tsx` — solo Inter cargada. Playfair Display planificada pero **no** integrada (auditoría 2026-05-03)
- 15 componentes en `components/landing/` creados pero huérfanos — la landing activa es `app/page.tsx`
- `DESIGN.md` consolidated as single source of truth
- `scripts/visual-guide.ts` placeholder created

### Landing page — imagery (2026-04-26)
- `public/images/` folder created in repository
- 8 brand images uploaded:
  `RIVER AND MOUNTAINS.png`, `MAPE LEGAL LOGO 1.JPG`, `Servicios Legales.png`,
  `Tophographic map.png`, `Services Tophography .png`, `Technitians Field Work.png`,
  `Artisanal Miner Image 01 .JPG`, `Estudio de Impacto Ambiental.png`
- **Imágenes referenciadas pero inexistentes (en componentes huérfanos):**
  - `LOGO CHT.png` (`Hero.tsx:34`) — usar `MAPE LEGAL LOGO 1.JPG`
  - `Map.png` (`Problem.tsx:83`) — usar `Tophographic map.png`

### Landing page — commercial messaging (2026-04-26)
- All service prices removed from public landing page
- Programs.tsx: price fields replaced with timeframe estimates (4–6 sem / 8–12 sem)
- Programs: time guarantee strip added — "Garantizamos el menor tiempo posible"
- Services.tsx: all L amounts removed, hitos kept as process milestones (no amounts)
- Footer.tsx: L 320,000 reference replaced with time-commitment language
- Hero h1 accent updated: "el menor tiempo posible"
- All primary CTAs changed to "Solicitar cotización privada" (contact by email)
- Quotation flow: private email request only — `contacto@mape.legal`

---

### Bug fixes — session 1 (2026-05-02)
- `services/supabase.ts` — `@typescript-eslint/no-unsafe-function-type` fixed
- `components/landing/Impact.tsx` — unescaped HTML entities fixed
- `components/landing/PriceWidgets.tsx` — `react-hooks/set-state-in-effect` resolved; fetchPrices restructured
- `Hero.tsx`, `Problem.tsx`, `Impact.tsx`, `About.tsx` — `<img>` → `<Image>` from next/image

### Deployment fix — session 2 (2026-05-02)
Root causes of 3 failed Vercel deployments (PR #36 merge + follow-up commits):

**TypeScript error — `PriceWidgets.tsx`:** merged code introduced `MetalData`
interface `{price, change, changePercent}` but `fetchPrices` was setting
`gold`/`silver` as bare numbers. Fixed type cast and `setPrices` to use
`EMPTY_METAL` fallback.

**Runtime crash — `app/api/whatsapp/route.js`:** `createClient()` called at
module evaluation time ("supabaseUrl is required" during static page collection).
Replaced with lazy getter pattern matching `services/adminSupabase.ts`.

**ESLint cleanup (0 errors):**
- `Hero.tsx`: removed stale `PriceWidgets` import (component rebuilt without it)
- `app/api/admin/clientes/route.ts`: `let` → `const`
- `app/page.tsx` + 9 admin/dashboard pages: `eslint-disable-next-line` for
  `react-hooks/set-state-in-effect` (async fetch pattern; setState only after awaits)
- `package-lock.json`: package name updated temp-app → mape-legal

**Build result:** ✓ Compiled, TypeScript clean, 41 routes, 0 ESLint errors.

---

## Known Issues
- `getBlockingReasons` document check is a stub (always returns `pending`)
- No Row Level Security (RLS) policies defined
- No user authentication implemented

---

## Auditoría 2026-05-03 — deuda técnica de la landing

Resumen ejecutivo (detalle completo en CLAUDE.md → "Auditoría — deuda técnica conocida"):

### Crítico
- `components/landing/*` (15 archivos) — código huérfano, cero imports. Decidir: revivir o eliminar.
- Imágenes inexistentes referenciadas: `LOGO CHT.png`, `Map.png` (solo en componentes huérfanos).
- `app/layout.tsx` — sin Playfair Display, sin metadata SEO (`metadataBase`, `openGraph`, `twitter`).

### Violaciones de DESIGN.md
Resueltas en `claude/update-ui-colors-wGO7B` (2026-05-09) al adoptar el MAPE LEGAL Color Manual v1.0:
- ✅ `app/globals.css` — tokens migrados al sistema canónico (`--ink`, `--moss`, `--green: #2A8E50`, `--amber: #C58B2C`).
- ✅ `font-weight` capado a 700 en `globals.css` y `app/page.tsx`.
- ✅ `box-shadow` reducido a `0 2px 6px rgba(31,42,56,0.05)` (shadow-sm) en mockup, float-notif, progress-card.
- ✅ `animation: blink` removida.
- ⚠ `components/landing/Footer.tsx` sigue huérfano — el borde invisible no afecta producción.

### Nits
- `app/page.tsx` — placeholder `+504 9XXX-XXXX`, `href="#"` en logo, mezcla de comillas.
- `Roadmap.tsx`/`Problem.tsx` linkean a `/dashboard.html` (DESIGN.md §13 prohíbe cross-link).
- `WhyNow.tsx` usa emojis (viola tono de marca).

---

## Next Steps
- Populate `scripts/visual-guide.ts` with interactive token reference
- Implement `documentos` table and real document check
- Add RLS policies to all Supabase tables
- Implement Supabase Auth
- Add UI for advancing fases and managing pagos

---

## 2026-05-10 — Phase 1 public-surface realignment

### Completed
- Removed orphan `components/landing/*` (15 files, ~1,668 LOC).
- Replaced `app/page.tsx` (sales landing) with institutional homepage:
  Identidad · Cumplimiento · Verificación · Contacto. No client CTAs,
  no contact form. Spanish default, English mirror via existing `t()`
  helper.
- Added Certificate of Origin public verification surface:
  `/verificar`, `/verificar/[numero]`, `/api/verificar/[numero]`.
- Migration `020_certificados_origen.sql` (numbered 020 because 010
  was already taken by `010_admin_commands_onboarding.sql`):
  `certificados_origen` table, `certificados_origen_publicos` view,
  RLS policies (admin/abogado write, admin/abogado/tecnico_ambiental
  read on base table; public reads via view only), demo certificate
  `CO-2026-0001-DEMO` guarded by a DO block that skips quietly when
  `minas`/`expedientes` are empty.
- Enriched canonical SEO metadata in `app/layout.tsx`
  (title.template, applicationName, authors, keywords, alternates,
  alternateLocale `en_US`, robots).
- Replaced placeholder contact data with real institutional channels
  (WhatsApp +504 9737 3139, gerencia@mape.legal, oficina Nexcrea).

### Schema discrepancy resolved in-flight
- `public.minas` does **not** have a `permiso_inhgeomin` column; the
  view exposes `m.codigo` as `mina_codigo` (closest equivalent —
  e.g. `MINA-2026-001`).

### Carryover from Phase 0 (do-not-touch in Phase 1)
- `app/dashboard/minas/page.tsx:72` — pre-existing lint error
  (`react-hooks/set-state-in-effect`); persists.
- `app/api/admin/clientes/route.ts:61` — pre-existing TypeScript error
  (`Cannot find name 'clientes'`); blocks `npm run build` type-check.
  Compile step (`Compiled successfully`) passes; only the type-check
  step fails. The Phase 1 changes themselves compile and type-check
  cleanly.

### Still pending (not in scope for Phase 1)
- Phase 0 stabilization: middleware, cookie-name mismatch, API auth,
  María webhook bugs, workflow race conditions.
- Phase 2 pilot core: `minas` UI, transacciones_oro UI, certificate
  issuance flow that actually populates `certificados_origen` from
  real transactions.
- Phases 3 and 4 (national MAPE dashboard, geological map, blog,
  videos) explicitly deferred until pilot core ships.
