@AGENTS.md
@DESIGN.md

# Arquitectura y Convenciones — MAPE.LEGAL

## Framework
Next.js **16.2.4** con App Router y Turbopack. Esta versión tiene cambios importantes:
- `middleware.ts` está **obsoleto** — usar `proxy.ts` con export named `proxy` (no `middleware`)
- `params` en rutas dinámicas es `Promise<{id: string}>` — siempre `await params` antes de usar
- Leer `node_modules/next/dist/docs/` antes de escribir código relacionado con routing o server components
- **Nunca instanciar Supabase/Anthropic clients a nivel de módulo en route handlers ni en componentes** — el build de Next.js ejecuta los módulos durante "page data collection" y el SSR/prerender corre `useState` initializers; si las env vars no están disponibles en ese contexto, `createClient(undefined, ...)` lanza `supabaseUrl is required` y rompe el build entero. Patrones seguros:
  - Route handlers: gatear el const con `process.env.X ? createClient(...) : null`, o usar accesor lazy `getSupabase()` que cachea en módulo (ver `app/api/whatsapp/route.js`). **Si migrás de `const supabase` a `getSupabase()`, hay que reemplazar TODOS los callsites en el mismo PR** — el merge `39f7d11` rompió María por dejar 10 referencias a `supabase` undefined que tiraban `ReferenceError` en cada webhook (caught por el outer try/catch → todos los usuarios recibían "tuvimos un problema técnico"). Fix en commit `a0df1bc`.
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
- **Callback defensivo — never silent stuck** (`app/auth/callback/page.tsx`): tres capas que evitan que un usuario quede colgado en el spinner "Iniciando sesión…" sin escape: (a) `AbortController` con timeout de **15s** sobre el `fetch` a `/api/auth/oauth-session` — al abortar redirige a `/login?error=Tiempo+de+espera+excedido`. (b) **Stuck UI a los 8s**: aparece un mensaje "Esto está tomando más de lo normal" + link manual a `/login`. (c) **Hard giveup a los 20s**: `window.location.replace('/login?error=Tiempo+de+espera+excedido')` como red de seguridad final. Además, el redirect post-success usa **`window.location.assign(target)`** (no `router.push`) — full reload garantiza que las cookies recién seteadas viajen con el request al server-rendered layout, sidestepea cualquier race con el client router. Todos los branches loggean `console.log/warn('[oauth-callback] <branch>', payload)` para diagnóstico self-serve desde DevTools.
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
  - 010: `admin_actions` + `onboarding_states` — backing tables del Admin Command Interpreter y del onboarding state machine. **Sin esta migración aplicada, `startOnboarding()` lanza `Error: Could not find the table 'public.onboarding_states' in the schema cache` y el webhook de María cae al outer catch — todo número no registrado recibe "tuvimos un problema técnico".** Fix de runtime en commit `2aabb8a` envuelve el bloque de onboarding en `try/catch` así Maria degrada limpio cuando la migración no está aplicada (loggea `[onboarding] non-fatal —…` y cae al flujo normal); aplicar 010 en Supabase Studio sigue siendo necesario para que el onboarding guiado funcione.
  - 012: `documentos_referencia` — Manual Operativo 2026, consultado por María en tiempo real
  - 013: `precios_diarios.fetched_at` + vista `precios_frescura`
  - 014: Añade `proceso` a `documentos_referencia` + seed titulación (9 pasos) + sociedad (7 pasos). Incluye un `DO $$ ... $$` que **droppea NOT NULL en cualquier columna no gestionada por la migración** (en producción la tabla tiene columnas fuera del control de migraciones — `documento_nombre`, `categoria` — que rompían los inserts de procesos nuevos)
  - 015: Trigger `on_auth_user_created` + función `handle_new_auth_user()` (`SECURITY DEFINER`, owner = `postgres`) que inserta `user_roles` con default `cliente` cuando se crea una fila en `auth.users`. Incluye backfill para usuarios creados antes del trigger. **Sin esta migración, signup vía `auth.admin.generateLink('signup')` falla con "Database error saving new user"** — el grant explícito `INSERT on user_roles to supabase_auth_admin` (líneas 30–31) es necesario para que el trigger pueda escribir.
  - 016: `broadcast_log.error_msg` + `broadcast_log.aborted_reason`
  - 017: Drop de la policy recursiva `"Admins manage user_roles"` de 005 — era `FOR ALL` con `USING (EXISTS (SELECT 1 FROM user_roles WHERE rol='admin'))`, lo que disparaba `42P17 infinite recursion detected in policy for relation "user_roles"` en cualquier read/write desde un cliente sin BYPASSRLS. Surge tras PR #87 (que destrabó el callback de OAuth y dejó al lookup de rol llegar al SELECT que recursaba).
  - 018: Restaura el path de INSERT que 017 dejó sin cubrir. Crea la policy `"Allow default cliente role insert"` con `WITH CHECK (rol='cliente' AND activo=true)` — restringida al payload del trigger 015 y del fallback upsert en `oauth-session`/`callback`, así no se abre auto-promoción a admin/abogado/tecnico_ambiental. Ejecuta también un backfill idempotente (`auth.users` que no tienen fila en `user_roles` reciben default `cliente`). Idempotente: usa `DROP POLICY IF EXISTS` antes de `CREATE POLICY` porque PostgreSQL no soporta `CREATE POLICY IF NOT EXISTS`. **Reemplazada por 019 (la nueva policy es self-only).**
  - 019: **Cierra el bug "Sin rol asignado".** Tres cosas idempotentes en un solo archivo: (a) RPC `public.get_user_role_for_login(uuid)` `SECURITY DEFINER`, owner = `postgres` → bypasea RLS independientemente de que `service_role` tenga `BYPASSRLS` en este proyecto. Reemplaza el `SELECT FROM user_roles` directo en los 5 paths de auth. (b) Reemplaza la policy `"Allow default cliente role insert"` de 018 por `"Allow default cliente role self-insert"` con `WITH CHECK (rol='cliente' AND activo=true AND user_id = auth.uid())` — tighten para que un authenticated no pueda sembrar filas cliente sobre user_ids ajenos. (c) Backfill defensivo (mismo patrón que 018, idempotente).
  - 023: **`concesiones_mineras_registro` + RPCs** — base de datos pública del registro INHGEOMIN (Honduras) transcrita de 3 PDFs (CONCESIONES_MINERAS_OTORGADAS_PARA_EXPLOTACIÓN, …EXPLORACIÓN, y …METÁLICAS EN SOLICITUD). Tres categorías canónicas en `categoria`: `explotacion_otorgada`, `exploracion_otorgada`, `solicitud_pendiente` (la mayoría son solicitudes pendientes de aprobación). Vista `concesiones_mineras_publicas` con `grant select to anon, authenticated` para superficies públicas. RLS: lectura pública, escritura `admin|abogado|tecnico_ambiental`, ALL para `service_role`. **RPCs SECURITY DEFINER** (mismo patrón que migración 019 — bypasea RLS sin depender de BYPASSRLS en el service_role): `public.search_concesion_minera(p_query, p_categoria, p_clasificacion, p_limit)` retorna filas + `match_rank` por similitud trigram sobre `nombre_zona`/`solicitante`; `public.concesiones_minera_stats()` retorna agregados para el dashboard admin y María. Únicos: `(categoria, numero_registro)` — la numeración se reinicia por categoría en los documentos fuente. **Indexes**: btree en `categoria`, `estado_expediente`, `clasificacion`, `codigo`; gin/trgm en `solicitante` y `nombre_zona` (pg_trgm habilitado en la misma migración). Seed via `node scripts/seed-concesiones-mineras.mjs` (lee `data/concesiones-mineras-registro.json`, upsert masivo en chunks de 200, idempotente por `(categoria, numero_registro)`).
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
| `services/concesionesService.ts` | Helpers del registro INHGEOMIN (migración 023). `searchConcesion()` envuelve el RPC `search_concesion_minera` con anon-key (RPC es `SECURITY DEFINER`, OK desde anon). `getConcesionStats()` agregados. `listConcesionesAdmin()` paginado con service-role + ilike fallback. `renderConcesionContextForMaria()` formatea hasta N filas en líneas tipo "• Zona — Solicitante — Categoría (Clasif) — fecha". Exporta `CATEGORIA_LABELS` / `CATEGORIA_SHORT` para reuso en UI. Tipos: `CategoriaConcesion`, `ClasificacionConcesion`, `ConcesionMinera`, `ConcesionSearchResult`, `ConcesionStats` |

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
- `GET /api/admin/minas` — lista todas las minas con cliente asociado. Read: admin/abogado/tecnico_ambiental.
- `POST /api/admin/minas` — crea mina. Body: `{ nombre*, cliente_id?, codigo?, latitud?, longitud?, municipio?, departamento?, area_hectareas?, tipo_mineral?, tipo_concesion?, estado? }`. Validación server-side de enums + rangos (lat ±90, long ±180, area ≥0). Pre-check de `codigo` único y `cliente_id` existente. 201/400/409. Write: admin/abogado.
- `GET /api/admin/minas/[id]` — detalle de mina + cliente slim + 5 componentes del Índice de Legalidad + últimos 20 contratos + últimas 20 transacciones + count de certificados. 404 si no existe. Read: admin/abogado/tecnico_ambiental.
- `PATCH /api/admin/minas/[id]` — actualiza mina con whitelist de campos (`cliente_id, nombre, codigo, latitud, longitud, municipio, departamento, area_hectareas, tipo_mineral, tipo_concesion, estado`). Mapea PG 23505 → 409. **No existe DELETE — los registros mineros son legalmente indelebles; el retiro es `PATCH { estado: 'clausurada' }`**. Write: admin/abogado.
- `GET /api/admin/concesiones?categoria=&clasificacion=&q=&limit=&offset=` — lista paginada del registro INHGEOMIN (filtra por categoría/clasificación, busca con `ilike` en `nombre_zona|solicitante|codigo`, paginación cursor-less con `range()`). Devuelve `{ rows, total }`. Read: admin/abogado/tecnico_ambiental.
- `GET /api/admin/concesiones/stats` — KPIs del registro INHGEOMIN (`total`, `explotacion_otorgada`, `exploracion_otorgada`, `solicitud_pendiente`, `metalicas`, `no_metalicas`, `pequena_mineria`, `ultima_solicitud`) llamando el RPC `concesiones_minera_stats()`. Read: admin/abogado/tecnico_ambiental.
- `GET /api/admin/concesiones/[id]` + `PATCH /api/admin/concesiones/[id]` — detalle y edición con whitelist de campos (`codigo, nombre_zona, fecha_solicitud, tipo_expediente, solicitante, estado_expediente, clasificacion, categoria, notas`). Mapea PG 23505 → 409. **No existe DELETE** — los registros del INHGEOMIN son históricos.
- `GET /api/concesiones/buscar?q=texto&categoria=&clasificacion=&limit=` — **endpoint público** (no requiere auth) que envuelve el RPC `search_concesion_minera`. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Diseñado para que María pueda llamarlo (también lo llama directamente vía el helper `buildConcesionContext` en `app/api/whatsapp/route.js`) y para una futura página `/registro`.
- `GET /api/admin/indice-legalidad/[mina_id]` — devuelve los 5 componentes del Índice (`tierra, inhgeomin, ambiental, municipal, registro`) con filas sintéticas `pendiente, 0` (`_persisted: false`) para componentes no persistidos + `total` 0–100. Read: admin/abogado/tecnico_ambiental.
- `PATCH /api/admin/indice-legalidad/[mina_id]` — upsert de un componente vía unique `(mina_id, componente)`. Body: `{ componente, estado?, puntaje? (0–20), notas? }`. Estampa `verificado_por` (auth.user.id) y `verificado_en` (server timestamp). Write: admin/abogado/tecnico_ambiental.
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
- **Comportamiento de precios en fines de semana**: tanto goldapi.io como Yahoo Finance devuelven el **último cierre del viernes** durante sábado y domingo (hasta el reapertura del mercado spot, domingo 6 PM ET / 4 PM Honduras). El precio que ve María "se repite" en esos días porque los mercados están cerrados — no es bug, es comportamiento real del mercado. Si el cliente pregunta "¿por qué no cambia?", la respuesta correcta es "los mercados internacionales están cerrados los fines de semana — el precio se actualiza el lunes a la apertura". `goldapi.io` ES accesible 24/7, pero el valor que retorna es el último quote.
- **`GOLDAPI_KEY` no seteada en producción (2026-05-10)**: `services/pricingService.ts:fetchGoldFromGoldAPI()` retorna `null` silenciosamente cuando la env var falta, así que `fetchAllPrices()` siempre cae a Yahoo Finance (`fuente=yahoo-finance` en logs). Setear la key en Vercel → Project → Settings → Environment Variables daría una fuente primaria más autoritativa en días hábiles. No urgente: Yahoo COMEX GC=F es válido como proxy.
- **`precios_diarios` cache write blocked por RLS (2026-05-10)**: cada invocación de María dispara `fetchAndStorePrices()` fire-and-forget, pero el INSERT/UPSERT falla con `new row violates row-level security policy for table "precios_diarios"` porque el `service_role` del proyecto no tiene `BYPASSRLS` (mismo root cause de la saga de auth resuelta en migración 019). Resultado: cache siempre vacío → cada turno fetcha live (~250 ms extra). Fix: nueva migración con `create policy "service_all_precios_diarios" on precios_diarios for all to service_role using (true) with check (true)`. Loggea como "non-fatal" así que no bloquea la respuesta de María.
- **Formato canónico de respuesta de precio de oro** (MARIA.md §8, v1.1+): cada respuesta que mencione precio de oro DEBE incluir SIEMPRE 4 viñetas — `LBMA`, `CHT compra al 80%`, `Tipo de cambio USD/LPS`, `Actualizado: [frescuraLabel]` — más `Finacoop` y `www.mape.legal`. El timestamp y el tipo de cambio USD/LPS son obligatorios aunque el cliente no los pida. La regla está implementada en el system prompt (`CUANDO PREGUNTAN POR EL PRECIO DEL ORO` + `SI EL CLIENTE MENCIONA UN PESO ESPECIFICO EN GRAMOS`) y reflejada en MARIA.md §8.
- **Registro INHGEOMIN (concesiones)**: helper `buildConcesionContext()` se dispara con la regex `CONCESION_TRIGGERS` (palabras "concesión", "INHGEOMIN", "permiso minero/exploración/explotación", "en solicitud", "¿quién tiene la concesión?", "empresa minera", "¿dónde está ubicado?"). Limpia stopwords con boundary `\b` para preservar nombres como "Dorado", llama el RPC `search_concesion_minera` (anon-key, RPC es SECURITY DEFINER) con `p_limit: 5`, y inyecta un bloque `REGISTRO INHGEOMIN — concesiones encontradas (datos públicos):` con instrucción explícita de **no afirmar aprobación si la categoría es `solicitud_pendiente`**. 587 registros disponibles (125 explotación otorgada + 170 exploración otorgada + 292 en solicitud). Falla silenciosa: si el RPC retorna error, loggea `[concesiones] non-fatal` y devuelve string vacío — nunca bloquea la respuesta de María.
- **RAG semántico (`maria_knowledge`)**: `retrieveKnowledge()` en `app/api/whatsapp/route.js` es **híbrida**. Intenta primero búsqueda semántica vía `embedQuery()` de `lib/maria/embeddings.ts` (OpenAI `text-embedding-3-small`, 1536 dims) → RPC `match_maria_knowledge(query_embedding, match_threshold=0.7, match_count=3)` con cosine similarity sobre `maria_knowledge.embedding`. Si no hay `OPENAI_API_KEY`, si el embed call falla, o si el threshold no devuelve filas, cae al RPC FTS determinístico (`search_maria_knowledge_fts`) que sigue creado por la misma migración 024. Ambos RPCs son `SECURITY DEFINER` con owner = `postgres` (patrón de migración 019 — bypasean RLS sin depender de BYPASSRLS). El bloque inyectado al system prompt se llama `CONTEXTO DEL SISTEMA`. Backfill de embeddings: `node scripts/embed-maria-knowledge.mjs` (idempotente, procesa filas con `embedding IS NULL`; flag `--force` re-embebe todo; `--dry-run` solo estima costo).
  - **Migración 024**: crea (o adiciona idempotentemente columnas a) `maria_knowledge`, instala extensión `vector`, agrega índice `ivfflat` sobre `embedding` con `vector_cosine_ops` + índice `gin` para FTS, y crea ambos RPCs. Hasta que se aplique en Supabase Studio, el flow sigue funcionando vía el RPC FTS existente — el embedding path simplemente no retorna nada y cae al fallback.
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

