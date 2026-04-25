# AI Development Rules

## Principles
- Never duplicate logic
- Always separate UI from business logic
- Critical validations must happen in backend
- Supabase is the single source of truth

## Code Guidelines
- Use TypeScript
- Write small, clear, modular functions
- Use descriptive naming
- Prefer explicit over implicit logic

## Forbidden
- No direct database queries from UI components
- No business logic in frontend
- No hardcoded states or transitions

## Architecture Rules
- UI (app/) only calls services or modules
- Business logic lives in modules/
- External integrations live in services/

## Output Expectations
- Clean
- Readable
- Scalable
- Production-ready
