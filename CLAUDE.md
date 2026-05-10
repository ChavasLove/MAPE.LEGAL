@AGENTS.md
@DESIGN.md

# Arquitectura y Convenciones — MAPE.LEGAL

## Framework
Next.js **16.2.4** con App Router y Turbopack. Esta versión tiene cambios importantes:
- `middleware.ts` está **obsoleto** — usar `proxy.ts` con export named `proxy` (no `middleware`)
- `params` en rutas dinámicas es `Promise<{id: string}>` — siempre `await params` antes de usar
- Leer `node_modules/next/dist/docs/` antes de escribir código relacionado con routing o server components
- **Nunca instanciar Supabase/Anthropic clients a nivel de módulo en route handlers ni en componentes** — el build de Next.js ejecuta los módulos durante "page data collection" y el SSR/prerender corre `useState` initializers; si las env vars no están disponibles en ese contexto, `createClient(undefined, ...)` lanza `supabaseUrl is required` y rompe el build entero. Patrones seguros:
  - Route handlers: gatear el const con `process.env.X ? createClient(...) : null` (ver `app/api/whatsapp/route.js`), o instanciar dentro del handler.
  - Client components: instanciar dentro de `useEffect` y guardar en `useRef` (ver `app/auth/establecer-password/page.tsx`). Combinar con `export const dynamic = 'force-dynamic'` cuando la página depende de datos de runtime.

## Autenticación
- Login unificado: `POST /api/auth/login` → cookies httpOnly (`auth-token`, `auth-role`, `auth-refresh`, `user-email`)
- 4 roles: `admin`, `abogado`, `tecnico_ambiental`, `cliente`
- Redirección por rol: admin→`/admin`, abogado/tecnico→`/dashboard`, cliente→`/portal`
- Guard de rutas en `proxy.ts` — siempre mantener sincronia con nuevas rutas protegidas. **Solo verifica presencia de cookies** (filtro de primera línea, runtime edge); la validación real ocurre en layouts y route handlers vía `lib/serverAuth.ts`.
- **`lib/serverAuth.ts`** — helper centralizado. `getServerAuth()` valida el JWT contra Supabase Auth y re-deriva el rol vía `lookupUserRole()` (RPC `SECURITY DEFINER`); `requireRole(...allowed)` lo envuelve y devuelve `NextResponse 401/403` si no aplica. La cookie `auth-role` es **solo un hint** para `proxy.ts` — nunca se confía como fuente de verdad. Layouts (`app/admin/layout.tsx`, `app/dashboard/layout.tsx`, `app/portal/layout.tsx`) y todas las rutas `/api/admin/*` lo usan.
- **`lib/userRoleLookup.ts:lookupUserRole(client, userId, scope)`** — helper único compartido por `login`, `oauth-session`, `auth/callback`, `refresh`, y `serverAuth`. Llama el RPC `public.get_user_role_for_login(uuid)` (migración 019, `SECURITY DEFINER` con owner `postgres`) → bypasea RLS sin depender de que `service_role` tenga `BYPASSRLS`. Si el RPC retorna 0 filas, hace fallback con `upsert(..., { onConflict: 'user_id', ignoreDuplicates: true })` — `ignoreDuplicates` evita demote silencioso de admin a cliente bajo race contra trigger 015. Devuelve `RoleLookupResult` discriminado (`ok` con `role` + `source: 'rpc'|'fallback'`, ó `ok:false` con `reason: 'inactive'|'unknown_role'|'db_error'|'fallback_failed'` + `errorCode`).
- **Rate limit**: 5 intentos por (IP + email) cada 15 min en `/api/auth/login` — `lib/rateLimit.ts` (in-memory, defensa adicional sobre Supabase). `/api/auth/resend-confirmation` usa el mismo limiter con 3 intentos por (IP + email) cada 15 min. El map está acotado a `MAX_BUCKETS = 10_000` con eviction del bucket cuyo window resetea más pronto. `clientIpFrom()` prefiere `x-real-ip` / `x-vercel-forwarded-for` sobre el `x-forwarded-for` falsificable por el cliente.
- **Refresh**: `POST /api/auth/refresh` rota `auth-token` (1h) usando `auth-refresh` (30d) y re-deriva `auth-role` vía `lookupUserRole()` (no confía en la cookie expirada). Cliente debe llamar antes de la expiración del access token.
- **`auth-role` cookie tiene maxAge 30d** (no 1h como el access token) — garantiza que el guard de `proxy.ts` siga teniendo rol disponible entre la expiración del access token y la siguiente llamada a `/refresh`. Se setea en `/api/auth/login` y se re-setea en cada `refresh`, `oauth-session`, y `auth/callback`.
- **Logout** (`POST /api/auth/logout`): llama `auth.admin.signOut(token, 'global')` para revocar el refresh token server-side **antes** de limpiar las 4 cookies actuales (`auth-token`, `auth-role`, `auth-refresh`, `user-email`) más la legacy `admin-token` (por si quedó alguna sesión vieja). Redirige a `/login`. Sin la revocación server-side un refresh token capturado seguía minteando access tokens hasta 30 días después del logout.
- **Open-redirect guard en `/login`**: `safeFrom()` rechaza valores de `?from=` que no empiecen con `/` (o que sean `//host` / `/\\…`). Sin esto, `mape.legal/login?from=https://evil.com` redirigía al sitio externo después de login.
- **Self-demotion guard**: `PATCH/DELETE /api/admin/usuarios/[id]` rechaza modificaciones del propio admin (cambiar `rol` fuera de `admin`, marcar `activo: false`, o borrarse) — evita lockouts del último admin y downgrades vía session-hijack.
- **Google OAuth — flow dual** (`app/auth/callback/page.tsx`): la página cliente detecta primero `?code=…` (modern authorization-code flow, default en Supabase nuevo) y reenvía vía `window.location.replace` a `/api/auth/callback` (server route con `exchangeCodeForSession`). Si no hay `?code=`, intenta el path implícito leyendo `#access_token=…` del fragment y POSTeando a `/api/auth/oauth-session`. El `?code` se borra del history con `replaceState` antes de reenviar para no dejar el authorization code en la barra de direcciones. La inicialización del flow vive en `app/login/page.tsx:handleGoogleLogin()` — pega directo al `/auth/v1/authorize?provider=google&redirect_to=…` de Supabase sin generar PKCE en el cliente; si Supabase fuerza PKCE en el proyecto, `exchangeCodeForSession` server-side devuelve `invalid_grant` y aparece como tal en los logs (mejor migrar a `signInWithOAuth` con cookie-based verifier vía `@supabase/ssr` solo cuando ese síntoma se confirme en Vercel).
- **Fail-loud en falta de service-role key**: `oauth-session`, `api/auth/callback`, `api/auth/login`, `auth/refresh` y `lib/serverAuth.ts` antes caían silenciosamente al cliente anon cuando `SUPABASE_SERVICE_ROLE_KEY` faltaba/era placeholder. Ahora cada uno usa `checkAuthEnv()` y devuelve **500 `code: 'SERVER_CONFIG'`** con `logAuthEnvFailure(scope, env)` en stderr antes de tocar Supabase.
- **Diagnóstico de auth — `/api/debug/auth-config`**: ruta pública (sin auth) que reporta:
  - Estado de las 3 env vars (`url`, `anonKey`, `serviceKey`) como `'ok' | 'missing' | 'placeholder'` vía `lib/authEnv.ts:checkAuthEnv()`.
  - **RPC probe** contra `public.get_user_role_for_login(uuid)` con un UUID sentinel (todos ceros). `probe.rpc_status` `'ok' | 'unauthorized' | 'unreachable' | 'skipped'` + `probe.rpc_error` con código PostgREST. Es el path real del flow de auth — si está `ok`, el login funciona aunque `service_role` no tenga BYPASSRLS.
  - **BYPASSRLS probe** independiente: HEAD count sobre `user_roles` con service-role. `probe.service_role_bypassrls` (`'on'` si `count>0`, `'unknown'` si 0 — ambiguous entre tabla vacía y RLS escondiendo todo) + `probe.user_roles_count_visible`. Informativo: el flow de auth ya no depende de esto gracias al RPC.
