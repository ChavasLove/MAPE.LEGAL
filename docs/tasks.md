# Tasks

## Pendientes al cierre 2026-08-07 (rama `claude/price-conversion-gold-widget-gjq10r`, PR #228 — conversión por kilates + peniques)

0. **[OPERADOR — HOY] Diésel desactualizado en producción.** Verificado contra
   el API vivo (2026-08-07): el card muestra el valor SEMILLA de la migración
   028 (L 124.26, vigente 2026-07-27). El precio SEN del **lunes 2026-08-03**
   nunca se ingresó. No es bug: el diésel es manual por diseño (runbook del
   lunes en CLAUDE.md §Widget de Precios). Acción: `/admin/precios` → editar
   diésel con el precio SEN de la semana + `vigente_desde` 2026-08-03 →
   guardar. **Además**: el guardián
   diario (`/api/cron/diesel-freshness`, 8:30 AM HN) debió mandar un correo a
   gerencia@mape.legal cada día desde el lunes — si no llegó ninguno, revisar
   spam → Vercel Logs de esa ruta → env vars `CRON_SECRET` y `SENDGRID_API_KEY`.
   Si el guardián está mudo, el próximo lunes olvidado tampoco avisará.
0-bis. **[OPERADOR] Deploy pendiente de los últimos commits.** GitHub dejó de
   entregar webhooks de esta rama tras `06dc1f2` (~17:30 UTC): ni CI ni Vercel
   vieron `eeba6a6`/`c4a30a4`/`0a64060`/`b3c6f1a` (verificado: el API de
   producción tiene `kilates` pero NO los campos `_dwt`). Los commits SÍ están
   en el remoto (`git ls-remote` = `b3c6f1a`). Desbloqueo: Vercel dashboard →
   Create Deployment desde la rama, o cerrar/reabrir el PR #228 (regenera los
   eventos y corre CI). Confirmar CI verde antes de mergear.

**La reparación Plan 2 se ejecutó completa contra producción el 2026-08-04** vía
Management API (detalle: CLAUDE.md §Reparación → bullet ✅ EJECUTADO, y
`docs/plan2-runbook-produccion.md`). Resultado: diagnóstico post **39/39 OK**,
verificación **28 OK + 3 INFO**, respaldo JSON completo entregado al operador,
**seed de 587 concesiones ejecutado**, probes públicos verdes (`/verificar`,
`/api/verificar`, búsqueda de concesiones) y **guardarriel institucional web
PASS** con key real. `indice_legalidad_legacy` quedó con 0 filas → la decisión
de migración legacy se disuelve. PRs #220–#223 mergeados.

### Pendientes del operador (no requieren sesión de Claude)

1. **Revocar el token `sbp_`** usado en la ejecución (Dashboard → Account →
   Access Tokens) y, si se desea, revertir la política de red del entorno
   (`api.supabase.com` / `mape.legal` ya no son necesarios).
2. **Prueba WhatsApp con teléfono real**: (a) desde un número registrado en
   `clientes`, confirmar que María ya no re-pide datos; (b) desde un número
   nuevo, mensaje UMA → sin precios, y `tipo_interlocutor='institucional'`
   pegajoso en turno 2 (runbook paso 5).
3. **`/dashboard/minas` con login admin** — debe cargar vacío con "+ Nueva mina".
4. **Decisión Supabase Pro** — confirmado durante la ejecución: el proyecto no
   tiene NINGÚN backup automático (plan Free, PITR off). Recomendado.
5. **Merge del PR #224** (solo docs: registro de ejecución + runbook).
6. Recomendaciones abiertas: branch protection en `main` con CI obligatorio
   (quinta pérdida silenciosa por auto-merge de la UI documentada en el #223);
   upgrade Vercel Pro si se quiere hora configurable del boletín.

## Pending
- [ ] **Phase 0 — Stabilization.**
  Remaining: cookie-name mismatch in `/api/auth/login`, María webhook import
  errors, and the pre-existing lint warning in `app/dashboard/minas/page.tsx`
  (`react-hooks/set-state-in-effect`). Done in the 2026-08 blindaje: `proxy.ts`
  now validates the real session (Next 16 middleware), API route auth audited
  (`/api/prices` closed), and workflow transitions are race-free via the
  `avanzar_expediente_fase` RPC (migration 033).
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
- [x] MAPE LEGAL design system enforcement — all UI components (2026-04-26)
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
