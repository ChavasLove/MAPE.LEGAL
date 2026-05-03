# Current State

## Last Updated
2026-05-03

## Current Module
Landing page — auditoría completa. La landing activa (`app/page.tsx`) está en producción. Los componentes en `components/landing/*` son código huérfano (cero imports). Ver "Auditoría 2026-05-03" abajo y CLAUDE.md → "Auditoría — deuda técnica conocida".

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

### Bug fixes (2026-05-02)
- `services/supabase.ts` — `@typescript-eslint/no-unsafe-function-type` fixed: `Function` → explicit `(...args: unknown[]) => unknown`
- `components/landing/Impact.tsx` — `react/no-unescaped-entities` fixed: raw `"` → `&ldquo;` / `&rdquo;`
- `components/landing/PriceWidgets.tsx` — `react-hooks/set-state-in-effect` resolved: `fetchPrices` restructured so all setState calls follow awaits; eslint-disable comment documents the async-safe exception
- `components/landing/Hero.tsx`, `Problem.tsx`, `Impact.tsx`, `About.tsx` — `<img>` → `<Image>` from `next/image` (LCP optimization, automatic sizing)

---

## Known Issues / Limitations

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
- `app/globals.css` — tokens `--green: #057a55`, `--amber: #92580a` (paletas Tailwind prohibidas).
- `font-weight: 800` en globals.css y page.tsx — DESIGN.md §2 cap = 700.
- `box-shadow` excediendo `shadow-sm` en `.mockup-window`, `.float-notif*`, `.progress-card`.
- `animation: blink` continua en globals.css — prohibida por DESIGN.md §13.
- `Footer.tsx:3` — borde invisible (primary-900 sobre primary-950).

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
