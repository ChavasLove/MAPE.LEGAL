# Tasks

## Pending
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

## Completed
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
