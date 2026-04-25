# AI Development Rules

---

## Language Enforcement (CRITICAL)

This system uses a strict dual-language architecture. These rules are non-negotiable.

### Domain language = Spanish

All of the following MUST remain in Spanish at all times:

**Database tables:**
`expedientes`, `fases`, `pagos`, `transiciones_fase`, `expediente_fases`, `registro_auditoria`

**Database columns:**
`fase_actual_id`, `fase_origen_id`, `fase_destino_id`, `ingresado_por`,
`entrada_en`, `salida_en`, `nombre`, `orden`, `monto`, `estado`, `accion`

**JSONB condition keys** (stored in `transiciones_fase.condicion`):
`requiere_pago`, `requiere_documentos`, `requiere_aprobacion`

### Technical language = English

All logic, functions, and architecture remain in English:
`advancePhase()`, `getNextActions()`, `getBlockingReasons()`, `validatePaymentForPhase()`

### Correct vs forbidden

| Correct | Forbidden |
|---|---|
| `condition.requiere_pago` | `condition.requires_payment` |
| `expediente.fase_actual_id` | `expediente.current_phase_id` |
| `pago.estado` | `pago.status` |
| `fases` (table) | `phases` (table) |
| `registro_auditoria` (table) | `audit_logs` (table) |

**DO NOT** translate domain fields into English under any circumstances.
**DO NOT** introduce mixed naming (e.g. half Spanish / half English in the same type or query).

---

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
