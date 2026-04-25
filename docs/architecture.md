# System Architecture

## Description
Legal mining management system (MAPE / CHT).
The system manages mining formalization processes, tracking each project as an "expediente" (case file) through multiple legal and operational phases.

## Stack
- Frontend: Next.js (Vercel)
- Backend: Supabase (PostgreSQL, Auth, Storage)
- AI: Claude Code

## Core Modules
- Expedientes (case management)
- Payments
- Users / Roles
- Documents
- Permissions / Access control

## Core Rules
- An expediente cannot move to the next phase without payment validation
- Every phase must be fully validated before advancing
- Every action must be logged (audit trail)
- Backend is the source of truth (not frontend)

## Folder Structure
- /app → UI and routing
- /modules → business logic
- /services → external integrations (Supabase, APIs)
- /docs → system memory and AI context
- /supabase → database schema and policies

## Design Principles
- Modular architecture
- Clear separation of concerns
- Scalable and maintainable
