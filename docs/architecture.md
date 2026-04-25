# System Architecture

## Description
Legal mining management system (MAPE / CHT).
The system manages mining formalization processes, tracking each project as an "expediente" (case file) through multiple legal and operational phases.

## Stack
- Frontend: Next.js (Vercel)
- Backend: Supabase (PostgreSQL, Auth, Storage)
- AI: Claude Code

## Language Convention

| Layer | Language | Examples |
|---|---|---|
| AI prompts / docs (`/docs`) | English | This file |
| Code logic (functions, utilities) | English | `advancePhase()`, `getNextActions()` |
| Domain entity names | Spanish | `expediente`, `fase`, `pago` |
| Database tables and columns | Spanish | `fases`, `fase_actual_id`, `registro_auditoria` |
| UI labels | Spanish | "Sin fase", "Expedientes" |
| API route nouns | Spanish | `/api/expedientes/:id/transition` |

**Hard rule:** never translate domain concepts inconsistently.
`expediente` = always `expediente`. Never "case", "file", or "record".

## Core Modules
- Expedientes (gestión de casos)
- Pagos (validación por fase)
- Usuarios / Roles
- Documentos
- Permisos / Control de acceso

## Core Rules
- An expediente cannot advance to the next fase without payment validation
- Every fase must be fully validated before advancing
- Every action must be logged in `registro_auditoria`
- Backend is the source of truth (not frontend)

## Folder Structure
- `/app` → UI and routing
- `/modules` → business logic
- `/services` → external integrations (Supabase, APIs)
- `/docs` → system memory and AI context
- `/supabase` → database schema and migrations

## Design Principles
- Modular architecture
- Clear separation of concerns
- Scalable and maintainable