- **`api/auth/register` — error mapping**: `generateLink('signup')` puede devolver "Database error saving new user" cuando el trigger 015 falla por RLS adentro del INSERT a `auth.users`. Ese caso ahora se mapea a **500 `code: 'TRIGGER_FAILURE'`** con un log `[register] trigger failure — likely migration 017_fix_user_roles_recursion.sql not applied to production Supabase. Original error: …`. Las otras ramas: `already/registered/exists` → 409 `"El correo ya está registrado"`; cualquier otro error de Supabase → 400 `"Error al crear la cuenta"` con `[register] generateLink failed:` en stderr.

## Base de Datos
- Supabase (PostgreSQL). Dos clientes:
  - `services/supabase.ts` — cliente anónimo para lecturas públicas y portales de cliente
  - `services/adminSupabase.ts` — cliente service-role para escrituras admin y operaciones privilegiadas
- Migraciones en `supabase/migrations/` (001–019). **Vercel deploy NO aplica migraciones de Supabase** — cada `.sql` debe correrse manualmente en Supabase Studio → SQL Editor (o `supabase db push`). Mergear el PR solo deja el archivo en el repo:
  - 006: `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones`
  - 007: `contactos` (formulario de landing)
  - 008: `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`, `conversaciones_whatsapp`, `transacciones_pendientes`
  - 009: Patch — columnas WhatsApp en `clientes` y `transacciones_pendientes`
  - 012: `documentos_referencia` — Manual Operativo 2026, consultado por María en tiempo real
  - 013: `precios_diarios.fetched_at` + vista `precios_frescura`
  - 014: Añade `proceso` a `documentos_referencia` + seed titulación (9 pasos) + sociedad (7 pasos). Incluye un `DO $$ ... $$` que **droppea NOT NULL en cualquier columna no gestionada por la migración** (en producción la tabla tiene columnas fuera del control de migraciones — `documento_nombre`, `categoria` — que rompían los inserts de procesos nuevos)
  - 015: Trigger `on_auth_user_created` + función `handle_new_auth_user()` (`SECURITY DEFINER`, owner = `postgres`) que inserta `user_roles` con default `cliente` cuando se crea una fila en `auth.users`. Incluye backfill para usuarios creados antes del trigger. **Sin esta migración, signup vía `auth.admin.generateLink('signup')` falla con "Database error saving new user"** — el grant explícito `INSERT on user_roles to supabase_auth_admin` (líneas 30–31) es necesario para que el trigger pueda escribir.
  - 016: `broadcast_log.error_msg` + `broadcast_log.aborted_reason`
  - 017: Drop de la policy recursiva `"Admins manage user_roles"` de 005 — era `FOR ALL` con `USING (EXISTS (SELECT 1 FROM user_roles WHERE rol='admin'))`, lo que disparaba `42P17 infinite recursion detected in policy for relation "user_roles"` en cualquier read/write desde un cliente sin BYPASSRLS. Surge tras PR #87 (que destrabó el callback de OAuth y dejó al lookup de rol llegar al SELECT que recursaba).
  - 018: Restaura el path de INSERT que 017 dejó sin cubrir. Crea la policy `"Allow default cliente role insert"` con `WITH CHECK (rol='cliente' AND activo=true)` — restringida al payload del trigger 015 y del fallback upsert en `oauth-session`/`callback`, así no se abre auto-promoción a admin/abogado/tecnico_ambiental. Ejecuta también un backfill idempotente (`auth.users` que no tienen fila en `user_roles` reciben default `cliente`). Idempotente: usa `DROP POLICY IF EXISTS` antes de `CREATE POLICY` porque PostgreSQL no soporta `CREATE POLICY IF NOT EXISTS`. **Reemplazada por 019 (la nueva policy es self-only).**
  - 019: **Cierra el bug "Sin rol asignado".** Tres cosas idempotentes en un solo archivo: (a) RPC `public.get_user_role_for_login(uuid)` `SECURITY DEFINER`, owner = `postgres` → bypasea RLS independientemente de que `service_role` tenga `BYPASSRLS` en este proyecto. Reemplaza el `SELECT FROM user_roles` directo en los 5 paths de auth. (b) Reemplaza la policy `"Allow default cliente role insert"` de 018 por `"Allow default cliente role self-insert"` con `WITH CHECK (rol='cliente' AND activo=true AND user_id = auth.uid())` — tighten para que un authenticated no pueda sembrar filas cliente sobre user_ids ajenos. (c) Backfill defensivo (mismo patrón que 018, idempotente).