**Estado real (Phase 1, 2026-05-10):** la landing activa es `app/page.tsx` (~580 líneas, autocontenido, repositionada como **superficie institucional**, no de ventas). Estructura: Nav · Hero · Identidad (`#identidad`) · Cumplimiento (`#cumplimiento`) · Verificación (`#verificacion`) · Contacto (`#contacto`) · Footer. **No hay formulario de contacto, ni CTAs hacia clientes** — los clientes entran por María (WhatsApp) y relaciones directas. Los datos institucionales son reales: WhatsApp `+504 9737 3139`, correo `gerencia@mape.legal`, oficina Nexcrea (Tegucigalpa). Bilingüe ES/EN vía helper `t(es, en)` y `localStorage('ml_lang')`.

Los 15 archivos de `components/landing/*` fueron **eliminados en Phase 1** (ver commit `chore(landing): remove orphan components/landing/*`). Cualquier cambio de UI ahora va a `app/page.tsx`.

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
- ~~`LOGO CHT.png` — referenciado en `Hero.tsx:34` (huérfano)~~ — resuelto en Phase 1: `Hero.tsx` eliminado.
- ~~`Map.png` — referenciado en `Problem.tsx:83` (huérfano)~~ — resuelto en Phase 1: `Problem.tsx` eliminado.

