# Tasks

## Pending
- [ ] **Phase 0 — Stabilization.** Source: `docs/code-analysis-review.md`.
  Fix `middleware.ts` / `proxy.ts`, cookie-name mismatch in `/api/auth/login`,
  API route auth, María webhook import errors, workflow race conditions,
  and the pre-existing lint warning in `app/dashboard/minas/page.tsx`
  (`react-hooks/set-state-in-effect`).
- [ ] **Phase 2B — Transactions + Certificate issuance.** `transacciones_oro`
  CRUD, certificate issuance flow that creates rows in `certificados_origen`
  from a transaction, computes `hash_verificacion` (SHA-256 over canonical
  body), and generates a printable PDF. After 2B merges, real certificates
  flow into `/verificar/[numero]`.
- [ ] **Phase 2C — Expediente full tracking.** Phase tracking UI for the
  four INHGEOMIN phases, `hitos`, `tareas`, document upload tied to phases.
  Closes the contratos UI gap as well.
- [ ] **Phase 2D — Visual style refactor.** Migrate dashboard inline styles
  to Color Manual v1.0 tokens (`--ink`, `--moss`, `--sand`, etc.).
- [ ] Populate `scripts/visual-guide.ts` — interactive token reference for designers
- [ ] Implement `documentos` table and fill real document check in `getBlockingReasons`
- [ ] Add Row Level Security (RLS) policies to all Supabase tables
- [ ] Implement Supabase Auth and wire `user_id` to session
- [ ] Add UI for advancing fases (transition button + blocking reason display)
- [ ] Add UI for pagos management (register and validate payments)
- [ ] Add `GET /api/fases` endpoint for frontend fase listing
- [ ] Add `GET /api/expedientes/:id/fases` to retrieve fase history
- [ ] Define roles and permissions per fase (e.g. who can advance SERNA)
- [ ] Place remaining images in appropriate sections:
  - `Services Tophography .png`
  - `Tophographic map.png`
  - `Estudio de Impacto Ambiental.png`

## In Progress
- (none)

---

## Completed
- [x] Phase 2A — Mine Registry CRUD + Índice de Legalidad UI (2026-05-10)
  - POST /api/admin/minas (server-side validation)
  - GET, PATCH /api/admin/minas/[id] (no DELETE — mining records indelible)
  - GET, PATCH /api/admin/indice-legalidad/[mina_id] (5-component upsert)
  - /dashboard/minas: + Nueva mina modal, row → detail link
  - /dashboard/minas/[id]: tabbed detail (General · Legalidad · Contratos · Transacciones)
  - Edit modal for mine fields, retirement via estado='clausurada'
  - Closes audit gap: minas UI 0/10 → ~7/10
- [x] Phase 1 — Realineación de superficie pública (2026-05-10)
  - Landing institucional reemplaza la página de ventas (`app/page.tsx`)
  - Portal público de Verificación de Certificado de Origen
    (`/verificar`, `/verificar/[numero]`, `/api/verificar/[numero]`)
  - Migración `020_certificados_origen.sql` + vista pública
    `certificados_origen_publicos`
  - Metadata SEO canónica enriquecida en `app/layout.tsx`
  - Eliminación de `components/landing/*` (15 archivos huérfanos)
  - Datos institucionales reales (WhatsApp +504 9737 3139,
    gerencia@mape.legal, oficina Nexcrea)
- [x] Vercel deployment fix (2026-05-02)
  - `PriceWidgets.tsx`: TypeScript error — `MetalData` type mismatch in `fetchPrices` fixed
  - `app/api/whatsapp/route.js`: runtime crash — lazy Supabase getter replaces module-level `createClient()`
  - 9 admin/dashboard pages + `app/page.tsx`: `eslint-disable-next-line set-state-in-effect` for async data-fetch pattern
  - `app/api/admin/clientes/route.ts`: `let` → `const`
  - `Hero.tsx`: removed stale `PriceWidgets` import
  - Build: 41 routes, TypeScript clean, 0 ESLint errors
- [x] ESLint / TypeScript bug fixes (2026-05-02)
  - `supabase.ts`: `Function` type → explicit `(...args: unknown[]) => unknown`
  - `Impact.tsx`: unescaped `"` entities → `&ldquo;` / `&rdquo;`
  - `PriceWidgets.tsx`: setState calls restructured to follow awaits; `set-state-in-effect` disabled with async-safe comment
  - `Hero.tsx`, `Problem.tsx`, `Impact.tsx`, `About.tsx`: `<img>` → `<Image>` (next/image)
- [x] Project initial setup
- [x] Supabase integration
- [x] Create fases table in database
- [x] Implement payment validation logic (per-fase, via `pagos` table)
- [x] Add audit log system (`registro_auditoria` with `user_id` and `accion`)
- [x] Define expediente state transitions (explicit graph in `transiciones_fase`)
- [x] Expediente workflow engine (`getNextActions`, `getBlockingReasons`, `advancePhase`)
- [x] Phase history tracking (`expediente_fases` with `entrada_en` / `salida_en`)
- [x] Bilingual naming convention (Spanish DB/domain, English code logic)
- [x] Decision endpoint `GET /api/expedientes/:id/next-actions`
- [x] CHT design system enforcement — all UI components (2026-04-26)
  - Fonts: Playfair Display + Inter (replaces Geist)
  - Color tokens: complete `--cht-*` + Tailwind `@theme` system in `globals.css`
  - All generic Tailwind colors purged from 11 landing components + 2 UI primitives
  - `DESIGN.md` consolidated as single source of truth
  - `scripts/visual-guide.ts` placeholder created
- [x] Landing page — imagery applied (2026-04-26)
  - `public/images/` folder created; 8 client images committed to repo
  - RIVER AND MOUNTAINS → Hero background
  - LOGO CHT → Hero nav logo
  - Map → Problem section callout
  - Technitians Field Work → Impact callout
  - Servicios Legales → About left column
- [x] Landing page — all service prices removed (2026-04-26)
  - Programs: timeframes replace prices; time guarantee strip added
  - Services: all L amounts removed
  - Footer + Hero: price references replaced with time-commitment language
  - Quotation flow: private request only via contacto@mape.legal