- Tablas del motor de workflow: `fases`, `transiciones_fase`, `expediente_fases`, `pagos`, `documentos`, `registro_auditoria`
- Tabla `clientes` (piloto core) — columnas clave: `telefono_whatsapp`, `situacion_tierra`, `tipo_mineral`, `fecha_registro`, `nombre`, `municipio`
- Tabla `documentos_referencia` — columnas clave: `proceso` (`formalizacion` | `titulacion` | `sociedad`), `paso_numero` (int), `titulo_paso`, `rol`, `acciones`, `documentos`, `plazo`, `deliverable`, `advertencias`. Unique compuesto en `(proceso, paso_numero)` — cada proceso tiene su propia numeración (formalización 1-38, titulación 1-9, sociedad 1-7). Poblada con los pasos del Manual Operativo 2026.
- **`expedientes` NO tiene FK a `clientes`** — el campo `cliente` es texto libre. Usar `contratos` para la relación correcta.

## Motor de Workflow (`modules/`)
- `modules/types.ts` — tipos de dominio: `Fase`, `TransicionFase`, `NextActionsResult` (incluye `is_final: boolean`). `AccionAuditoria` cubre `TRANSICION_FASE`, `PAGO_REGISTRADO`, `EXPEDIENTE_CREADO`, `DOCUMENTO_VERIFICADO`, `DOCUMENTO_RECHAZADO`, `NOTIFICACION_ENVIADA`.
- `modules/workflow.ts` — `getNextActions()`, `getBlockingReasons()`, `getAvailableTransitions()`
  - Chequeo real de documentos contra tabla `documentos` (estado `verificado`)
  - `is_final: true` cuando no hay transiciones salientes — distingue proceso completado de bloqueado
- `modules/expedientes.ts` — `advancePhase()`, `validatePaymentForPhase()`, `logAction()`
  - Requiere `transition_id` explícito si hay múltiples transiciones disponibles (evita pick silencioso)
  - Revierte `expedientes.fase_actual_id` **y** `fase_numero` juntos si falla el insert en `expediente_fases` (el rollback antiguo desincronizaba ambas columnas)
  - Mantiene `expedientes.fase_numero` sincronizado con `chosen.fase.orden` (columna del dashboard)
  - Tras avance exitoso dispara `notifyPhaseAdvance()` fire-and-forget — el `.catch()` externo loggea cualquier rechazo síncrono (env vars faltantes, etc.) en lugar de tragárselo
- `modules/notifications.ts` — `notifyPhaseAdvance()`, `notifyDocumentVerified()`, `notifyDocumentRejected()`
  - Lookup de cliente vía service-role client (RLS bloquearía la consulta desde anon)
  - Falla silenciosa: errores se loggean, nunca propagan a la respuesta del API

## Servicios
| Archivo | Propósito |
|---|---|
| `services/emailService.ts` | SendGrid REST API — `sendEmail()`, shell HTML de marca, plantillas: avance, rechazo, pago, contacto interno, acuse de contacto, confirmación de correo, invitación de usuario. Helper `esc()` al inicio del módulo escapa `&<>"'` — todas las plantillas lo usan al interpolar campos de usuario o BD para evitar HTML injection (la bandeja de gerencia recibía formularios de contacto crudos sin escape) |
| `services/whatsappService.ts` | Meta Cloud API v21.0 — texto, templates, webhook parser |
| `services/cmsService.ts` | Lectura/escritura de `contenido_cms` — anon para leer, admin para escribir |
| `services/configService.ts` | Lectura/escritura de `configuracion_sistema` — solo admin client |
| `services/dashboardService.ts` | Datos de expedientes para el dashboard (`DashExpediente`, `DashHito`, `DashDoc`). `createDashExpediente()` calcula `numero_expediente` con `Number.parseInt` max en JS sobre todas las filas del año actual (no via `ORDER BY numero_expediente DESC` — el sort lex trataba `EXP-YYYY-1000` como menor que `EXP-YYYY-999` y se rompía al expediente 1000; mezclar 3 dígitos legacy con 4 dígitos nuevos recreaba el bug en la frontera). Padding actual: 4 dígitos. **Cada insert hijo (hitos, documentos, legalidad_items, progress_fases, progress_subpasos) chequea `error` y `throw`** — antes el fallo silencioso devolvía un expediente "creado" con datos faltantes y sin auditoría |

### Plantillas de email disponibles
| Función | Destinatario | Evento |
|---|---|---|
| `emailExpedienteAvance` | cliente | Fase avanzada |
| `emailDocumentoRechazado` | cliente | Documento rechazado |
| `emailHitoPago` | cliente | Hito de pago generado |
| `emailContactoInterno` | `gerencia@mape.legal` | Formulario de contacto recibido |
| `emailContactoAcuse` | visitante del sitio | Confirmación de recepción |
| `emailConfirmacionCorreo` | usuario | Enlace de confirmación de correo (signup / reenvío) |
| `emailInvitacionUsuario` | nuevo usuario invitado | Enlace para configurar contraseña tras invitación admin |

## Tipos importantes
- `DashExpediente.abogado` → `{ nombre: string; initials: string }` (inglés, no `iniciales`)
- `DashExpediente.psa` → `{ nombre: string; initials: string }`