## Verificación pública de Certificados de Origen

**Estado (Phase 1, 2026-05-10):** superficie pública de verificación habilitada.
- **`/verificar`** — entrada con input para número de certificado.
- **`/verificar/[numero]`** — server component (`force-dynamic`) que hace lookup contra la vista `certificados_origen_publicos` con el cliente Supabase **anon** instanciado dentro de la función (lazy-init, ver §Framework). Renderiza estados `vigente | revocado | expirado | suspendido | no encontrado` con pill de color del Color Manual v1.0.
- **`GET /api/verificar/[numero]`** — JSON público read-only, mismo lazy-init, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Status 200 con `{found:true, certificado}`, 404 con `{found:false}`, 400 si `numero` está vacío o > 64 chars.
- **Tabla `certificados_origen`** (migración 020) con RLS — admin/abogado pueden write; admin/abogado/tecnico_ambiental pueden read en la base table; público solo lee la vista `certificados_origen_publicos` (anon + authenticated tienen `select`).
- **La vista expone**: `numero_certificado`, `fecha_emision`, `peso_oro_g`, `estado`, `valido_hasta`, `hash_verificacion`, `mina_nombre`, `mina_codigo`, `mina_municipio`, `mina_departamento`. **Nunca PII del productor, monto de transacción, ni precio LBMA.**
- **Schema gotcha**: `public.minas` no tiene `permiso_inhgeomin` — la vista usa `m.codigo` (el campo INHGEOMIN-style, e.g. `MINA-2026-001`) y lo expone como `mina_codigo`.
- **Migración numerada 020**, no 010 (010 ya estaba tomada por `010_admin_commands_onboarding.sql`).
- **Demo seed**: `CO-2026-0001-DEMO` insertado por la migración con un `DO $$ ... $$` block que skipea silenciosamente si `minas` o `expedientes` están vacíos en el ambiente.

