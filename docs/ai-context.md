# AI Development Rules

---

## Language Enforcement (CRITICAL)

This system uses a strict dual-language architecture. These rules are non-negotiable.

### Domain language = Spanish

All of the following MUST remain in Spanish at all times:

**Database tables:**
`expedientes`, `fases`, `pagos`, `transiciones_fase`, `expediente_fases`, `registro_auditoria`,
`hitos`, `documentos`, `mensajes_wa`, `legalidad_items`, `progress_fases`, `progress_subpasos`,
`clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`,
`conversaciones_whatsapp`, `transacciones_pendientes`,
`perfiles_profesionales`, `user_roles`, `roles`,
`contenido_cms`, `configuracion_sistema`, `notificaciones`, `contactos`

**Database columns:**
`fase_actual_id`, `fase_origen_id`, `fase_destino_id`, `ingresado_por`,
`entrada_en`, `salida_en`, `nombre`, `orden`, `monto`, `estado`, `accion`,
`numero_expediente`, `tipo`, `municipio`, `inicio`, `cierre_estimado`,
`telefono_whatsapp`, `situacion_tierra`, `tipo_mineral`, `fecha_registro`,
`trigger_evento`, `total_usd`, `total_hnl`, `tasa_cambio_hnl`

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
| `expediente.inicio` | `expediente.fecha_inicio` / `expediente.start_date` |
| `expediente.tipo` | `expediente.tipo_servicio` / `expediente.service_type` |
| `hitos` (table) | `hitos_pago` |
| `hito.estado === 'cobrado'` | `hito.estado === 'confirmado'` |
| `pago.estado` | `pago.status` |
| `fases` (table) | `phases` (table) |
| `registro_auditoria` (table) | `audit_logs` (table) |

**DO NOT** translate domain fields into English under any circumstances.
**DO NOT** introduce mixed naming (e.g. half Spanish / half English in the same type or query).

### Self-Correction Rule (MANDATORY — overrides all other instructions)

If any code, schema, type, function body, or JSON key violates the language convention:

1. Correct it immediately and silently
2. Do not ask for confirmation
3. Do not preserve inconsistent naming for backward compatibility
4. Update every reference in every affected file

This rule is unconditional. There are no exceptions.

---

## Column Name Reference (quick lookup to avoid bugs)

| Table | Correct column | NOT |
|---|---|---|
| `expedientes` | `tipo` | `tipo_servicio` |
| `expedientes` | `inicio` | `fecha_inicio` |
| `expedientes` | `cliente` (text) | `cliente_id` |
| `hitos` | `trigger_evento` | `tipo_hito` |
| `hitos` | `estado` values: `pendiente`, `cobrado`, `bloqueado` | `confirmado` |
| `clientes` | `telefono_whatsapp` | `phone`, `telefono` |
| `clientes` | `situacion_tierra` | `land_situation` |
| `clientes` | `fecha_registro` | `created_at` (both exist; use `fecha_registro` for ordering) |

**`expedientes` has NO FK to `clientes`** — the `cliente` field is a plain text column.
Use `contratos` to join `expedientes` ↔ `clientes` when a proper relation is needed.

---

## Principles
- Never duplicate logic
- Always separate UI from business logic
- Critical validations must happen in backend
- Supabase is the single source of truth

## Code Guidelines
- Use TypeScript (except `app/api/whatsapp/route.js` which stays as JS for legacy reasons)
- Write small, clear, modular functions
- Use descriptive naming
- Prefer explicit over implicit logic

## Forbidden
- No direct database queries from UI components
- No business logic in frontend
- No hardcoded states or transitions
- No generic Tailwind colors (`green-*`, `gray-*`, `slate-*`) — use CHT tokens from DESIGN.md

## Architecture Rules
- UI (`app/`) only calls services or API routes
- Business logic lives in `modules/`
- External integrations live in `services/`
- All dynamic content in TwiML must pass through `esc()` before embedding