## Rutas API principales
- `GET/POST /api/expedientes` — lista y creación
- `GET /api/expedientes/[id]` — detalle
- `POST /api/expedientes/[id]/transition` — avanzar fase (requiere `transition_id` si hay múltiples caminos)
- `GET /api/expedientes/[id]/next-actions` — estado del workflow: `can_advance`, `is_final`, `blocking`, `available_transitions`
- `PATCH /api/documentos/[id]` — verificar/rechazar documento
- `POST /api/contacto` — formulario de contacto → email a `gerencia@mape.legal` + acuse al visitante
- `POST /api/email/send` — enviar email vía SendGrid
- `POST /api/whatsapp/send` — enviar mensaje WhatsApp (Meta Cloud API)
- `GET+POST /api/webhook/whatsapp` — webhook Meta (verificación + mensajes entrantes)
- `GET+POST /api/whatsapp` — webhook Twilio; asistente virtual **María** (Claude `claude-haiku-4-5-20251001`)
- `GET+POST+DELETE /api/admin/cms` — editor CMS
- `GET+PATCH /api/admin/config` — configuración del sistema
- `GET+POST /api/admin/roles` + `PATCH+DELETE /api/admin/roles/[id]` — gestión de roles
- `GET+POST /api/admin/usuarios` — lista y creación de usuarios. POST recibe `{ email, rol, perfil_id? }` (sin password); usa `auth.admin.generateLink('invite')` y envía la invitación vía SendGrid con `emailInvitacionUsuario`. El invitado configura contraseña en `/auth/establecer-password`.
- `POST /api/auth/resend-confirmation` — genera un link de confirmación con `auth.admin.generateLink('signup')` y lo envía vía SendGrid. Rate-limited a 3 por (IP + email) cada 15 min. Responde `{ ok: true }` aunque el email no exista (anti-enumeración).
- `GET /api/admin/clientes` — lista todos los clientes registrados por WhatsApp con sus expedientes vinculados vía `cliente_id` FK (admin client, protegido por proxy)
- `GET /api/admin/minas` — lista todas las minas con cliente asociado (admin client, protegido por proxy)
- `GET /api/admin/whatsapp/health` — verifica el `WHATSAPP_TOKEN` contra Meta Cloud API sin enviar mensaje. Devuelve `{ ok, phoneId, displayPhoneNumber, verifiedName, isAuthError, error?, errorCode? }`. Status 200 si el token es válido, 401 si está expirado, 500 si la config falta. **Usar como primer diagnóstico cuando el broadcast de las 8 AM no llegue.**
- `GET /api/debug/auth-config` — diagnóstico público (sin auth) que devuelve el estado por-var de `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (`ok` / `missing` / `placeholder`). No expone valores. **Primer diagnóstico cuando el login devuelve `Configuración de servidor incompleta`** — abrir en navegador, identificar la var rota, fijarla en Vercel → Project → Settings → Environment Variables (Production) y redeployar.
- `POST /api/auth/refresh` — renueva el `auth-token` usando el `auth-refresh` cookie; limpia cookies si el refresh expiró
- `GET /api/broadcast` — estado: último broadcast, suscriptores activos, precios más recientes
- `GET+POST /api/broadcast/run` — disparar broadcast diario (protegido por `CRON_SECRET` header, sin auth cookie). Vercel Cron envía `GET`; `POST` queda para invocación manual con body JSON
- `GET /api/broadcast/config` — configuración de métricas del reporte diario
- `PATCH /api/broadcast/config` — cambiar métrica: `{ metric, action, currency?, patch?, updated_by? }`
- `GET /api/broadcast/prices?days=7` — historial de precios; `?latest=true` para solo el más reciente
- `GET /api/debug/prices` — diagnóstico de fuentes de precios: testea metals.live, exchangerate-api y Yahoo Finance; muestra env vars set/unset. Solo lectura, sin secretos expuestos.

## Asistente Virtual María (`app/api/whatsapp/route.js`)
Webhook Twilio que conecta WhatsApp con Claude AI.
**Reglas operativas canónicas:** ver [`MARIA.md`](./MARIA.md) — el system prompt en `route.js` debe mantenerse sincronizado con ese documento.

- **Modelo**: `claude-haiku-4-5-20251001`
- **Persona**: María, asistente de CHT — español sencillo, respuestas cortas (≤5 líneas), sin emojis, sin jerga
- **Conocimiento**: 3 servicios completos con precios, 38 pasos de formalización en 4 fases, titulación, sociedad minera, obligaciones del cliente, fechas críticas
- **Precios vigentes**:
  - Formalización minera: L 1,600,000 (3 hitos: 20/30/50%)
  - Titulación de propiedad: L 60,000 base (hasta 2 manzanas) + L 25,000 por manzana extra
  - Contrato de sociedad minera: L 55,000 (co-pagado 50/50)
- **Historial**: últimos 40 mensajes de `conversaciones_whatsapp` por número de WhatsApp (suficiente para sostener conversaciones multi-día sin truncar contexto importante)
- **Lookup de cliente**: busca en tabla `clientes` por `telefono_whatsapp` (strip de `whatsapp:` prefix) — si existe, inyecta nombre/municipio/tierra en el prompt; si no, instruye registro natural
- **Contexto de expediente**: tras el lookup de cliente, consulta `expedientes` por `cliente_id = cliente.id` (fallback: `cliente ILIKE nombre`). Inyecta en el prompt: `numero_expediente`, fase actual, paso actual, estado, cierre estimado, hitos pendientes. Si no hay expediente: instruye a María a explicar Fase 0 e Hito 1. Helper: `buildExpedienteContext(exps)` en `route.js`.
- **Prompt dinámico**: base + `priceContext` + contexto de cliente (con `completenessSummary`) + contexto de expediente + (si conversación en curso) bloque `CONTEXTO CRÍTICO` que prohíbe re-saludos
- **Dedup**: filtra mensajes assistant consecutivos antes de enviar a Claude
- **Base de conocimiento legal**: Reglamento Minería Honduras (Acuerdo 042-2013) embebido en el system prompt — números clave, scripts de respuesta rápida, áreas excluidas, sanciones
- **Precios en tiempo real**: consulta `precios_diarios` del día; si no hay fila, llama `fetchLiveMetalPrices()` de `services/metalsPriceService.ts` (Yahoo Finance COMEX GC=F/SI=F + exchangerate-api.com). El bloque `PRECIOS DE REFERENCIA` se inyecta en el system prompt con precio LBMA, precio de compra CHT (80% LBMA en lempiras) y tipo de cambio BCH.
- **Perfil completo del cliente**: calcula campos faltantes (nombre, DPI, municipio, situación tierra, tipo mineral) e inyecta `completenessSummary` en el prompt. María responde a "¿ya tienes mis datos?" con los campos faltantes exactos.
- **REGLA DE MEMORIA**: si el contexto ya tiene un dato, María nunca lo repite ni re-pregunta — lo usa directamente.
- **Nuevo expediente**: flujo estructurado cuando cliente registrado quiere iniciar un trámite (tipo → municipio → manzanas). Al completar, inserta en `transacciones_pendientes` con `detalle` del servicio.
- **Tablas Supabase**:
  - `conversaciones_whatsapp` — historial por `numero_whatsapp`, columnas `role`, `content`
  - `transacciones_pendientes` — registros pendientes (`estado`, `mensaje_original`, `respuesta_asistente`, `detalle`)
  - `clientes` — lookup por `telefono_whatsapp`; campos: `id, nombre, situacion_tierra, municipio, tipo_mineral, dpi, telefono_whatsapp`
  - `expedientes` — consultado para contexto de fase/hitos del cliente
  - `precios_diarios` — caché de precios del día (oro, plata, usd_hnl, fecha)
- **Trigger de transacción**: cuando la respuesta incluye `"Listo"` + `"Confirmas"` se inserta en `transacciones_pendientes`
- **Extracción estructurada**: segunda llamada a Haiku post-respuesta — parsea JSON de la conversación para registrar nombre/municipio/manzanas; strip de bloques markdown antes del parse; variable de error: `clientInsertError` (no `insertError`)
- **Columnas correctas en queries** (errores comunes a evitar):
  - `expedientes.tipo` (no `tipo_servicio`) · `expedientes.inicio` (no `fecha_inicio`)
  - `hitos` (no `hitos_pago`) · `hito.estado === 'cobrado'` (no `'confirmado'`)
  - `expedientes.cliente` es texto (no FK) — no hacer join a `clientes` desde `expedientes`

## Landing page

**Estado real (auditoría 2026-05-03):** la landing activa es `app/page.tsx` (≈523 líneas, autocontenido, usa clases definidas en `app/globals.css`). Los 15 archivos de `components/landing/*` (`Hero.tsx`, `About.tsx`, `Problem.tsx`, `Solution.tsx`, `Services.tsx`, `Impact.tsx`, `Beneficiarios.tsx`, `Footer.tsx`, `Contacto.tsx`, `News.tsx`, `Programs.tsx`, `Roadmap.tsx`, `ValorSection.tsx`, `WhyNow.tsx`, `PriceWidgets.tsx`) están **huérfanos** — `grep` confirma cero imports en todo el repo. Cualquier cambio de UI debe hacerse en `app/page.tsx`, no en los componentes huérfanos.

**Componente decorativo activo**: `components/decor/TopoBand.tsx` — SVG de líneas topográficas usado como watermark embossed en hero y footer (`app/page.tsx`) y como fondo del login (`app/login/page.tsx`). Variantes `light` / `dark` × posiciones `overlay` (full-bleed) / `band` (48px en top edge). `aria-hidden`, `pointer-events: none`, opacidad 0.06 (light, color `--ink` `#1F2A38`) / 0.18 (dark, color `--moss` `#2F5D50`). No interactivo, no animado — quiet nod al territorio hondureño.

### Imágenes disponibles en `public/images/`
| Archivo | Notas |
|---|---|
| `RIVER AND MOUNTAINS.png` | Hero (fondo) — referenciado por `app/page.tsx` y `Hero.tsx` huérfano |
| `MAPE LEGAL LOGO 1.JPG` | Logo institucional |
| `Servicios Legales.png` | Disponible |
| `Tophographic map.png` | Disponible |
| `Services Tophography .png` | Disponible (espacio en el nombre — preservar) |
| `Technitians Field Work.png` | Disponible (typo en el nombre — preservar) |
| `Artisanal Miner Image 01 .JPG` | Disponible (espacios — preservar) |
| `Estudio de Impacto Ambiental.png` | Disponible |

### Imágenes referenciadas pero **inexistentes** (no agregar nuevos refs)
- `LOGO CHT.png` — referenciado en `Hero.tsx:34` (huérfano). Usar `MAPE LEGAL LOGO 1.JPG`.
- `Map.png` — referenciado en `Problem.tsx:83` (huérfano). Usar `Tophographic map.png`.

## SEO / Open Graph

**Estado real (auditoría 2026-05-03):** `app/layout.tsx` solo declara `title` + `description`. **No** existe `metadataBase`, `openGraph` ni `twitter` — pendiente de implementar. Si se agrega, seguir el patrón documentado abajo.

Patrón objetivo (cuando se implemente):
- `metadataBase` usa `NEXT_PUBLIC_SITE_URL` (fallback: `https://mape.legal`)
- `openGraph`: type website, locale `es_HN`, siteName, og:image apuntando a `RIVER AND MOUNTAINS.png`
- `twitter`: card `summary_large_image`
- `app/page.tsx` puede sobreescribir `openGraph` con título y descripción específicos

## Admin inicial
Script de seed para crear el super admin: `scripts/seed-super-admin.mjs`
```bash
node scripts/seed-super-admin.mjs
```
Requiere env vars. Es idempotente — re-ejecutable sin efectos secundarios.

## Estilo / UI
- **MAPE LEGAL Color Manual v1.0** es la fuente de verdad — ver [`README.md`](./README.md) §0 y [`DESIGN.md`](./DESIGN.md). Tokens canónicos viven en `app/globals.css` `:root`.
- Tailwind v4 con `@theme inline` en `globals.css` — **no usar** `tailwind.config.js`.
- Colores siempre con `style={{ color: 'var(--ink)' }}` inline o vía clases definidas en `globals.css` que ya consumen los tokens.
- No usar clases genéricas de Tailwind (`green-*`, `gray-*`, `slate-*`, `primary-950`, `forest-800`, etc.) — solo `var(--ink)` / `var(--moss)` / `var(--sand)` / etc.
- Fuentes cargadas en `app/layout.tsx` vía `next/font/google`: **Inter** (`--font-inter`), **Playfair Display** (`--font-playfair`), **JetBrains Mono** (`--font-jetbrains`). `<h1>`–`<h6>` heredan Playfair desde `globals.css`. Peso máximo: 700.

## Landing page — responsividad móvil
Convenciones aplicables a `app/page.tsx` (los componentes en `components/landing/` están huérfanos — ver sección "Landing page" arriba):

- **Tipografía escalada**: H1 del Hero usa `text-3xl sm:text-4xl md:text-5xl lg:text-[4.5rem]` — nunca tamaño fijo grande
- **`<br />` condicionales**: saltos de línea decorativos usan `<br className="hidden sm:block" />` para no romper el flujo en pantallas pequeñas
- **Nav en móvil**: el texto de marca junto al logo se oculta en xs (`hidden sm:inline`); padding del botón se reduce con `px-3 sm:px-5`
- **Tablas de 2 columnas**: cuando el contenido es texto largo, usar `flex flex-col sm:grid sm:grid-cols-2` en lugar de `grid grid-cols-2` fijo — evita que el texto se corte
- **Grids de sección**: `gap-10 lg:gap-16` para grids principales (no `gap-16` flat)
- **Padding interior de cards/strips**: `p-5 sm:p-8` — no `p-8` plano
- **Listas horizontales**: siempre `flex-wrap` cuando los ítems pueden desbordar en móvil (badges, certificaciones, footer)

## Variables de Entorno Requeridas (Producción)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL           # e.g. https://mape.legal — usado en og:image y links de email
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
SENDGRID_FROM_NAME             # MAPE.LEGAL
WHATSAPP_TOKEN
WHATSAPP_PHONE_ID
WHATSAPP_VERIFY_TOKEN
ANTHROPIC_API_KEY              # Requerida por app/api/whatsapp/route.js (asistente María)
TWILIO_ACCOUNT_SID             # Consola Twilio — contact forwarding a Willis
TWILIO_AUTH_TOKEN              # Consola Twilio — contact forwarding a Willis
TWILIO_WHATSAPP_FROM           # whatsapp:+14155238886 (sandbox) o sender aprobado
# ── Sistema de broadcast (nuevas) ────────────────────────────────────────────
GOLDAPI_KEY                    # goldapi.io — precios oro/plata/cobre (free tier disponible)
EXCHANGE_RATE_API_KEY          # exchangerate-api.com v6 (opcional; sin clave usa tier gratuito)
CRON_SECRET                    # Header Bearer para proteger /api/broadcast/run. Vercel Cron lo inyecta automáticamente como Authorization: Bearer en el GET
```

## Sistema de Broadcast Diario (`jobs/`, `services/broadcastService.ts`)

> **Estado operativo (2026-05-05):** el broadcast diario está **pausado en producción** hasta que la cuenta de Meta Business complete la verificación. Sin verificación, Meta Cloud API solo entrega a los números agregados como **test recipients** en Developer Console → WhatsApp → API Setup (cap ~5 números). Cualquier suscriptor en `usuarios_broadcast` fuera de esa lista recibe error 131030 ("Recipient phone number not in allowed list"). El código está completo y listo: cuando la verificación se apruebe (Business Manager → Security Center → Start Verification, ~2-5 días con utility bill / RTN), basta con poblar `usuarios_broadcast` y dejar el cron correr. **No re-arquitecturar a Twilio en el interim**: el sandbox de Twilio requiere que cada número envíe `join <keyword>` primero y la sesión expira a las 24h sin actividad — es peor para un broadcast diario que la ventana de test recipients de Meta.

- **Tablas**: `usuarios_broadcast`, `daily_report_config`, `precios_diarios`, `broadcast_log`
- **Roles broadcast**: `minero` (default), `comprador`, `tecnico`, `admin`
- **Flujo**: cron → `GET /api/broadcast/run` → `runDailyBroadcast()` → fetch precios → store → `generateDailyMessage()` (template fijo) → `sendDailyBroadcast()` → Meta Cloud API → log
- **Formato de reporte**: template determinístico "Estimado Socio MAPE" — LBMA USD/oz, conversión a LPS, TC, precio de compra al 80% LBMA, fecha+hora Honduras (UTC-6), enlaces a goldapi.io y www.mape.legal. **No llama a Claude** — garantiza consistencia y evita alucinaciones de precio. Fallback automático cuando `precios.oro` es null/0.
- **Servicios**:
  - `services/userService.ts` — `getOrCreateUserByPhone`, `assignRole`, `getActiveSubscribers`, `listUsers`
  - `services/pricingService.ts` — `fetchGoldPrice`, `fetchSilverPrice`, `fetchUSDHNL`, `fetchCopperPrice`, `fetchAndStorePrices` (usa metals.live como fallback — **bloqueado en Vercel**, solo funciona en local)
  - `services/metalsPriceService.ts` — `fetchLiveMetalPrices()`: fuente de precios para María. Prioridad: 1) goldapi.io si `GOLDAPI_KEY` está set, 2) Yahoo Finance COMEX futures GC=F/SI=F (no requiere API key, accesible desde Vercel)
  - `services/broadcastService.ts` — `generateDailyMessage`, `sendDailyBroadcast`, `getLastBroadcastLog`
  - `services/configService.ts` — extendido con `getDailyReportConfig`, `enableMetric`, `disableMetric`, `updateMetricCurrency`, `updateMetricConfig`, `updateAudience`, `updateSchedule`
- **Cron en producción**: configurado en `vercel.json` — schedule `0 14 * * *` (14:00 UTC = 8:00 AM Honduras, UTC-6 todo el año) → `GET /api/broadcast/run` con `Authorization: Bearer <CRON_SECRET>`. Vercel Cron Jobs envían **GET** (no POST) e inyectan ese header automáticamente cuando `CRON_SECRET` está seteado en las env vars del proyecto. La ruta también acepta `POST` para invocación manual con body JSON (`roles`, `triggered_by`). En `NODE_ENV=production` con `CRON_SECRET` ausente la ruta responde **500 con error de configuración** (antes quedaba abierta y cualquiera podía gatillar el broadcast); en dev/local sigue abierta para ergonomía.
- **Comando de prueba local**:
  ```bash
  curl -X POST http://localhost:3000/api/broadcast/run \
    -H "Authorization: Bearer <CRON_SECRET>" \
    -H "Content-Type: application/json" \
    -d '{"triggered_by":"test"}'
  ```

### Tolerancia a expiración del `WHATSAPP_TOKEN`
Los User access tokens de Meta caducan a 60 días; cuando ocurre, el broadcast de las 8 AM falla en silencio salvo por las trazas del cron. Para evitar esa clase de incidentes:
- **Pre-flight**: `sendDailyBroadcast()` llama `checkWhatsAppTokenHealth()` antes del fan-out. Si Meta responde 401, `OAuthException`, o cualquier `META_FATAL_TOKEN_ERROR_CODES` (10 / 102 / 190 / 200 / 463 — auth expirado **o** scope faltante), aborta el envío, registra `broadcast_log.error_msg` + `broadcast_log.aborted_reason` con la causa + el hint de regeneración, y devuelve `aborted_reason: 'whatsapp_auth'`. **No** se itera la lista de suscriptores con un token muerto.
- **Mid-broadcast abort**: si el token cae a mitad del envío, el primer `WhatsAppApiError.isAuthError === true` interrumpe los lotes restantes mediante `return` temprano (no incrementa `total_errores` para ese suscriptor — el error es de configuración, no de delivery). Sin esto un token caducado generaba N×401 en `broadcast_log`.
- **Errores tipados**: `services/whatsappService.ts` exporta `WhatsAppApiError { status, code, subcode, type, fbtraceId, isAuthError, rawBody }` y `WhatsAppTokenHealth`. `isAuthError` cubre tanto expiración como permission-denied — para broadcast ambos requieren regenerar el token. Cualquier caller que necesite distinguir auth de transitorios debe `instanceof WhatsAppApiError && e.isAuthError`.
- **Diagnóstico**: `GET /api/admin/whatsapp/health` (admin-gated) hace una llamada `GET /{phone_id}?fields=display_phone_number,verified_name`. Es la primera comprobación cuando el reporte diario no llegó.
- **Migración**: `016_broadcast_log_error.sql` agrega `error_msg text` y `aborted_reason text` a `broadcast_log`. `aborted_reason` permite a `getLastBroadcastLog()` distinguir un run abortado por config (`'whatsapp_auth' | 'whatsapp_config'`) de un run completado normal. Hasta que se aplique en Supabase Studio, el insert con esos campos en `null` funciona; los valores poblados se descartan silenciosamente.
- **Fix recomendado en Meta**: regenerar el `WHATSAPP_TOKEN` como **System User access token** (`Business Manager → Business Settings → System Users → Generate New Token`, scope `whatsapp_business_messaging` + `whatsapp_business_management`, expiración "Never"). Los tokens de la consola de desarrollador caducan en 24h o 60 días — solo el de System User es estable para crons.

## Modo Admin — María WhatsApp
Trigger: mensaje contiene `willis yang` + `TENKA-2026` (passphrase en código, línea ~295 de `route.js`).
- Primer check en el POST handler, antes de cualquier query o llamada a Claude
- Devuelve 3 mensajes WhatsApp: actividad+clientes / expedientes+transacciones / facturación+regulaciones
- 8 queries Supabase en paralelo via `Promise.all`
- Sub-comando `expediente [id]`: retorna detalle sin passphrase (abierto por diseño)
- Contact forwarding: reply con `te va a llamar`, `te contactamos`, `nos comunicamos`, o `te vamos a contactar` → alerta Twilio a Willis (+504 3210 0683), no-fatal
- Todo contenido dinámico en TwiML pasa por `esc()` (escapa `&`, `<`, `>`)
- `incomingMessage` y `fromNumber` con fallback a `''` (previene crash en mensajes de medios)

## Admin Command Interpreter (`services/adminCommandService.ts`)

Sistema determinístico que intercepta mensajes de admins de broadcast ANTES de llamar a Claude.

- **Comando detectado** → ejecuta vía `configService` → retorna TwiML directamente (Claude no se llama)
- **Sin comando** → retorna `null` → flujo normal de María
- **Allowlists hardcodeadas**: métricas `['gold','silver','usd_hnl','copper']`, roles `['minero','comprador','tecnico','admin']`
- **Funciones**:
  - `parseAdminIntent(msg)` — rule-based, soporta multi-comando: "quita plata y agrega cobre" → 2 comandos
  - `executeAdminCommand(cmd, phone)` — despacha solo a `configService`, nunca toca DB directo
  - `logAdminAction(phone, cmd, result)` — insert a `admin_actions`, no-fatal
  - `interpretAndExecute(user, msg)` — punto de entrada; devuelve `string | null`
- **Comandos soportados**:

| Intención natural | Comando |
|---|---|
| "agrega cobre" | `ENABLE_METRIC(copper)` |
| "quita la plata" | `DISABLE_METRIC(silver)` |
| "moneda en HNL para oro" | `SET_CURRENCY(gold, HNL)` |
| "solo para compradores" | `SET_AUDIENCE(['comprador'])` |
| "cambiar hora a 7am" | `SET_BROADCAST_TIME(07:00)` |
| "enviar reporte ahora" | `SEND_BROADCAST` |

- **Logging**: cada ejecución (exitosa o no) → fila en `admin_actions` con `command_type`, `payload`, `success`, `error_msg`
- **Tabla**: `admin_actions` — `user_phone`, `command_type`, `payload jsonb`, `success`, `error_msg`, `created_at`

## Dashboard — Clientes WhatsApp (`app/dashboard/clientes/page.tsx`)

Página de prospectos y clientes registrados por María.

- **Datos**: consume `GET /api/admin/clientes` (admin client Supabase)
- **Columnas**: Nombre, Municipio, Mineral, Situación tierra, Teléfono WA, Registrado, Expediente, Estado
- **Badge "Prospecto"**: cliente sin expediente vinculado (lead puro)
- **Badges de estado**: colores del sistema de diseño (activo=azul, alerta=ámbar, bloqueado=rojo, completado=verde)
- **Vinculación futura**: para asociar un expediente a un cliente, actualizar `expedientes.cliente_id` con el `uuid` del cliente (SQL o admin panel)
- **Nav**: enlace "Clientes WA" en sidebar del dashboard (`app/dashboard/layout.tsx`)

## Onboarding (`services/onboardingService.ts`)

Flujo de registro guiado para números nuevos que contactan a María por primera vez.

- **Trigger**: número sin registro en `clientes` Y sin estado en `onboarding_states`, y que no sea admin
- **Estados**: `ASK_NAME → ASK_ID → ASK_LOCATION → ASK_ROLE → COMPLETE`
- **Funciones**:
  - `startOnboarding(telefono)` — crea fila en `onboarding_states`, retorna primera pregunta
  - `handleOnboarding(telefono, msg)` — extrae datos (Claude Haiku micro-call), avanza estado, retorna siguiente pregunta
  - `getOnboardingState(telefono)` — retorna estado actual o `null` si usuario ya registrado
- **Extracción de datos**: Claude Haiku extrae campos del mensaje natural; `1/2/3` para rol no necesita LLM
- **Multi-campo**: "Soy Juan Pérez, trabajo en Olancho" → guarda nombre Y municipio, salta a `ASK_ID`
- **Al completar**: escribe en `clientes` (nombre, dpi, municipio, telefono_whatsapp) + `usuarios_broadcast` (rol asignado)
- **Idioma**: tuteo — consistente con la personalidad establecida de María
- **Tabla**: `onboarding_states` — `telefono`, `estado`, `datos jsonb`, timestamps

## Auditoría — deuda técnica conocida (2026-05-03, parcialmente resuelta 2026-05-09)

Documentado para evitar trabajo duplicado en futuras sesiones. Ninguno está bloqueando producción.

> **Update 2026-05-09 (`claude/update-ui-colors-wGO7B`):** la sección de paleta + tipografía + audit de `app/page.tsx` / `app/globals.css` / `app/layout.tsx` quedó **resuelta** al adoptar el MAPE LEGAL Color Manual v1.0. Ver README §0 y commit `39875cf`. Los items que se mantienen son los marcados ⚠ abajo; los demás están tachados o eliminados.

### Auth — "Sin rol asignado" (resuelto 2026-05-09 vía RPC SECURITY DEFINER)

**Causa raíz**: el `service_role` en este proyecto Supabase no tenía `BYPASSRLS` (o el grant no se propagó), así que el SELECT directo `from('user_roles').select(...)` evaluaba la policy `"Users can read own role"` con `auth.uid()=null` y devolvía 0 filas, indistinguible de un row real faltante. El probe en `/api/debug/auth-config` daba falso positivo (`probe.status:'ok'`) porque sólo chequeaba ausencia de error en el HEAD count, no que devolviera filas reales.

**Fix aplicado (PR de la rama `claude/fix-login-user-roles-LPvxC`)**:
- Migración 019: RPC `public.get_user_role_for_login(uuid)` `SECURITY DEFINER` con owner = `postgres` → bypasea RLS independientemente del estado de `service_role.rolbypassrls`. También: tighten de la INSERT policy de 018 a `user_id = auth.uid()`.
- Helper compartido `lib/userRoleLookup.ts:lookupUserRole()` que envuelve el RPC + fallback con `ignoreDuplicates: true` (cierra el riesgo de demote bajo race).
- 5 routes actualizadas (`login`, `oauth-session`, `auth/callback`, `refresh`, `serverAuth`) — todas usan el mismo helper.
- Probe del debug endpoint endurecido: ahora distingue `rpc_status` (path real del flow) de `service_role_bypassrls` (informativo).
- Borrado de las rutas legacy `/api/admin/auth/login`, `/api/admin/auth/logout`, `/api/admin/auth/me`, `/admin/login`, y de la cookie `admin-token` — código muerto desde el login unificado.

Follow-up diferido: auto-promover `@cht.hn` / `@mape.legal` a `abogado` en el callback (hoy todos los Google sign-ins quedan como `cliente` por default del trigger 015 → `/portal`).

### Landing
- ⚠ `components/landing/*` — 15 archivos huérfanos (cero imports). Hex literales fueron migrados al nuevo sistema en 2026-05-09 pero las clases Tailwind tipo `bg-primary-950` siguen presentes. Decidir: revivir (y mover a tokens) o eliminar.
- ⚠ `Hero.tsx:34` referencia `LOGO CHT.png` (no existe).
- ⚠ `Problem.tsx:83` referencia `Map.png` (no existe).

### `app/page.tsx` (landing activa)
- ⚠ Línea ~507: teléfono placeholder `+504 9XXX-XXXX` — CLAUDE.md prohíbe contacto personal en landing.
- ⚠ Línea ~35: nav-logo con `href="#"` — usar `/` o `#top`.
- ⚠ Quote section (~464): mezcla comillas curvas `"` y rectas `"`.
- ⚠ `Roadmap.tsx:75` y `Problem.tsx:99` (huérfanos) linkean a `/dashboard.html` — DESIGN.md §13 prohíbe esa cross-link.

### Componentes huérfanos (si se reviven)
- ⚠ `components/landing/PriceWidgets.tsx:33` — `${sign}<0.01%` produce `-<0.01%` (signo mal posicionado).
- ⚠ `components/landing/Roadmap.tsx:72` — `animate-pulse` viola DESIGN.md §13.
- ⚠ `components/landing/WhyNow.tsx:3,8,13,18` — emojis (🌍 ⚖️ 🏭 📊) violan tono de marca.
- ⚠ `components/landing/ValorSection.tsx:99` — hex `#1A1018` no documentado en DESIGN.md.