## Biblioteca Archivos Mineros (`#archivos-mineros`, 2026-05-10)

Sección institucional bajo el ancla `#archivos-mineros` en la landing (`app/page.tsx`); enlace en el nav como "Mapa Minero" / "Mining Map". Mapa interactivo 3D de 8 sitios mineros verificados de Honduras renderizado con MapLibre GL JS v5 (~220 KB gzipped, WebGL, GPU-accelerated). Framing: cada pin es contexto histórico **y** candidato de formalización dentro del universo donde opera CHT.

**Archivos** (todos `'use client'`):
- `components/terrain/mining-data.ts` — dataset de 8 sitios + `TYPE_COLORS` / `STATUS_COLORS` / `*_LABELS_*` bound a tokens.
- `components/terrain/MiningMap3D.tsx` — core del mapa, controles, popups.
- `components/terrain/SiteInfoPanel.tsx` — panel de detalle + CTA WhatsApp.
- `components/terrain/MapLegend.tsx` — leyenda colapsable.
- `components/terrain/TerrainMapSection.tsx` — wrapper de sección + stats bar + responsive overrides.

**Tiles + 3D terrain**:
- Default: CartoDB Voyager raster + DEM de `demotiles.maplibre.org` (SRTM hillshade). Gratis, sin API key — el mapa funciona out-of-the-box.
- Upgrade: si `NEXT_PUBLIC_MAPTILER_KEY` está set, `getMapStyle()` retorna `https://api.maptiler.com/maps/hybrid/style.json?key=…` y `setTerrain()` activa extrusión 3D real con `exaggeration: 1.5`. Free tier 100 K req/mo en cloud.maptiler.com.

**Tokens del Color Manual v1.0** (cero hex literals en `components/terrain/`, regla de DESIGN.md):

| Tipo mineral → token | Status → token |
|---|---|
| `gold` → `var(--amber)` | `active` → `var(--green)` |
| `zinc` → `var(--blue)` | `inactive` → `var(--t3)` |
| `lead` → `var(--plum)` | `contested` → `var(--red)` |
| `silver` → `var(--t3)` | `historical` → `var(--earth)` |
| `iron` → `var(--red)` |  |
| `antimony` → `var(--slate)` |  |
| `historical` → `var(--earth)` |  |

Las CSS variables `var(--token)` funcionan dentro de inline `style` (el browser las resuelve) y dentro de `color-mix(in oklch, ${token} 14%, white)` para fondos translúcidos de pills/badges. No se importa ningún hex desde el dataset.

**Init crítico — `pitch: 0, bearing: 0`** (`MiningMap3D.tsx:213-214`). Con `pitch > 0`, los DOM markers (`maplibregl.Marker({ anchor: 'center' })`) **están correctamente anclados a sus coordenadas geográficas**, pero la perspectiva los proyecta visualmente alejados de las etiquetas del basemap (que se renderizan en el raster del tile, proyección distinta). A zoom 6.5 con `pitch: 45` el offset visible es de varios pixels — un usuario sin contexto lo lee como "los pines están en el lugar equivocado" (síntoma reportado en commit `f18ab3c`). El fix correcto es default flat; el usuario puede inclinar manualmente con drag-right-click y el knob `visualizePitch` del NavigationControl sigue disponible. **Aplica a cualquier futuro uso de DOM markers en este proyecto — symbol layers (`icon-pitch-alignment: map`) son la única forma de que markers + pitch coexistan sin distorsión.** El `flyTo` al seleccionar un sitio tampoco escala pitch.

**Sin animaciones continuas** (DESIGN.md §4). El script PDF original incluía un `@keyframes mining-pulse` para markers con `status: 'active'`; se eliminó por la regla del manual. El color verde de `STATUS_COLORS.active` ya transmite "activa" sin animación.

**CTA "Iniciar trámite con CHT"** (`SiteInfoPanel.tsx`): cada pin es un cliente potencial. Botón verde-moss al fondo del panel que abre `https://wa.me/50497373139?text=…` con mensaje pre-llenado incluyendo `nameEs`, `department`, `municipality` del sitio. **Gate por `status`**:
- `active` → mostrar (operación viva, candidato directo a formalización).
- `inactive` → mostrar (dormido, posible reactivación vía formalización).
- `contested` → **ocultar** (Guapinol/Los Pinares — sensible políticamente; vías formales, no WhatsApp en frío).
- `historical` → **ocultar** (corporaciones extintas — sin contraparte).

**Dataset (8 sitios, hardcoded en `mining-data.ts`)**:

