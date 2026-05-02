# Current State

## Last Updated
2026-05-02

## Current Module
Landing page — imagery, brand enforcement, and commercial messaging complete

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
- `app/globals.css` — complete CHT token set (`--cht-*`, Tailwind `@theme`)
- `app/layout.tsx` — Playfair Display + Inter (replaces Geist)
- All 11 landing components + 2 UI primitives — brand compliant
- `DESIGN.md` consolidated as single source of truth
- `scripts/visual-guide.ts` placeholder created

### Landing page — imagery (2026-04-26)
- `public/images/` folder created in repository
- 8 brand images uploaded by client to GitHub
- Images applied to landing sections:
  - **Hero background** → `RIVER AND MOUNTAINS.png`
  - **Hero nav logo** → `LOGO CHT.png`
  - **Problem callout** → `Map.png` (Iriona territory)
  - **Impact callout** → `Technitians Field Work.png`
  - **About left column** → `Servicios Legales.png`
- Remaining images staged for future use:
  `Services Tophography .png`, `Tophographic map.png`, `Estudio de Impacto Ambiental.png`

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

### Bug fixes (2026-05-02)
- `services/supabase.ts` — `@typescript-eslint/no-unsafe-function-type` fixed: `Function` → explicit `(...args: unknown[]) => unknown`
- `components/landing/Impact.tsx` — `react/no-unescaped-entities` fixed: raw `"` → `&ldquo;` / `&rdquo;`
- `components/landing/PriceWidgets.tsx` — `react-hooks/set-state-in-effect` resolved: `fetchPrices` restructured so all setState calls follow awaits; eslint-disable comment documents the async-safe exception
- `components/landing/Hero.tsx`, `Problem.tsx`, `Impact.tsx`, `About.tsx` — `<img>` → `<Image>` from `next/image` (LCP optimization, automatic sizing)

---

## In Progress
- Nothing active

---

## Known Issues
- `getBlockingReasons` document check is a stub (always returns `pending`)
- No Row Level Security (RLS) policies defined
- No user authentication implemented

---

## Next Steps
- Populate `scripts/visual-guide.ts` with interactive token reference
- Implement `documentos` table and real document check
- Add RLS policies to all Supabase tables
- Implement Supabase Auth
- Add UI for advancing fases and managing pagos