| ID | Sitio | Tipo | Status | Departamento |
|---|---|---|---|---|
| `san-andres` | Mina San Andrés | gold | active | Copán |
| `el-mochito` | Mina El Mochito | zinc | active | Santa Bárbara |
| `clavo-rico` | Clavo Rico / El Corpus | gold | contested | Choluteca |
| `guapinol` | Guapinol (Los Pinares) | iron | contested | Colón |
| `rosario` | Rosario (Histórica) | historical | historical | Francisco Morazán |
| `cobra-oro` | Cobra Oro de Honduras | gold | inactive | Cortés |
| `el-quetzal` | El Quetzal (Antimonio) | antimony | inactive | Copán |
| `la-pochota` | La Pochota | silver | historical | Choluteca / Distrito Clavo Rico |

Stats bar derivado (`TerrainMapSection.tsx`): 4 numerales en `var(--font-display)` 28px — total mapeados / activas / controvertidas / históricas. Actualmente lee `8 / 2 / 2 / 2`.

**Future work** (plan operativo en `/root/.claude/plans/yes-proceed-suggestions-are-abundant-rain.md`):
- **Wire al Supabase `minas` table** vía vista pública `minas_publicas` (mismo patrón que `certificados_origen_publicos` — migración 020 + `app/verificar/[numero]/page.tsx`). Requiere extender `minas` con `descripcion_es`, `descripcion_en`, `desde`, `operador`, `produccion`, `commodities`; nueva vista que strippea `cliente_id`; nueva ruta `app/api/archivos-mineros/route.ts` con lazy-init anon + `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`.
- **Filtros UI** por mineral y status (multi-select chips arriba del mapa).
- **Expandir dataset** a 50–100 sitios usando INHGEOMIN bulletin + BCH histórico + Acuerdo 042-2013 annexes. Cada row debe tener fuente citable y GPS verificado. La migración 023 (`concesiones_mineras_registro`) shipped el 2026-05-11 ya carga 587 concesiones INHGEOMIN — evaluar si la archive map debería leer de ahí en vez de mantener un dataset separado.

## SEO / Open Graph

**Estado (Phase 1, 2026-05-10):** `app/layout.tsx` declara `metadataBase` (resuelto contra `NEXT_PUBLIC_SITE_URL`, fallback `https://mape.legal`), `title` con `template '%s · MAPE LEGAL'`, `description`, `applicationName`, `authors`, `keywords`, `alternates.canonical`, `openGraph` (locale `es_HN` + `alternateLocale: 'en_US'`, og:image `/images/RIVER AND MOUNTAINS.png` 1200×630), `twitter.summary_large_image`, y `robots` con `googleBot` tuning. Las páginas pueden sobreescribir título y descripción específicos vía `export const metadata`.
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
- **Sidebar compartido**: `components/dashboard/SidebarNav.tsx` (client island con `usePathname`) lo usan tanto `app/admin/layout.tsx` como `app/dashboard/layout.tsx`. Recibe `items: { href, label, icon, exact? }[]` donde **`icon` es JSX pre-renderizado en el layout server-side**, no una referencia al componente Lucide. El flag `exact` se aplica a las rutas raíz (`/admin`, `/dashboard`) para que no queden activas en cada subruta. Estado activo per DESIGN.md §6: fondo `color-mix(in oklch, var(--moss) 14%, var(--ink))` + `boxShadow: 'inset 2px 0 0 var(--moss)'` (no genera layout shift) + `aria-current="page"`. Hover: `color-mix(in oklch, var(--slate) 18%, var(--ink))` con texto blanco.
- **No pasar referencias de íconos Lucide como prop value desde un server component** — `lucide-react` exporta cada ícono con `'use client'`, así que dentro de un array prop (e.g. `Icon: Users`) se serializan como funciones y RSC falla con `Functions cannot be passed directly to Client Components`. La forma correcta es renderizar el ícono a JSX en el layout (`icon: <Users size={18} strokeWidth={1.5} />`) — el JSX apunta a la client reference y serializa OK. Patrón usado en `app/admin/layout.tsx` y `app/dashboard/layout.tsx` con la constante `ICON = { size: 18, strokeWidth: 1.5 }`.
- **Admin + dashboard tokenizados (2026-05-10)**: ambas superficies migradas al Color Manual v1.0 — fondo de página `var(--bg-soft)`, sidebar `var(--ink)`, cards `var(--bg)` con `var(--border)` 1px, tablas siguen DESIGN.md §3 (header `var(--ink)` blanco, body claro), pills de rol vía `color-mix(... var(--token) 14%, white)`. Cero hex literales en `app/admin/**` ni en `app/dashboard/layout.tsx` — cualquier regression debe fallar el grep `#1F2A38\|#A3A8AB\|rgba(94,107,123` sobre esos paths.

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
OPENAI_API_KEY                 # Embeddings RAG (text-embedding-3-small). Opcional: sin esta key, retrieveKnowledge() cae al RPC FTS — el flow no se rompe, sólo se degrada el recall semántico
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

## Master Control Panel — María (`app/admin/maria/**`, 2026-05-10)

Superficie admin completa para operar el asistente virtual desde el navegador. Vive bajo `/admin/maria`, gateada por el chequeo de admin existente en `app/admin/layout.tsx` (no agrega un guard nuevo).

- **`/admin/maria`** — landing del MCP. Tiles KPI (chats hoy, leads en captura, transacciones pendientes, suscriptores activos), funnel onboarding 5 estados, último broadcast (con `aborted_reason` si aplica), último comando admin desde WhatsApp, precios del día, salud del `WHATSAPP_TOKEN`. Polling cada 10 s pausado cuando `document.hidden`.
- **`/admin/maria/conversaciones`** — list de cada teléfono con el que María chateó: cliente vinculado (si existe), estado de onboarding, último mensaje + tiempo relativo, búsqueda debounced 300 ms. Polling 5 s pausado durante typing.
- **`/admin/maria/conversaciones/[phone]`** — hilo completo + take-over. UI 2 columnas: chat a la izquierda (bubbles user/María/Admin con colores distintos), panel derecho con cliente + onboarding + transacciones. Composer con `Cmd/Ctrl+Enter` para enviar; auto-scroll solo cuando el usuario está dentro de 80 px del fondo. **El POST envía vía Meta Cloud API y luego inserta en `conversaciones_whatsapp` con `numero_whatsapp` en la forma `whatsapp:+504…`** (la canónica que usa Twilio en `app/api/whatsapp/route.js:876`) — si insertara la forma stripped, María no vería el mensaje en su próxima query de historial. El contenido lleva el prefijo visible `[Admin · email] …` para el thread, pero **`route.js` lo strippea con `ADMIN_PREFIX_RE = /^\[Admin · [^\]]+\]\s*/` antes de armar el `messages` array de Claude** — sin eso Claude parroteaba el bracket convention y filtraba el correo del admin al cliente.
- **`/admin/maria/clientes`** — vista unificada `cliente | lead | visitor` con score de completeness (5/5 si el cliente tiene `nombre, dpi, municipio, situacion_tierra, tipo_mineral`). Funnel de onboarding visible. Acciones por fila: reiniciar onboarding (DELETE), abrir conversación, ver expedientes.
- **`/admin/maria/transacciones`** — cola de `transacciones_pendientes`. Filtros por estado. Botones inline `Confirmar`/`Cancelar` que hacen `PATCH /api/admin/maria/transactions/[id]`.
- **`/admin/maria/broadcast`** — control center del broadcast diario: toggles por métrica (gold/silver/usd_hnl/copper), audiencia por rol (minero/comprador/tecnico/admin), horario documentado (la programación real vive en `vercel.json`), CRUD de suscriptores (`usuarios_broadcast`), historial de envíos (`broadcast_log`) con `aborted_reason`, y botón **Enviar ahora**.
- **`/admin/maria/auditoria`** — timeline de `admin_actions` (comandos via passphrase WhatsApp). Filtros por `command_type`. Payload jsonb pretty-printed.
- **`/admin/permisos`** — matriz read-only `rol × permiso` calculada desde `roles.permisos` (con `*` = acceso total). Edición sigue viviendo en `/admin/roles`.

### APIs nuevas (todas `requireRole('admin')`, todas `force-dynamic`)

| Ruta | Método | Propósito |
|---|---|---|
| `/api/admin/maria/stats` | GET | KPIs del MCP. Dedupe de teléfonos via `normalizePhone`. |
| `/api/admin/maria/conversations` | GET | Lista por teléfono con last_message + cliente + onboarding. |
| `/api/admin/maria/conversations/[phone]` | GET | Hilo + cliente + onboarding + transacciones. |
| `/api/admin/maria/conversations/[phone]` | POST | Take-over: envía Meta API y loguea con clave `whatsapp:+504…`. |
| `/api/admin/maria/clientes` | GET | Unión clientes + leads + visitors con completeness. |
| `/api/admin/maria/onboarding/[phone]` | PATCH | Upsert: inserta si no existe (requiere `estado`); update si existe. |
| `/api/admin/maria/onboarding/[phone]` | DELETE | Reinicia el onboarding. |
| `/api/admin/maria/transactions` | GET | Lista filtrable por `estado`. |
| `/api/admin/maria/transactions/[id]` | PATCH | Confirmar/cancelar transacción. |
| `/api/admin/maria/audit` | GET | `admin_actions` paginado, filtrable por `command_type`. |
| `/api/admin/broadcast/config` | GET+PATCH | Versión admin-gated del config existente. Acciones `enable_metric, disable_metric, set_currency, update_metric, set_audience, set_schedule`. |
| `/api/admin/broadcast/log` | GET | `broadcast_log` paginado. |
| `/api/admin/broadcast/subscribers` | GET+POST | Lista + add. **POST hace pre-check antes de upsert: si la fila existe solo actualiza `nombre, rol` — nunca toca `activo`/`suscrito`** (evita re-enrollar opt-outs por accidente, requisito WhatsApp policy). |
| `/api/admin/broadcast/subscribers/[id]` | PATCH+DELETE | Edit/borrar. |
| `/api/admin/broadcast/trigger` | POST | **Fire-and-forget** wrapper de `runDailyBroadcast`. No `await` — la promesa puede exceder el timeout de Vercel functions con muchos suscriptores. La UI ve el resultado en `broadcast_log` en el siguiente poll. |

### `lib/maria/normalizePhone.ts`

Helper canónico para todas las lookups admin. Strippea prefijos `whatsapp:`/`tel:`/`sms:`, decodifica URL-encoding, deja solo dígitos, y prepende un único `+`. Cualquier ruta admin que mire `conversaciones_whatsapp` debe pasar por esto antes de construir candidatos `[normalized, 'whatsapp:'+normalized]` — los rows en esa tabla viven en ambas formas (Twilio inserta prefijado, Meta inserta stripped).

### Sidebar nav (`app/admin/layout.tsx`)

Dos secciones agrupadas: **admin items** (Resumen · Usuarios · Profesionales · Roles · Permisos · Contenido · **Concesiones** · Configuración) y **María items** (Panel María · Conversaciones · Clientes y leads · Transacciones · Broadcast · Auditoría) separadas por un eyebrow `MARÍA` en mono small caps. Los items pasan `icon: <Foo {...ICON} />` (JSX pre-renderizado), no `Icon: Foo` — `SidebarNav` es un client component y los component refs de lucide-react no cruzan el boundary RSC server→client. El ícono de Concesiones es `Mountain` de lucide-react.

## Registro de Concesiones INHGEOMIN (`app/admin/concesiones`, `app/registro`, 2026-05-11)

Base de datos pública de **587 concesiones mineras** en Honduras transcritas de 3 PDFs INHGEOMIN. Cubre tanto las concesiones otorgadas como las solicitudes pendientes — la mayoría son pendientes de aprobación.

### Datos
- **Fuente**: 3 PDFs subidos por el equipo (`Concesiones_Mineras_Otorgadas_para_Exploraci_n_1/2/3.pdf`, los nombres tienen el typo del scanner). PDF 1 = otorgadas para EXPLOTACIÓN (125 filas, código 3–543, El Mochito el más antiguo, 1934-11-13). PDF 2 = otorgadas para EXPLORACIÓN (170 filas). PDF 3 = METÁLICAS EN SOLICITUD (292 filas — incluye `Solicitud de Concesión Minera` regular Y `Solicitud de Pequeña Minería`).
- **Transcripción**: hecha por 4 agentes paralelos con vision sobre PNGs a 400 DPI (`pdftoppm -r 400`). OCR vía tesseract fallaba (0 lines) porque los scans son CamScanner blurry. Cada agente produjo un JSONL en `/tmp/transcripts/*.jsonl`; `scripts/aggregate-concesiones-jsonl.mjs` los consolida en `data/concesiones-mineras-registro.json` agregando `categoria` y `fuente_documento`.
- **Distribución final**: 125 explotación + 170 exploración + 292 solicitud = **587 filas**. Por clasificación: 243 Metálica + 250 No Metálica + 94 Pequeña Minería Metálica. Por estado: 170 Otorgada Exploración, 125 Otorgada Explotación, 191 Solicitud Exploración, 94 Solicitud Explotación, 7 Suspenso.

### Activación en producción
1. **Aplicar migración 023** en Supabase Studio → SQL Editor (Vercel deploy NO aplica migraciones).
2. Desde una máquina con `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`: `node scripts/seed-concesiones-mineras.mjs` — idempotente, upsert por `(categoria, numero_registro)` en chunks de 200, re-ejecutable sin duplicar.
3. Una vez seedeada la tabla, todos los surfaces (admin, público, María) la ven automáticamente.

### Surfaces
| Surface | Path | Audience |
|---|---|---|
| Admin UI (KPIs + filtros + tabla paginada) | `/admin/concesiones` | admin only (guard del layout) |
| Búsqueda pública en vivo (debounce 250ms) | `/registro` | anon |
| API admin list | `GET /api/admin/concesiones` | admin/abogado/tecnico_ambiental |
| API admin stats | `GET /api/admin/concesiones/stats` | admin/abogado/tecnico_ambiental |
| API admin detail + edit | `GET / PATCH /api/admin/concesiones/[id]` | admin/abogado/tecnico_ambiental |
| API público de búsqueda | `GET /api/concesiones/buscar?q=&categoria=&clasificacion=&limit=` | anon (cache 60s + SWR 5min) |
| María (WhatsApp) RAG | `buildConcesionContext` en `route.js` | cliente vía WhatsApp |

### Schema gotchas
- **Unique key** es `(categoria, numero_registro)`, NO `numero_registro` solo — cada PDF reinicia la numeración desde 1.
- **Codigo NO es único** — los 3 PDFs comparten un mismo espacio de códigos INHGEOMIN; la unicidad debe ser por (categoria, numero_registro).
- **Suspenso es estado, no clasificación** — 7 filas en `solicitud_pendiente` tienen `estado_expediente = 'Suspenso'` pero su `clasificacion` sigue siendo "Metálica" / "No Metálica".
- **No existe DELETE** en el API admin — los registros del INHGEOMIN son históricos, sólo `PATCH` con whitelist de campos.

### María — guardrail crítico
El bloque inyectado a María dice literalmente "*La mayoría de los registros marcados 'En Solicitud' siguen pendientes de aprobación; no afirmes que ya está aprobada una concesión que figura como solicitud_pendiente.*" — esto evita que María afirme que una concesión está aprobada cuando realmente está pendiente. **Si modificás el helper, mantené este guardrail.**

## Auditoría — deuda técnica conocida (2026-05-03, parcialmente resuelta 2026-05-09)

Documentado para evitar trabajo duplicado en futuras sesiones. Ninguno está bloqueando producción.

> **Update 2026-05-09 (`claude/update-ui-colors-wGO7B`):** la sección de paleta + tipografía + audit de `app/page.tsx` / `app/globals.css` / `app/layout.tsx` quedó **resuelta** al adoptar el MAPE LEGAL Color Manual v1.0. Ver README §0 y commit `39875cf`. Los items que se mantienen son los marcados ⚠ abajo; los demás están tachados o eliminados.

> **Update 2026-05-10 (`claude/admin-audit-dashboard-NHVaE`):** Master Control Panel para María shipped + revisado por dos agentes (lógica + diseño/código). Findings críticos resueltos en commit `c4057fa` — incluyendo (a) take-over POST loguea con la forma `whatsapp:+504…` que matchea la query de `route.js` para que María vea sus propias respuestas admin, (b) `route.js` strippea el prefijo `[Admin · email]` antes de armar el prompt de Claude para no filtrar correos del admin al cliente, (c) `/api/admin/broadcast/trigger` es fire-and-forget para no exceder timeout de Vercel functions, (d) POST de `/api/admin/broadcast/subscribers` preserva opt-out (no resetea `activo`/`suscrito` en upsert), (e) PATCH de onboarding hace upsert. Ver sección "Master Control Panel — María" arriba.

### Auth — "Sin rol asignado" (resuelto 2026-05-09 vía RPC SECURITY DEFINER)

**Causa raíz**: el `service_role` en este proyecto Supabase no tenía `BYPASSRLS` (o el grant no se propagó), así que el SELECT directo `from('user_roles').select(...)` evaluaba la policy `"Users can read own role"` con `auth.uid()=null` y devolvía 0 filas, indistinguible de un row real faltante. El probe en `/api/debug/auth-config` daba falso positivo (`probe.status:'ok'`) porque sólo chequeaba ausencia de error en el HEAD count, no que devolviera filas reales.

**Fix aplicado en 3 PRs encadenados (rama `claude/fix-login-user-roles-LPvxC` y follow-ups)**:
- **PR #99** — `fix(auth): SECURITY DEFINER RPC for role lookup; drop legacy admin-token`:
  - Migración 019: RPC `public.get_user_role_for_login(uuid)` `SECURITY DEFINER` con owner = `postgres` → bypasea RLS independientemente del estado de `service_role.rolbypassrls`. También: tighten de la INSERT policy de 018 a `user_id = auth.uid()`.
  - Helper compartido `lib/userRoleLookup.ts:lookupUserRole()` que envuelve el RPC + fallback con `ignoreDuplicates: true` (cierra el riesgo de demote bajo race).
  - 5 routes actualizadas (`login`, `oauth-session`, `auth/callback`, `refresh`, `serverAuth`) — todas usan el mismo helper.
  - Probe del debug endpoint endurecido: ahora distingue `rpc_status` (path real del flow) de `service_role_bypassrls` (informativo).
  - Borrado de las rutas legacy `/api/admin/auth/login`, `/api/admin/auth/logout`, `/api/admin/auth/me`, `/admin/login`, y de la cookie `admin-token` — código muerto desde el login unificado.
- **PR #100** — `fix(admin/clientes): restore const clientes after merge conflict drop`: hotfix porque toda la rama `main` venía con build de producción rota desde PR #96 — un merge conflict en `app/api/admin/clientes/route.ts` dropeó `const clientes = (data ?? []) as ClienteRow[];` pero dejó `clientes.map(...)` intacto → `Cannot find name 'clientes'`. El fix de #99 no llegaba a producción porque ningún deploy de main estaba pasando. **Lección aplicable a futuras merges**: correr `npx next build` localmente sobre `main` antes de mergear PRs grandes; lint+tsc no detectan undefined-variable en algunos contextos.
- **PR #101** — `fix(oauth-callback): never get stuck silently on /auth/callback`: capas defensivas en `app/auth/callback/page.tsx` para cubrir cuelgues silenciosos del fetch al servidor (ver sección Auth arriba — "Callback defensivo").

Follow-up diferido: auto-promover `@cht.hn` / `@mape.legal` a `abogado` en el callback (hoy todos los Google sign-ins quedan como `cliente` por default del trigger 015 → `/portal`).

**Validación end-to-end (2026-05-10)**: login admin con cachivo@gmail.com entra a `/admin` correctamente tras aplicar migración 019 en Supabase Studio + deploy en Vercel.

### Landing — resuelto en Phase 1 (2026-05-10)
- ✅ `components/landing/*` (15 archivos) eliminados.
- ✅ Refs a `LOGO CHT.png` y `Map.png` desaparecen al borrar los huérfanos.
- ✅ Toda la landing huérfana (incl. emojis en `WhyNow.tsx`, `animate-pulse` en `Roadmap.tsx`, `${sign}<0.01%` en `PriceWidgets.tsx`, hex `#1A1018` en `ValorSection.tsx`) ya no existe en el repo.

### `app/page.tsx` (landing activa) — resuelto en Phase 1
- ✅ Teléfono placeholder `+504 9XXX-XXXX` reemplazado por `+504 9737 3139` real.
- ✅ Nav-logo ahora apunta a `/` (Next `Link`).
- ✅ Quote section eliminada (era marketing); el hero institucional usa solo comillas curvas en hero/identidad/cumplimiento.
- ✅ Refs a `/dashboard.html` desaparecen al borrar `Roadmap.tsx` / `Problem.tsx`.

### Admin + dashboard sidebar — resuelto 2026-05-10 (commit `94b775a`)
- ✅ `app/admin/layout.tsx` y `app/dashboard/layout.tsx` migradas al Color Manual v1.0: fondo `var(--bg-soft)`, sidebar `var(--ink)` con texto `var(--slate-lt)`.
- ✅ Sidebar compartido extraído a `components/dashboard/SidebarNav.tsx` (client island con `usePathname`) — antes ambos layouts duplicaban el mismo bloque de `<Link>`s sin estado activo.
- ✅ Estado activo per DESIGN.md §6: `color-mix(... var(--moss) 14%, var(--ink))` + `inset 2px 0 0 var(--moss)` + `aria-current="page"`. El flag `exact: true` en items de las rutas raíz (`/admin`, `/dashboard`) evita que queden activas en cada subruta.
- ✅ 6 páginas admin tokenizadas (`(protected)/page.tsx`, `(protected)/usuarios`, `(protected)/profesionales`, `config`, `contenido`, `roles`): cards blancas `var(--bg)` sobre página `var(--bg-soft)`, tablas con header `var(--ink)` + body claro per §3, pills de rol vía `color-mix(... var(--token) 14%, white)` (red=admin, blue=abogado, green=tecnico, earth=cliente, slate=sin_rol).
- ✅ Quality gates verificados antes del commit: cero hex literales en `app/admin/**` y `app/dashboard/layout.tsx`; cero `rounded-2xl`, `font-extrabold`/`font-black`, `shadow-xl`/`shadow-2xl`; `next build` compila en 5.4s sin errores nuevos.

### `/admin` y `/dashboard` 500 en producción — resuelto 2026-05-10 (commit `d94394d`)
- **Síntoma**: tras login admin, `mape.legal/admin` devolvía 500 (página en blanco / spinner indefinido). Mismo bug para `/dashboard` aunque solo los admins lo notaron porque son los que aterrizan ahí post-login.
- **Causa raíz**: PR #104 extrajo `SidebarNav` como client island y los layouts (server components) le pasaban `Icon: LayoutDashboard` —una **referencia a la función**— dentro del array `navItems`. `lucide-react` exporta cada ícono con `'use client'`; cuando RSC intenta serializar el prop, falla con `Functions cannot be passed directly to Client Components` y la página entera 500-ea durante stringification. `next build` y `tsc --noEmit` pasan limpios — el error ocurre solo en SSR runtime, así que ningún gate pre-deploy lo detectó.
- **Fix**: renderizar los íconos a JSX en el layout (`icon: <LayoutDashboard size={18} strokeWidth={1.5} />`) y consumir `icon: ReactNode` en `SidebarNav`. JSX apuntando a una client reference sí serializa correctamente.
- **Repro local**: stub `getServerAuth` para devolver `{ role: 'admin' }`, hit `/admin` → 500 con stack `at stringify (<anonymous>)` y `digest: 'XXXXXXXXXX'` para cada ícono. Tras el fix, todas las rutas (`/admin`, `/admin/usuarios`, `/admin/profesionales`, `/admin/roles`, `/admin/contenido`, `/admin/config`, `/dashboard`, `/dashboard/expedientes`, `/dashboard/minas`) devuelven 200.
- **Lección recurrente** (segunda vez en este repo, ver también PR #100): el type-check / build pueden mentir sobre la salud de SSR. Para layouts y server components que pasan props complejos a client islands, hay que probar el render runtime (curl con cookies stub, o un test e2e).

### Carryover Phase 0 (no en scope de Phase 1)
- ⚠ `app/dashboard/minas/page.tsx:72` — lint error `react-hooks/set-state-in-effect` (pre-existente).
- ⚠ `app/api/admin/clientes/route.ts:61` — TS error `Cannot find name 'clientes'` (pre-existente, bloquea `npm run build` type-check). El compile step pasa; solo el type-check falla. Phase 1 no introduce nuevos errores.
