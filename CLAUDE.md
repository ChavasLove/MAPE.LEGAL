@AGENTS.md
@DESIGN.md

# Arquitectura y Convenciones — MAPE.LEGAL

## Framework
Next.js **16.2.4** con App Router y Turbopack. Esta versión tiene cambios importantes:
- `middleware.ts` está **obsoleto** — usar `proxy.ts` con export named `proxy` (no `middleware`)
- `params` en rutas dinámicas es `Promise<{id: string}>` — siempre `await params` antes de usar
- Leer `node_modules/next/dist/docs/` antes de escribir código relacionado con routing o server components
- **Nunca instanciar Supabase/Anthropic clients a nivel de módulo en route handlers ni en componentes** — el build de Next.js ejecuta los módulos durante "page data collection" y el SSR/prerender corre `useState` initializers; si las env vars no están disponibles en ese contexto, `createClient(undefined, ...)` lanza `supabaseUrl is required` y rompe el build entero. Patrones seguros:
  - **Importar el proxy `supabase` de `services/supabase.ts`** — es un `Proxy<SupabaseClient>` que defiere `createClient` a la primera invocación de método. Cualquier servicio nuevo que necesite el cliente anon usa `import { supabase } from '@/services/supabase'` y lo invoca directo, sin null-check (el proxy es siempre truthy; si las env vars faltan, la primera llamada tira un error claro `[Supabase] Missing environment variables at runtime`). Patrón usado en `cmsService`, `expedientesService`, `fasesService`, `dashboardService`, `concesionesService`. **No existe un símbolo `getSupabase` exportado** desde `services/supabase.ts` — el `getSupabase()` que aparece en `app/api/whatsapp/route.js:17` es un helper **local privado** de ese único archivo, no se importa. Confundirlos rompió 11 deploys consecutivos (commit `aabc377` → fix `7e74179`, ver §Auditoría).
  - Route handlers legacy: gatear el const con `process.env.X ? createClient(...) : null`, o usar el accesor lazy local `getSupabase()` de `app/api/whatsapp/route.js`. **Si migrás de `const supabase` a `getSupabase()`, hay que reemplazar TODOS los callsites en el mismo PR** — el merge `39f7d11` rompió María por dejar 10 referencias a `supabase` undefined que tiraban `ReferenceError` en cada webhook (caught por el outer try/catch → todos los usuarios recibían "tuvimos un problema técnico"). Fix en commit `a0df1bc`.
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
  - 025: **Desbloquea el cache de `precios_diarios`** (aplicada en producción 2026-05-14). Idempotente — re-crea la policy `"service_all_precios_diarios"` (mismo cuerpo que 009, pero `drop policy if exists` + `create policy` defensivo contra drift de schema) **y** expone el RPC `public.upsert_precios_diarios(p_fecha, p_oro, p_plata, p_usd_hnl, p_cobre, p_fuente, p_fetched_at) returns uuid` `SECURITY DEFINER`, owner = `postgres`, grant execute únicamente a `service_role`. Mismo patrón que 019/023/024 — funciona aunque el `service_role` del proyecto no tenga `BYPASSRLS`. `services/pricingService.ts:fetchAndStorePrices()` intenta el RPC primero y cae al upsert directo (log `[pricingService] upsert_precios_diarios RPC failed, falling back...`) solo como red de seguridad si el RPC desaparece. Smoke test 2026-05-14: insert con `fuente='smoke-test'` retornó UUID, fila persistida correctamente, cleanup confirmado (0 rows residuales).
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
  - **Optimistic concurrency (PR #176)**: el UPDATE de avance gatea sobre la fase previamente leída (`.eq`/`.is` sobre `fase_actual_id`) + `.maybeSingle()`. Dos `POST /transition` concurrentes ya no pueden ganar ambos — el perdedor matchea 0 filas y aborta con `'El expediente fue modificado por otra operación'` en vez de corromper `fase_actual_id`/`fase_numero`/`expediente_fases`. El cierre del historial de la fase previa se movió a después del UPDATE ganador. Sin migración.
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
| `services/configService.ts` | Lectura/escritura de `configuracion_sistema` — solo admin client. **Dos paths de escritura:** `setConfigs(entries)` es upsert (internal/trusted — usado por `updateAudience`/`updateSchedule`); `updateExistingConfigs(entries)` (PR #159) sólo actualiza keys que ya existen en la tabla y retorna `{updated, ignored}` — es el canónico para `/api/admin/config PATCH` así que un admin (o sesión hijackeada) no puede inyectar keys arbitrarias. Keys nuevas requieren migración. |
| `services/dashboardService.ts` | Datos de expedientes para el dashboard (`DashExpediente`, `DashHito`, `DashDoc`). `createDashExpediente()` calcula `numero_expediente` con `Number.parseInt` max en JS sobre todas las filas del año actual (no via `ORDER BY numero_expediente DESC` — el sort lex trataba `EXP-YYYY-1000` como menor que `EXP-YYYY-999` y se rompía al expediente 1000; mezclar 3 dígitos legacy con 4 dígitos nuevos recreaba el bug en la frontera). Padding actual: 4 dígitos. **Cada insert hijo (hitos, documentos, legalidad_items, progress_fases, progress_subpasos) chequea `error` y `throw`** — antes el fallo silencioso devolvía un expediente "creado" con datos faltantes y sin auditoría |
| `services/concesionesService.ts` | Helpers del registro INHGEOMIN (migración 023). `searchConcesion()` envuelve el RPC `search_concesion_minera` con anon-key (RPC es `SECURITY DEFINER`, OK desde anon). `getConcesionStats()` agregados. `listConcesionesAdmin()` paginado con service-role + ilike fallback **sanitizada** (PR #159 — escapa `% _ \\` y strippea `, ( )` para cerrar la ilike-injection del `.or()` string); ahora **lanza** en error de DB en vez de retornar `{rows:[],total:0}` así la route puede devolver 500 con código. Exporta sólo `CATEGORIA_SHORT` (el `CATEGORIA_LABELS` y `renderConcesionContextForMaria` se removieron por dead-code en PR #159 — `buildConcesionContext()` vive inline en `route.js`). Tipos: `CategoriaConcesion`, `ClasificacionConcesion` (sin `Suspenso` — ese es un valor de `estado_expediente`, no de clasificación), `ConcesionMinera`, `ConcesionSearchResult`, `ConcesionStats`. |

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
- `POST /api/whatsapp/send` — enviar mensaje WhatsApp (Meta Cloud API). Requiere `requireRole('admin' | 'abogado' | 'tecnico_ambiental')` (PR #159 — antes era cookie-only via proxy, sesiones expiradas podían disparar envíos).
- `GET+POST /api/webhook/whatsapp` — webhook Meta (verificación + mensajes entrantes)
- `GET+POST /api/whatsapp` — webhook Twilio; asistente virtual **María** (Claude `claude-haiku-4-5-20251001`)
- `POST /api/maria/chat` — chat web de María desde la landing (anon, sin auth). Body `{ messages }`, respuesta `{ reply }`. Rate-limited 20/5min por IP. Comparte system prompt + RAG + concesiones con el webhook WhatsApp vía `lib/maria/systemPrompt.ts`. Ver §María Web Widget.
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
- `GET+POST /api/broadcast/run` — disparar broadcast diario (protegido por `CRON_SECRET` header, sin auth cookie). Vercel Cron envía `GET` una vez al día (`0 14 * * *` = 8 AM Honduras en el plan Hobby) y la ruta **auto-gatea** sobre `broadcast_time` (gate Pro-ready, ver §Sistema de Broadcast Diario); `POST` es invocación manual que **siempre envía** (bypasea el gate) con body JSON (`roles`, `triggered_by`)
- `GET /api/broadcast/config` — configuración de métricas del reporte diario
- `PATCH /api/broadcast/config` — cambiar métrica: `{ metric, action, currency?, patch?, updated_by? }`
- `GET /api/broadcast/prices?days=7` — historial de precios; `?latest=true` para solo el más reciente
- `GET /api/debug/prices` — diagnóstico de fuentes de precios: testea metals.live, exchangerate-api y Yahoo Finance; muestra env vars set/unset. Admin-only (PR #159 — antes era público; el mapa de env vars presentes/ausentes servía de perfilamiento al attacker).

## Asistente Virtual María (`app/api/whatsapp/route.js`)
Webhook Twilio que conecta WhatsApp con Claude AI.
**Reglas operativas canónicas:** ver [`MARIA.md`](./MARIA.md) — el system prompt vive en `lib/maria/systemPrompt.ts` y se importa tanto desde `route.js` como desde el nuevo endpoint web `/api/maria/chat` (2026-05-24, PR #162). Ambos canales comparten la misma fuente para no driftear el comportamiento de María; cualquier cambio a §11 de MARIA.md se refleja editando ese único archivo.

- **Modelo**: `claude-haiku-4-5-20251001`
- **Runtime / diagnosticabilidad del webhook**: la ruta exporta `runtime='nodejs'`, `dynamic='force-dynamic'` y **`maxDuration=60`** — sin esto el default de Vercel mataba la invocación a mitad del pipeline (Supabase + embed OpenAI + 2 llamadas a Haiku) **antes** de llegar al outer catch, así que Twilio no recibía TwiML y el usuario veía **silencio total** (no el mensaje de error). El outer catch ahora **clasifica** el fallo en logs: `[maria] FATAL config error` (env `MARIA_CONFIG` — `getSupabase()` nombra la var faltante), `[maria] CLAUDE error` (`.status`/anthropic/overloaded), `[maria] DB error` (`PGRST*`/supabase), o `[maria] UNCLASSIFIED`. Cada request loggea un banner `[maria] handler start anthropic=… url=… svc=… openai=…` (solo presencia, nunca valores). Config errors devuelven el copy de mantenimiento; el resto el "problema técnico" — siempre **200 + TwiML**. Lookups opcionales usan `.maybeSingle()` (cliente, expediente subcmd, auto-register). **María-inbound es Twilio (TwiML en la respuesta HTTP, no necesita creds REST de Twilio); el broadcast es Meta Cloud API — fallan independiente.**
- **Persona**: María, asistente de MAPE LEGAL — español sencillo, respuestas cortas (≤5 líneas), sin emojis, sin jerga
- **Conocimiento**: 3 servicios completos con precios, 38 pasos de formalización en 4 fases, titulación, sociedad minera, obligaciones del cliente, fechas críticas
- **Tierra Primero — protocolo cultural** (MARIA.md §10, v1.3+): el system prompt ordena explícitamente que María pregunte la situación de tierra **antes** que cualquier mención de INHGEOMIN o SERNA, y reordena el catálogo de servicios con titulación como **Servicio 0** (primero) y formalización como **Servicio 1 gated** (solo se ofrece cuando el minero ya tiene título registrado o arrendamiento registrado). La sección `TIERRA PRIMERO — COMPROMISO CULTURAL` del prompt lista 6 compromisos + frases prohibidas vs. correctas. En `CUANDO QUIEREN INICIAR UN TRÁMITE`, "situación de tierra" es **paso 0** (antes del nombre) — si sin papeles, María ofrece titulación, no formalización.
- **Precios vigentes**:
  - Titulación de propiedad (Servicio 0 — primero si el minero no tiene tierra): L 60,000 base (hasta 2 manzanas) + L 25,000 por manzana extra
  - Formalización minera (Servicio 1 — gated, requiere tierra resuelta): L 1,600,000 (3 hitos: 40/40/20%)
  - Contrato de sociedad minera (Servicio 3): L 55,000 (co-pagado 50/50)
- **Historial**: últimos 40 mensajes de `conversaciones_whatsapp` por número de WhatsApp (suficiente para sostener conversaciones multi-día sin truncar contexto importante)
- **Lookup de cliente**: busca en tabla `clientes` por `telefono_whatsapp` (strip de `whatsapp:` prefix) — si existe, inyecta nombre/municipio/tierra en el prompt; si no, instruye registro natural
- **Contexto de expediente**: tras el lookup de cliente, consulta `expedientes` por `cliente_id = cliente.id` (fallback: `cliente ILIKE nombre`). Inyecta en el prompt: `numero_expediente`, fase actual, paso actual, estado, cierre estimado, hitos pendientes. Si no hay expediente: instruye a María a explicar Fase 0 e Hito 1. Helper: `buildExpedienteContext(exps)` en `route.js`.
- **Prompt dinámico**: base + `priceContext` + contexto de cliente (con `completenessSummary`) + contexto de expediente + (si conversación en curso) bloque `CONTEXTO CRÍTICO` que prohíbe re-saludos
- **Dedup**: filtra mensajes assistant consecutivos antes de enviar a Claude
- **Base de conocimiento legal**: Reglamento Minería Honduras (Acuerdo 042-2013) embebido en el system prompt — números clave, scripts de respuesta rápida, áreas excluidas, sanciones
- **Precios en tiempo real**: consulta `precios_diarios` del día; si no hay fila, llama `fetchAllPrices()` de `services/pricingService.ts` (goldapi.io spot con fallback a Yahoo Finance COMEX GC=F/SI=F + exchangerate-api.com). *(Nota: `services/metalsPriceService.ts` / `fetchLiveMetalPrices()` fue consolidado en `pricingService.ts` — ya no existe como archivo separado.)* El bloque `PRECIOS DE REFERENCIA` se inyecta en el system prompt con el precio internacional de referencia del oro (etiquetado "Oro internacional", **no "LBMA"** — la fuente real es goldapi.io spot / Yahoo COMEX GC=F, no el fixing LBMA), precio de compra MAPE LEGAL (80% del precio internacional en lempiras) y tipo de cambio BCH.
- **Comportamiento de precios en fines de semana**: tanto goldapi.io como Yahoo Finance devuelven el **último cierre del viernes** durante sábado y domingo (hasta el reapertura del mercado spot, domingo 6 PM ET / 4 PM Honduras). El precio que ve María "se repite" en esos días porque los mercados están cerrados — no es bug, es comportamiento real del mercado. Si el cliente pregunta "¿por qué no cambia?", la respuesta correcta es "los mercados internacionales están cerrados los fines de semana — el precio se actualiza el lunes a la apertura". `goldapi.io` ES accesible 24/7, pero el valor que retorna es el último quote.
- **`GOLDAPI_KEY` no seteada en producción (2026-05-10)**: `services/pricingService.ts:fetchGoldFromGoldAPI()` retorna `null` silenciosamente cuando la env var falta, así que `fetchAllPrices()` siempre cae a Yahoo Finance (`fuente=yahoo-finance` en logs). Setear la key en Vercel → Project → Settings → Environment Variables daría una fuente primaria más autoritativa en días hábiles. No urgente: Yahoo COMEX GC=F es válido como proxy.
- **`precios_diarios` cache write blocked por RLS (2026-05-10, RESUELTO 2026-05-14 vía migración 025)**: cada invocación de María disparaba `fetchAndStorePrices()` fire-and-forget, pero el INSERT/UPSERT fallaba con `new row violates row-level security policy for table "precios_diarios"` porque el `service_role` del proyecto no tiene `BYPASSRLS` (mismo root cause de la saga de auth resuelta en migración 019) y la policy `"service_all_precios_diarios"` de migración 009 había driftado out-of-band. **Fix shipped + aplicado en producción 2026-05-14**: migración 025 re-declara la policy idempotentemente Y expone el RPC `public.upsert_precios_diarios(...)` `SECURITY DEFINER` owner `postgres`; `fetchAndStorePrices()` lo llama primero y cae al upsert directo solo como red de seguridad. Smoke test verificó persistencia + cleanup. Cache de precios operativo end-to-end.
- **Formato canónico de respuesta de precio de oro** (MARIA.md §8, v1.1+): cada respuesta que mencione precio de oro DEBE incluir SIEMPRE 4 viñetas — `Oro internacional` (etiqueta relabeled desde "LBMA" — ver §8 de MARIA.md), `MAPE LEGAL compra al 80%`, `Tipo de cambio USD/LPS`, `Actualizado: [frescuraLabel]` — más `Finacoop` y `www.mape.legal`. El timestamp y el tipo de cambio USD/LPS son obligatorios aunque el cliente no los pida. La regla está implementada en el system prompt (`CUANDO PREGUNTAN POR EL PRECIO DEL ORO` + `SI EL CLIENTE MENCIONA UN PESO ESPECIFICO EN GRAMOS`) y reflejada en MARIA.md §8.
- **Registro INHGEOMIN (concesiones)**: helper `buildConcesionContext()` se dispara con la regex `CONCESION_TRIGGERS` (palabras "concesión", "INHGEOMIN", "permiso minero/exploración/explotación", "en solicitud", "¿quién tiene la concesión?", "empresa minera", "¿dónde está ubicado?"). Limpia stopwords con boundary `\b` para preservar nombres como "Dorado", llama el RPC `search_concesion_minera` (anon-key, RPC es SECURITY DEFINER) con `p_limit: 5`, y inyecta un bloque `REGISTRO INHGEOMIN — concesiones encontradas (datos públicos):` con instrucción explícita de **no afirmar aprobación si la categoría es `solicitud_pendiente`**. 587 registros disponibles (125 explotación otorgada + 170 exploración otorgada + 292 en solicitud). Falla silenciosa: si el RPC retorna error, loggea `[concesiones] non-fatal` y devuelve string vacío — nunca bloquea la respuesta de María.
- **RAG semántico (`maria_knowledge`)**: `retrieveKnowledge()` en `app/api/whatsapp/route.js` es **híbrida**. Antes de tocar OpenAI hace un **pre-check** (`select id, count exact head, not embedding is null`) — si el resultado es 0, salta directo a FTS sin gastar una llamada al modelo. Luego, si hay embeddings, llama `embedQuery()` de `lib/maria/embeddings.ts` (OpenAI `text-embedding-3-small`, 1536 dims, 5 s timeout, 2 retries) → serializa el vector con `toVectorText(queryEmbedding)` → RPC `match_maria_knowledge(query_embedding, match_threshold=0.5, match_count=3)` (el umbral vive en `RAG_MATCH_THRESHOLD` de `lib/maria/ragShared.ts`; bajado de 0.7 → 0.5 en PR #176 porque 0.7 descartaba chunks legales relevantes — la migración 024 ya recomendaba el cambio). Fallback final: RPC FTS determinístico (`search_maria_knowledge_fts`). Ambos RPCs son `SECURITY DEFINER` con owner = `postgres` (patrón de migración 019 — bypasean RLS sin depender de BYPASSRLS). El bloque inyectado al system prompt se llama `CONTEXTO DEL SISTEMA`. Cada turno deja en logs `[rag] pre-check embedded=N` y `[rag] path=semantic|fts|none candidates=N` para que el operador distinga "matched nothing" de "silent 500" sin abrir la consola de DB. Backfill: `node scripts/embed-maria-knowledge.mjs` (idempotente) o `POST /api/admin/maria/embeddings-backfill` desde Vercel.
  - **Helpers canónicos** en `lib/maria/embeddings.ts`: `toVectorText(vec)` (única serialización aceptada por pgvector — raw arrays se silencian) y `buildCanonicalText(title, content, category)` (formato `[category] title\n\ncontent`, cap 8000 chars). Los callers (`retrieveKnowledge`, `embeddings-backfill/route.ts`, `embed-maria-knowledge.mjs`) usan estos helpers; el script .mjs los inlinea porque ESM no puede importar TS sin build step — drift risk acotado a 3 líneas. **Categoría prefix asymmetric on purpose**: backfill embebe `[category] title…`, runtime embebe el mensaje crudo. `text-embedding-3-small` es robusto al desbalance; documentado como deuda menor.
  - **Diagnóstico — `/api/admin/maria/rag-health`** (admin-only, modelo `auth-config`): retorna JSON con `env` (3 vars), `rows.total/with_embedding/sample_dim`, `rpc.match_maria_knowledge.state` + `rpc.search_maria_knowledge_fts.state`, `openai.state/dims/error`, y un `hint` accionable. Es el primer chequeo cuando "no funciona el RAG" — distingue env rota de RPC faltante de embeddings 0 de dim mismatch en la columna.
  - **Errores categorizados de OpenAI**: `embedQuery` y `embedBatch` loggean `[embeddings] <scope> INVALID API KEY` (401), `RATE LIMITED` (429), `TIMEOUT` (network/abort), o `failed` (default) — antes era un mensaje genérico. Vercel function logs se vuelven útiles sin SSH.
  - **Migración 024**: crea (o adiciona idempotentemente columnas a) `maria_knowledge`, instala extensión `vector`, agrega índice `ivfflat` sobre `embedding` con `vector_cosine_ops` + índice `gin` para FTS, y crea ambos RPCs. Hasta que se aplique en Supabase Studio, el flow sigue funcionando vía el RPC FTS existente — el embedding path simplemente no retorna nada y cae al fallback. **Future work documentado pero no shipped**: HNSW en vez de IVFFLAT (mejor recall, requiere SQL manual del operador), columnas `content_hash` + `embedded_at` para freshness tracking + flag `--stale-only` en el backfill, alinear el prefijo `[category]` entre backfill y runtime (requiere re-embed completo).
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

## María Web Widget (`app/api/maria/chat/route.ts`, `components/landing/MariaWidget.tsx`, 2026-05-24)

Chat público de María embebido en la landing (`mape.legal`). FAB pill bottom-right que abre un panel `380 × 560` (o full-width minus padding en `<640px`). **Ephemeral** — historial vive en `sessionStorage` del browser, no se persiste en BD (sin visibilidad admin en v1; un canal `conversaciones_web` requeriría migración + RLS + tab nuevo en `/admin/maria/conversaciones`).

- **Endpoint**: `POST /api/maria/chat` — público (sin auth), JSON `{ messages: [{role:'user'|'assistant', content:string}] }` → `{ reply:string }` o `{ error, code }`. Rate-limited a **20 turnos por IP cada 5 min** vía `lib/rateLimit.ts`. `runtime = 'nodejs'`, `force-dynamic`, `Cache-Control: no-store`.
- **System prompt compartido**: importa `CHT_SYSTEM_PROMPT` de `lib/maria/systemPrompt.ts` (mismo módulo que usa el webhook WhatsApp — antes del PR #162 el const vivía inline en `route.js:39-630`). Después aplica un bloque **`CONTEXTO DEL CANAL — WEB`** que **override explícito** de las dos líneas WhatsApp-centric del prompt base (`systemPrompt.ts:24` "Respuestas cortas para WhatsApp" y `:58` "María es una asistente virtual por WhatsApp") — sin este override Haiku ocasionalmente respondía al visitante "soy asistente por WhatsApp, escribime al +504…" derrotando el propósito del widget en la única pregunta que justifica su existencia ("¿qué canal es este?"). El bloque también instruye a no pedir DPI/teléfono y a derivar solicitudes formales al WhatsApp/correo.
- **Contextos dinámicos inyectados** (los tres en paralelo vía `Promise.all`):
  - `priceContext` — lee `precios_diarios` con **service-role client** vía `services/adminSupabase.ts:getAdminClient()` (lazy singleton local del route). La tabla tiene RLS que niega anon (comentario explícito en migración 009 línea 73: "anon has no access"), así que el proxy `services/supabase.ts` retornaría siempre 0 rows y todas las invocaciones harían bypass del cache → hits externos cada turno. Si no hay row del día, `Promise.race` contra `fetchAllPrices()` con timeout duro **`PRICE_FETCH_TIMEOUT_MS = 8000`** (los upstreams GoldAPI/Yahoo/exchangerate-api no exponen AbortSignal; sin el race, un upstream colgado pinea la función hasta el timeout de Vercel ~60s, eating function budget y dejando al cliente esperando aunque su AbortController ya disparó). Check `oro != null && oro > 0` — un 0 espurio del feed no se trata como cache hit válido.
  - `concesionContext` — réplica del trigger `CONCESION_TRIGGERS` de route.js. Llama el RPC `search_concesion_minera` con anon-key (el RPC es `SECURITY DEFINER`). Mismo guardrail "no afirmar aprobación si categoría es `solicitud_pendiente`".
  - `ragBlock` — réplica del `retrieveKnowledge` de route.js (pre-check de embeddings → semantic vía `embedQuery` + `toVectorText` → FTS fallback). **Incluye el wrapper anti-deflection** completo (`CONTEXTO DEL SISTEMA (citas literales...)` + `INSTRUCCIONES PARA USAR ESTE BLOQUE` con la directiva `NO derives a gerencia@mape.legal cuando este bloque responde la pregunta`) — sin el wrapper se re-introducía la regresión "Artículo 28-A" documentada en §Auditoría 2026-05-15. Logs siguen la convención canónica `[rag][web] pre-check embedded=N`, `[rag][web] path=semantic|fts|none candidates=N` para que `grep '[rag]'` en Vercel logs capture ambos canales.
- **Lo que NO se inyecta** vs WhatsApp (intencional): `clienteContext`, `expedienteContext`, `manualContext`, onboarding state machine, admin command interpreter, contact forwarding a Willis. Todo eso depende de un número de teléfono que no existe en el canal web. Trade-off documentado: preguntas sobre pasos específicos del Manual Operativo ("¿qué dice el paso 7?") usan la información general del prompt en vez del row exacto de `documentos_referencia`.
- **Defensas server-side**: rate limit IP, cap `MAX_MESSAGES=30` por request, cap `MAX_CONTENT_CHARS=2000` por mensaje, **cap adicional `MAX_MERGED_CONTENT_CHARS=6000` después del dedup** (sin este cap, 30 × 2000 chars de misma role se mergeaban en un único mensaje de 60 KB que bypass-eaba la validación per-message y amplificaba el costo del token bill). Anthropic Haiku `max_tokens: 800`.
- **Widget** (`components/landing/MariaWidget.tsx`):
  - FAB pill bottom-right, `var(--ink)` bg, `rounded-lg` (per DESIGN.md §4 — no `rounded-full` en action buttons), label `Pregúntale a María` / `Ask María` por idioma.
  - Panel `380 × 560`, `shadow: 0 10px 30px rgba(31,42,56,0.12)` — más fuerte que el shadow-sm de cards porque flota, pero no `shadow-2xl`.
  - Welcome message **hard-coded** (lista de capacidades — bullets de cotizar / precios / pasos / concesiones / contacto). **Display-only, filtrado del payload API** para que María no se enseñe a saludarse a sí misma. El filtro usa equality de contenido — si se edita `WELCOME_MESSAGE.content`, sesiones viejas en sessionStorage caen al shim defensivo del server (`while (validated[0].role !== 'user') validated.shift()`), no rompe pero pierde el guarantee.
  - Persistencia: `sessionStorage['maria-web-history']`, cap **`MAX_STORED_MESSAGES=28`** (alineado bajo el cap server-side 30 para dejar espacio al userMsg nuevo). Pre-fix el cap del widget era 40 — sessions de más de 15 turnos rompían silenciosamente con error "Recargá para empezar de nuevo" que era engañoso (sessionStorage sobrevive reload).
  - **Rollback de mensaje fallido**: si la respuesta es 4xx/5xx/timeout, el userMsg optimista se quita del estado y el input se restaura — sin esto, el next send concatenaba el turn fallido al nuevo via el merge server-side del dedup, y María recibía un Frankenstein de dos preguntas no relacionadas.
  - **AbortController cleanup on unmount**: ref `activeCtrlRef` se aborta en cleanup del `useEffect` mount, evita setState-after-unmount warnings cuando el visitante navega fuera de `/` mid-request. `mountedRef` también previene los setStates del finally.
  - **Escape close → focus al FAB** vía `requestAnimationFrame` (el FAB es condicional sobre `!open`, su ref es null al instante en que Escape dispara; rAF defiere hasta que React commitee el FAB de vuelta al DOM). Sin el rAF, keyboard users perdían su anchor de foco al cerrar con Escape.
  - **Strict role narrowing en `loadStored`**: acepta solo `role === 'user' || role === 'assistant'`. Sin el narrowing, una sessionStorage envenenada con `role: 'system'` (cross-tab attack, extensión, schema viejo) hidrataba, persistía, y bloqueaba toda interacción posterior con 400 BAD_BODY en el server sin remedio in-app.
- **María responde en español únicamente** (MARIA.md es ES-only). La UI chrome del widget (placeholder, botón enviar, mensajes de error) sí respeta el toggle ES/EN de la landing.
- **Costos**: cada turno hace 1 llamada OpenAI embeddings (~$0.00002) + 1 a Claude Haiku (~$0.001-0.005 según context) + posibles HEAD/RPC a Supabase. Cap 20/5min por IP bound el costo de un solo visitante; ataques con IP rotation requieren controles upstream (Cloudflare, etc.).
- **Sin servidor de presence ni websockets** — single round-trip request/response por turno. Streaming response (Anthropic supporta) no se usa en v1; añadir solo si reportan latencia.

## Landing page

**Estado real (Phase 1, 2026-05-10; overhaul móvil 2026-05-11; humanizer copy pass 2026-05-20; chat widget María 2026-05-24, PR #162):** la landing activa es `app/page.tsx` (~700 líneas, autocontenido, repositionada como **superficie institucional**, no de ventas). Estructura: Nav · Hero · Identidad (`#identidad`) · Cumplimiento (`#cumplimiento`) · Verificación (`#verificacion`) · Archivos Mineros (`#archivos-mineros`) · Contacto (`#contacto`) · Footer + `<MariaWidget>` flotante. **No hay formulario de contacto, ni CTAs hacia clientes** — los clientes entran por María (WhatsApp **o el chat web** desde 2026-05-24) y relaciones directas. Los datos institucionales son reales: WhatsApp `+504 9737 3139`, correo `gerencia@mape.legal`, oficina Nexcrea (Tegucigalpa). Bilingüe ES/EN vía helper `t(es, en)` y `localStorage('ml_lang')`.

Los 15 archivos de `components/landing/*` fueron **eliminados en Phase 1** (ver commit `chore(landing): remove orphan components/landing/*`). Cualquier cambio de UI ahora va a `app/page.tsx`.

### Voz canónica de la landing (2026-05-20, PR #157)

**Registro:** institucional pero humano. Voz tercera persona, formal usted-implícito, sin marketing-speak. Audiencia primaria: compradores/refinadores haciendo due diligence, reguladores, prensa, partners de la cadena formal — **no** los mineros artesanales (esos entran por María). ES es primario, EN secundario para audiencia internacional.

**Reglas activas (aplicables a cualquier copy nuevo en `app/page.tsx`):**
- **Voz activa con sujeto concreto.** Evitar "la operación canaliza…", "está enmarcada en…", "queda registrada en…". Preferir "MAPE LEGAL formaliza…", "cada certificado sigue…", "los pagos pasan por Finacoop…".
- **Frases ≤22 palabras (ES) / ≤25 (EN).** Si el dato exige más, cortar con dos puntos o punto.
- **Títulos de sección = pregunta editorial o verbo, nunca sustantivo solo.** "Quiénes somos." / "Bajo qué reglas opera MAPE LEGAL." / "Verifique un certificado." / "Cómo escribirnos." NO "Marco regulatorio y estándares.", NO "Canales formales de contacto institucional.".
- **Anclas regulatorias siempre con consecuencia plana.** INHGEOMIN / SLAS-2 / OCDE / Convenio 169 / Acuerdo 042-2013 / SERNA / MiAmbiente+ / Finacoop son credibilidad — preservarlas — pero cada mención debe terminar en lo que significa en la práctica (e.g. "el comprador sabe de qué bocamina viene cada gramo", "el acta de consulta queda dentro del expediente").
- **Vocabulario MAPE LEGAL (no service-provider).** Usar `formaliza`, `certifica`, `ampara`, `acompaña`, `emite`, `responde a`. **Evitar** `ofrecemos`, `brindamos`, `nos comprometemos`, `plataforma`, `solución integral`, `infraestructura de evidencia`.
- **No traducción literal.** ES y EN deben leerse nativos en su idioma respectivo, no como back-translation. "Bocamina" en ES vs. "mine" en EN es asimetría correcta.
- **Anti-patterns prohibidos** (todos verificados en review): hero CTA button, "Conoce más / Learn more" link, stats sin auditar en el hero ("N unidades formalizadas"), pull-quotes / testimonios, partner logo strips, emojis, per-section timestamps, "trabajamos para…", primera persona del minero/comprador.

**Pendiente (no shipped en PR #157):** alinear el `h1` y microcopy de `app/verificar/page.tsx` y `app/verificar/[numero]/page.tsx` con la nueva voz de la sección Verificación; aplicar las mismas reglas a las strings dentro de `components/terrain/TerrainMapSection.tsx` (legend / sheet / CTA) cuando se haga ese pass.

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
- **La vista expone**: `numero_certificado`, `fecha_emision`, `peso_oro_g`, `estado`, `valido_hasta`, `hash_verificacion`, `mina_nombre`, `mina_codigo`, `mina_municipio`, `mina_departamento`. **Nunca PII del productor, monto de transacción, ni precio internacional de referencia.**
- **Schema gotcha**: `public.minas` no tiene `permiso_inhgeomin` — la vista usa `m.codigo` (el campo INHGEOMIN-style, e.g. `MINA-2026-001`) y lo expone como `mina_codigo`.
- **Migración numerada 020**, no 010 (010 ya estaba tomada por `010_admin_commands_onboarding.sql`).
- **Demo seed**: `CO-2026-0001-DEMO` insertado por la migración con un `DO $$ ... $$` block que skipea silenciosamente si `minas` o `expedientes` están vacíos en el ambiente.

## Biblioteca Archivos Mineros (`#archivos-mineros`, 2026-05-10)

Sección institucional bajo el ancla `#archivos-mineros` en la landing (`app/page.tsx`); enlace en el nav como "Mapa Minero" / "Mining Map". Mapa interactivo 3D de 8 distritos mineros verificados de Honduras renderizado con MapLibre GL JS v5 (~220 KB gzipped, WebGL, GPU-accelerated). **Framing canónico (2026-05-11):** el mapa NO es un catálogo de empresas mineras — es un mapa de **distritos** donde se concentran mineros artesanales y de pequeña escala. Cada pin representa una zona donde MAPE LEGAL tiene clientes potenciales (los mineros artesanales/SSM que operan en ese territorio), independientemente del estatus de la operación corporativa listada en cada card.

> **Update 2026-05-11 (PR #124, `claude/fix-map-legend-navigation-MYEUb`):** legend → filtro de mineral, agregada navegación Next/Prev, marker click race condition resuelto, CTA WhatsApp ahora se muestra en todos los sitios (la audiencia es el minero artesanal, no la corporación). Ver "Arquitectura interactiva" abajo.

> **Update 2026-05-14 (rama `claude/3d-topographic-map-lH1Wf`):** rediseño mobile-first — terreno 3D default (pitch 55°, hillshade + sky, exaggeration 1.8), markers migrados de DOM a `circle` layer con `pitch-alignment: map` (destraba el constraint `pitch: 0`), el `SiteInfoPanel` lateral fue reemplazado por `SiteInfoSheet` (bottom sheet con snaps `closed`/`peek`/`full` y drag por pointer events), agregado `CompassButton` flotante, `MapLegend` con dos modos (chip row scroll-snap horizontal en `<768px`, lista vertical en desktop). Todas las secciones de abajo describen este estado.

> **Update 2026-05-23 (rama `claude/tender-ritchie-uiPgA`):** **migración al look "carta topográfica cartográfica".** Se eliminaron los tiles raster CartoDB Voyager y la rama MapTiler Hybrid (con su variable `NEXT_PUBLIC_MAPTILER_KEY`). El basemap pasa a ser un `background` plano `var(--bg-soft)`; encima se proyectan curvas de nivel generadas client-side por `maplibre-contour@0.1.0` (BSD-3, ~50KB gzip, WebWorker), un border simplificado de Honduras (`public/data/honduras-border.json`, Natural Earth admin-0 1:50m, ~8KB), un hillshade muy atenuado (exaggeration 0.18) y un sky con horizonte neutro. El terreno 3D (pitch 55°, bearing -18°, `setTerrain` exageración 1.8×) y los 8 pins coloreados por mineral se conservan exactamente como antes — el cambio es puramente visual del basemap. La DEM source migra de `demotiles.maplibre.org/terrain-tiles` (zoom max ~11) a **AWS Terrarium** (`elevation-tiles-prod`, zoom 0–15, encoding `terrarium`) para alimentar tanto el terreno como la generación de contornos; atribución obligatoria "Tile data © Mapzen" en el `customAttribution` del `AttributionControl`. Detalles en la sección "Tiles + 3D terrain — 3D default" abajo.

**Archivos** (todos `'use client'`):
- `components/terrain/mining-data.ts` — dataset de 8 sitios + `MineType`/`MineStatus` aliases + `MINE_TYPE_ORDER` + `TYPE_COLORS` / `STATUS_COLORS` / `*_LABELS_*` + `COMMODITY_LABELS_ES` (todos `Record<MineType,...>` / `Record<MineStatus,...>` — tipados estrictos, typos fallan al compilar).
- `components/terrain/MiningMap3D.tsx` — core del mapa: terreno 3D + hillshade atenuado + sky neutro + contour layers (`maplibre-contour`) + border de Honduras + source GeoJSON con 2 capas `circle` (`mining-circles-touch` invisible 20px + `mining-circles` visible 8–12px). Selección via `setFeatureState({ selected: true })`. Visibilidad via `setFilter([...])`. flyTo a `pitch: 62, zoom 9.5` al seleccionar; vuelve a overview al deseleccionar. Expone `MiningMapApi` (handle imperativo con `getBearing`/`getPitch`/`easeTo`) consumido por `CompassButton`. El nombre del archivo conserva el sufijo `3D` (el terreno extruido sigue, solo el basemap pasó a un look cartográfico).
- `components/terrain/SiteInfoSheet.tsx` — **bottom sheet** con 3 snaps (`closed`/`peek`/`full`). Drag por pointer events (`setPointerCapture`), animación CSS `translateY` con curva `cubic-bezier(0.32, 0.72, 0, 1)` (sheet de iOS). En `<768px` aparece como sheet pegado al fondo; en `≥768px` se renderea como panel lateral fijo derecho (mismo componente, otro `Wrapper`). Respeta `env(safe-area-inset-bottom)`. Tap fuera del sheet (en el mapa) cuando hay sitio seleccionado → colapsa a `peek`. Drag de `peek` hacia abajo → deselecciona.
- `components/terrain/MapLegend.tsx` — **dos modos por `isMobile`**: chip row horizontal con `scroll-snap-type: x mandatory` en mobile (panel anclado top con flex-wrap), lista vertical en desktop (mismo top-left que pre-PR #124). Cada `MINE_TYPE_ORDER` row es `<button aria-pressed>`. Empty selection se bumpea a "all on".
- `components/terrain/CompassButton.tsx` — botón circular flotante (44×44, mobile bottom-right encima del sheet peek; desktop top-right). Lucide `Compass` ícono. Rota con `transform: rotate(${-bearing}deg)`. Tap → `map.easeTo({ bearing: -18, pitch: 55 })`. Fade a baja opacidad cuando `Math.abs(bearing - -18) < 0.5 && Math.abs(pitch - 55) < 0.5`.
- `components/terrain/TerrainMapSection.tsx` — wrapper de sección. Owner de `selectedSiteId`, `visibleTypes`, `bearing`, `pitch`. Memoiza `visibleSites = MINING_SITES.filter(s => visibleTypes.has(s.type))`. Expone `handleNext`/`handlePrev` con wrap-around. Hook local `useIsMobile()` con `matchMedia('(max-width: 767px)')`. Auto-deselect si filtro oculta el sitio activo.

**Tiles + 3D terrain — 3D default** (post-PR `claude/tender-ritchie-uiPgA`, mayo 2026):
- **Basemap**: un único layer `background` con `var(--bg-soft)`. Cero tiles raster, cero MapTiler, cero OSM labels — solo el "papel" crema. El `glyphs` URL apunta a `demotiles.maplibre.org/font/{fontstack}/{range}.pbf` (Noto Sans gratis, no auth) para renderizar los labels de elevación.
- **DEM source**: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (AWS Open Data / Tilezen / Mapzen Joerd, free, no auth, CORS abierto, zoom 0–15). Encoding `terrarium`. La misma source alimenta `setTerrain({ exaggeration: 1.8 })`, el `hillshade` y la generación de contornos vía `maplibre-contour`. **Atribución obligatoria** "Tile data © Mapzen" inyectada como `customAttribution` del `AttributionControl` (CC-BY).
- **Curvas de nivel**: vector tiles generados client-side por `maplibre-contour@0.1.0` (BSD-3, ~50KB gzip). El `DemSource` se instancia en module scope con guard SSR (`typeof window !== 'undefined'`) y registra los protocolos `dem://` y `contour://` vía `setupMaplibre(maplibregl)`. **`DemSource.maxzoom: 14`** — alineado con `Map.maxZoom: 14` para evitar staircase visible en los contornos cuando el usuario hace pinch zoom (post-flyTo al sitio); si quedara en `maxzoom: 13` el plugin sobre-zoomea y las líneas dejan de calzar con el hillshade z14 nativo. Thresholds por zoom (intervalos minor/major en metros): `{5:[500,2000], 6:[500,2000], 7:[500,2000], 8:[250,1000], 9:[100,500], 10:[100,500], 11:[100,500], 12:[50,250], 13:[25,100]}`. **Sin entries para z<5 las curvas no se generan al primer paint** (z=6.8) — el plugin retorna vector tile vacío (`getOptionsForZoom` en `index.mjs:407-418` + `fetchContourTile:2027-2028`) cuando ningún threshold key es ≤ zoom requestado. Tres layers:
  - `isolines-minor` (level=0): `line-color: --ink`, `opacity: 0.18`, `width: 0.4`
  - `isolines-major` (level=1): `line-color: --ink`, `opacity: 0.55`, `width: 0.8`
  - `isolines-major-text` (symbol, `minzoom: 11`): label `[ele] m`, `text-font: ['Noto Sans Regular']`, `size: 9`, color `--slate`, halo `--bg-soft` width 1.2
- **Hillshade atenuado**: `hillshade-exaggeration: 0.18` (vs `0.45` anterior), shadow `--ink`, highlight `--bg`, accent `--border-2`. Las curvas comunican el relieve; el hillshade es solo un wash de dirección de luz.
- **Sky neutro**: `setSky` con `sky-color: --bg`, `horizon-color: --concrete`, `fog-color: --slate-lt` — sin el dusk cálido del look satelital anterior.
- **Border de Honduras**: `public/data/honduras-border.json` (FeatureCollection MultiPolygon, Natural Earth admin-0 1:50m filtrado por `ADM0_A3='HND'`, ~8KB con properties strippeadas a `{name, iso_a3}`). Layer `hn-border-line`: `line-color: --ink`, `opacity: 0.55`, `width: 1.0`. **Orden importante**: el source se agrega ANTES del bloque de contornos (para que el fetch async arranque temprano), pero el layer se agrega DESPUÉS de las isolíneas — caso contrario la línea major a 0m (sea level, level=1 porque `0 % 500 == 0 % 2000 == 0` en el threshold `[500,2000]`) traza la costa con misma `--ink @ 0.55` que el border y lo cubre en el litoral. Con el border pintado encima, el outline del país se mantiene continuo.
- **Cámara inicial**: `pitch: 55`, `bearing: -18`, `zoom: 6.8`, center `[-86.8, 14.7]` (centro de Honduras). En `flyTo` a un sitio: `pitch: 62`, `zoom: 9.5`, `essential: true` (respeta `prefers-reduced-motion`), `duration: 1500ms`.
- **Degradación grácil**: cada `addSource`/`addLayer` está envuelto en `try/catch` que loggea `[mining-map] <scope> failed` (mismo patrón que `[rag]`, `[onboarding]`, etc.). Si AWS Terrarium falla, el border + pins siguen renderizando. Si `mlcontour` no puede inicializarse en el cliente (sin WebWorker, etc.), `demSource` queda `null` y los contornos se saltan — el resto del mapa sigue funcional. **Listener `instance.on('error', ...)`** captura errores async (border 404, glyphs CDN failure, DEM tile 5xx) que el try/catch sync no ve — addSource con `data: '/url'` arranca un fetch separado cuyo error se emite por el event bus de MapLibre, no como excepción sincrónica.

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

Los markers se colorean **solo por tipo mineral**. Los colores de status (`STATUS_COLORS`) aparecen únicamente en los badges del panel y popups — nunca en los pines del mapa. Por eso el filtro vive sobre `MineType`, no sobre `MineStatus`. Las CSS variables `var(--token)` funcionan dentro de inline `style` (el browser las resuelve) y dentro de `color-mix(in oklch, ${token} 14%, white)` para fondos translúcidos de pills/badges.

**Sin animaciones continuas** (DESIGN.md §4). El script PDF original incluía un `@keyframes mining-pulse` para markers con `status: 'active'`; se eliminó por la regla del manual. El color verde de `STATUS_COLORS.active` ya transmite "activa" sin animación. Las transiciones puntuales (apertura del sheet, `flyTo`, hover de la legend chip) sí están permitidas — la regla aplica solo a animaciones que corren indefinidamente.

### Arquitectura interactiva (2026-05-14)

**Markers ahora son una capa MapLibre `circle`, no DOM nodes.** Esto destraba 3 problemas a la vez:

1. **`pitch > 0` no rompe el alineamiento.** El paint expression incluye `'circle-pitch-alignment': 'map'` — los círculos rotan con el terreno. Sin esto, el constraint `pitch: 0` de PR #124 seguía vigente y bloqueaba el viewing 3D.
2. **No race conditions.** El patrón pre-PR #124 (`markersRef.clear() + recreate`) y aún el patrón mutación-en-lugar de PR #124 (3 funciones `applySelectionStyle/Visibility/Popup`) dejaron de ser necesarios. La selección es state declarativo (`setFeatureState({ selected: true })`) y la visibilidad es un `setFilter`.
3. **Escalabilidad.** Estamos en 8 sitios pero el plan de seedear desde `concesiones_mineras_registro` (587 filas) ya cabe sin re-arquitectura.

**Tokens de color via `getComputedStyle`** (`MiningMap3D.tsx:83`): MapLibre paint expressions no leen CSS variables. El helper `readVar('--token')` resuelve `getComputedStyle(document.documentElement).getPropertyValue('--token').trim()` una sola vez al mount y arma un objeto `tokens` que se pasa a los paint specs. Si se cambia el theme runtime, hace falta re-resolver — fuera de scope hoy.

**Source + 2 capas** (en `instance.on('load')`):

- `mining-sites` (source) — `geojson` con `promoteId: 'id'` para que `setFeatureState` use `site.id` como string en vez del autoincrement.
- `mining-circles-touch` — `circle` invisible, `circle-radius: 20`, `circle-opacity: 0`. Solo existe para el tap target — pinpoints de 8–12px son chicos para los dedos.
- `mining-circles` — `circle` visible. Paint specs:
  - `circle-radius`: `case ['feature-state','selected'] 12, ['feature-state','hover'] 10, default 8` — más interpolación leve sobre zoom.
  - `circle-color`: `match ['get','type']` → `tokens.type[mineType]`. Fallback `tokens.type.historical`.
  - `circle-stroke-color`: `case ['feature-state','selected'] tokens.ink, default tokens.bg` (ring oscuro cuando seleccionado, ring blanco para contraste cuando no).
  - `circle-stroke-width`: `case ['feature-state','selected'] 3, default 1.5`.
  - `circle-pitch-alignment: 'map'`.

**Eventos** (declarativos, no race-prone):

- Click sobre `mining-circles-touch` → `setSelectedSiteId(feature.properties.id)`.
- Hover sobre `mining-circles-touch` → `setFeatureState({ hover: true })` + `cursor: 'pointer'`.
- Selección cambia (effect) → `setFeatureState({ selected: true })` en el nuevo + `removeFeatureState({ selected: false })` en el viejo + `flyTo` al sitio.
- `visibleTypes` cambia (effect) → `setFilter('mining-circles', ['in', ['get','type'], ['literal', [...visibleTypes]]])` + igual filtro al touch layer.
- Bearing/pitch del camera → `map.on('rotate'|'pitch', ...)` actualiza state via `onBearingChange` callback que `TerrainMapSection` consume para alimentar el `CompassButton`.

**Bottom sheet — `SiteInfoSheet`** (mobile-first):

- 3 snaps: `closed` (hidden translateY 100%), `peek` (~132px visible — header + status badge), `full` (~70vh con cuerpo scrollable + CTA).
- Drag por pointer events. `setPointerCapture` en `onPointerDown`, tracking delta-y en `onPointerMove`, snap-to-nearest en `onPointerUp`. Sin libraries.
- Transición CSS `transform: translateY(...)` con `cubic-bezier(0.32, 0.72, 0, 1)` (iOS sheet curve).
- Body se hide cuando snap=`peek` (clip vertical), evita scroll cuando no hay espacio.
- Cuando se selecciona un sitio: el sheet abre a `peek` automáticamente. Tap el handle expande a `full`. Drag handle hacia abajo desde `peek` cierra (deselecciona).
- En desktop (`≥768px`): mismo componente, otro `Wrapper`. Se renderea como panel pegado a la derecha del mapa, sin gestos drag — usa Next/Prev y Close.
- `padding-bottom: max(16px, env(safe-area-inset-bottom))` para iOS.

**Compass button — `CompassButton`**:

- `position: absolute` (mobile bottom-right, desktop top-right), 44×44, fondo `var(--bg)` con `1px solid var(--border)` + `shadow-sm`.
- Lucide `Compass` ícono 20px. Rota con `transform: rotate(${-bearing}deg)` (negative porque queremos que la "N" apunte al norte cuando bearing=0).
- Click → `mapApi.easeTo({ bearing: -18, pitch: 55, duration: 600 })`.
- `atRest = Math.abs(bearing - -18) < 0.5 && Math.abs(pitch - 55) < 0.5` → opacidad 0.5 cuando estamos en la pose default; 1.0 cuando el usuario rotó/inclinó. Sutil signal de "puedo regresarte al inicial".

**MapLegend — dos modos por `isMobile`**:

- Mobile (`<768px`): chip row horizontal con `overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none`. Renderea en la parte de arriba del mapa, full-width. Cada chip es 44px alto. Tap toggles. Visualmente similar a chips de Material Design 3 pero con tokens de la marca.
- Desktop (`≥768px`): lista vertical en top-left del map container (mismo patrón pre-PR #124). Card blanco con border, cada row es un `<button>` con el dot de color + label.
- En ambos modos: empty selection se bumpea a "all on" para que el mapa nunca quede vacío.

**Auto-deselect bajo filtro**: si el filtro oculta el sitio actualmente seleccionado, un useEffect en `TerrainMapSection` lo deselecciona (`setSelectedSiteId(null)`) — evita un sheet zombie con un sitio cuyo marker está hidden.

**Navigation Next/Prev** (`SiteInfoSheet` header en modo `full`): mismo wrap-around que PR #124. `TerrainMapSection` deriva `visibleSites` por `useMemo`, computa `selectedIndex`, expone `handleNext`/`handlePrev`. Position indicator `Sitio N de N` / `Site N of N` en `var(--font-mono)`. Si `visibleSites.length <= 1` los chevrons se omiten.

**CTA WhatsApp** (en el sheet `full` view, todos los sitios — preservado de PR #124): copy `"¿Operas en esta zona? Inicia trámite con MAPE LEGAL"` / `"Mining in this district? Begin a process with MAPE LEGAL"`. El mensaje pre-llenado de WhatsApp incluye el nombre del distrito y el departamento. Hover: `color-mix(in oklch, var(--moss) 88%, white)`.

**`STATUS_LABELS_ES.contested`** = `"En disputa"` (no `"Controvertida"`) — preservado de PR #124.

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

Stats bar derivado (`TerrainMapSection.tsx`): 4 numerales en `var(--font-display)` 28px — total mapeados / activas / **en disputa** / históricas. Lee `8 / 2 / 2 / 2`. **Los stats reflejan el universo completo, no la lista filtrada** — la cuenta filtrada vive en el pill `Mostrando N de N` sobre el mapa cuando el filtro está activo.

**Future work**:
- **Wire al Supabase `minas` table** vía vista pública `minas_publicas` (mismo patrón que `certificados_origen_publicos` — migración 020 + `app/verificar/[numero]/page.tsx`). Requiere extender `minas` con `descripcion_es`, `descripcion_en`, `desde`, `operador`, `produccion`, `commodities`; nueva vista que strippea `cliente_id`; nueva ruta `app/api/archivos-mineros/route.ts` con lazy-init anon + `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`.
- ~~**Filtros UI** por mineral y status~~ — shipped en PR #124 (mineral only).
- ~~**Symbol layer migration**~~ — shipped 2026-05-14 en la rama `claude/3d-topographic-map-lH1Wf`. El constraint `pitch: 0` ya no aplica.
- **Expandir dataset** a 50–100 sitios usando INHGEOMIN bulletin + BCH histórico + Acuerdo 042-2013 annexes. Cada row debe tener fuente citable y GPS verificado. La migración 023 (`concesiones_mineras_registro`) shipped el 2026-05-11 ya carga 587 concesiones INHGEOMIN — evaluar si la archive map debería leer de ahí en vez de mantener un dataset separado. Con el cambio a `circle` layer, agregar más rows ya no requiere re-arquitectura.
- **Etiquetas dinámicas** — agregar un `symbol` layer con `text-field: ['get','shortName']` que se active a `zoom >= 8` para que los nombres aparezcan al hacer zoom. Hoy se ven solo via el sheet/popup.
- **Fact-check pendiente**: las descripciones de `clavo-rico` y `guapinol` afirman años específicos para denegaciones de permisos INHGEOMIN (2024-2025) que vale la pena verificar contra boletines INHGEOMIN antes de un push de marketing al landing.
- **Performance en mid-range Android** — el terrain rendering puede pegar fuerte el GPU. Hasta hoy fue probado solo en DevTools mobile emulator. Si reportan jank, reducir `exaggeration` a 1.5, subir `minzoom` de los labels de elevación a 12, o reducir la densidad de contornos (thresholds más espaciados: `12:[100,500]` en vez de `12:[50,250]`). El worker de `maplibre-contour` corre fuera del UI thread; el cuello suele ser el GPU del terrain extruido, no la generación de isolíneas.

### Deuda conocida del componente (audit 2026-05-23)

Hallazgos del code-review multi-angle del PR de migración a carta topográfica. No son bloqueantes; documentados aquí para evitar redescubrirlos.

- **Stale-closure race entre `on('load')` y `applyFilter`/`applySelection`** (`MiningMap3D.tsx:638-639`, pre-existente al PR pero amplificado): el handler de `load` captura las versiones de `useCallback` de la **primera** render. Si el usuario togglea la legend o tapea un pin durante la ventana de carga del worker contour + DEM Terrarium (~500ms–1s), el `useEffect[applyFilter]` re-corre con `styleReadyRef=false` → no-op, y luego `load` corre la captura vieja con `visibleTypes` de render 1 — sobreescribiendo el cambio. El pin queda con styling normal aunque la cámara haya volado a él, o un mineral filtrado sigue visible hasta que se togglea dos veces. Fix correcto: mover `applyFilter`/`applySelection` a refs actualizados en cada render (`const applyFilterRef = useRef(...); applyFilterRef.current = useCallback(...)`) y llamar `applyFilterRef.current()` desde el load handler. No urgente; tirar issue de follow-up.
- **Hillshade exaggeration 0.18 + highlight `--bg` blanco sobre `--bg-soft` cream = casi invisible**: por diseño (las curvas comunican el relieve), pero si los contornos fallan en producción (worker init crashea, Safari antiguo sin `OffscreenCanvas`, CSP que bloquea Blob workers) el mapa queda 'forma de Honduras + dots' sin señal de relieve. Mitigación parcial: el listener `on('error')` ahora loggea, pero el usuario no ve nada. Si reportes de degradación visual aparecen, subir hillshade a 0.30 como compensación.
- **`glyphs` dependiente de `demotiles.maplibre.org`**: si el demo CDN cae o ratelimita, los labels de elevación desaparecen (las líneas siguen pintándose porque `line` layers no usan glyphs). Aceptado en el plan original; migración a glyphs propios (pbf desde `public/fonts/`) o a MapTiler glyphs es future work.
- **HMR addProtocol leak en dev**: ediciones repetidas a `MiningMap3D.tsx` con Turbopack acumulan registros `dem://`, `dem1://`, `dem2://` en el global `maplibregl`. Memory leak progresivo de workers zombies por save. Solo dev impact; recupera con cmd+shift+R. Si afecta workflow, mover el `setupMaplibre` a dentro del `useEffect` con cleanup `removeProtocol` en el unmount.
- **Sky neutro revela seams en wide desktop**: el fog claro nuevo (`--slate-lt @ 0.9 ground-blend`) no enmascara DEM tile boundaries en el initial paint como lo hacía el `--ink @ 0.85` viejo. Si reportan seams al cargar, subir `fog-ground-blend` a 0.6 o cambiar `fog-color` a `--concrete`.

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

- **Breakpoints canónicos**: alineados con Tailwind — `sm: 640`, `md: 768`, `lg: 1024`. Las `@media (max-width: …)` en `app/globals.css` usan `1023` (= `<lg`) y `639` (= `<sm`). Los antiguos cortes 900/600 fueron migrados en PR #126 (2026-05-11) para sacar el tablet-portrait 768–900 de la zona muerta y meterlo en el stack mobile.
- **Tipografía escalada**: H1 del Hero usa `text-3xl sm:text-4xl md:text-5xl lg:text-[4.5rem]` — nunca tamaño fijo grande
- **`<br />` condicionales**: saltos de línea decorativos usan `<br className="hidden sm:block" />` para no romper el flujo en pantallas pequeñas
- **Nav en móvil — hamburger** (PR #126): bajo `<1024px`, los 4 anchor links se ocultan vía `.nav-links { display: none }` y aparece `.nav-toggle` (botón con SVG `<path d="M4 7h16M4 12h16M4 17h16"/>`). Al togglearlo se renderiza `.nav-mobile-panel` (slide-down sticky bajo el nav). State machine en `app/page.tsx`: `useState(navOpen)` + 5 `useEffect`s (Escape cierra + restaura foco al toggle, click-outside cierra, resize ≥1024 auto-cierra, `body.style.overflow='hidden'` cuando abierto, focus al primer link en open). El **lang toggle se mueve fuera de `.nav-links`** así queda visible en mobile junto al hamburger.
- **`.mape-section` class** (`app/globals.css`): aplica padding responsivo a todas las `<section>` de la landing — `80px` desktop → `56px` `<lg` → `48px` `<sm`. Cada `<section>` lleva `className="mape-section"` y conserva `background / borderBottom / id` inline; el `padding` inline se elimina. Cualquier `<section>` nueva en la landing debe usar esta clase.
- **Grids de sección** (PR #126): reemplazo de `gridTemplateColumns` inline por clases Tailwind responsive. Patrones canónicos:
  - 2-col texto + imagen (Identidad/Verificación): `grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 mt-10 items-start` (o `lg:grid-cols-2` cuando una columna trae un card pesado que solo encaja en desktop ancho)
  - 4 cards (Cumplimiento): `grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mt-12`
  - 3 cards de contacto: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10`
- **Padding interior de cards** (PR #126): `padding: 'clamp(20px, 4vw, 24px)'` inline para cards que necesitan respirar en mobile sin romper a desktop. Reemplaza el `padding: 24` plano.
- **Headers de tarjetas con dos elementos en flex** (ej. certificate dark bar): siempre `flexWrap: 'wrap'` + `gap: 8` para que los dos labels apilen en 320px en lugar de colisionar.
- **Listas horizontales**: siempre `flex-wrap` cuando los ítems pueden desbordar en móvil (badges, certificaciones, footer)
- **TerrainMapSection — submods**: `MapLegend` usa `window.matchMedia('(max-width: 639px)')` para auto-collapse + pinning a `bottom: 16, left: 16, right: 16` en mobile (evita colisión con los nav controls top-right de MapLibre). `SiteInfoPanel` usa `gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'` en su detail grid para colapsar a 1-col en 320px sin JS. `TopoBand` SVG labels llevan `className="topo-band-labels"` que se oculta vía `@media (max-width: 413px)` en `globals.css`.
- **Quality gate antes de mergear cambios de landing**: confirmar manualmente en DevTools mobile-emulator a 320 / 375 / 414 / 640 / 768 / 1024 antes de aprobar. El build prerender (`○ /`) no detecta solapamientos visuales — solo errores de SSR. Hamburger interaction: tap → overlay aparece + body scroll lock + foco al primer link; tap link / Escape / click-outside / resize ≥1024 → cierra + foco regresa al toggle.

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
WHATSAPP_APP_SECRET            # Meta App Secret — valida X-Hub-Signature-256 en /api/webhook/whatsapp (PR #176). Sin esta key la validación se omite (logueado) y el flujo de media sigue funcionando
ANTHROPIC_API_KEY              # Requerida por app/api/whatsapp/route.js (asistente María)
OPENAI_API_KEY                 # Embeddings RAG (text-embedding-3-small). Opcional: sin esta key, retrieveKnowledge() cae al RPC FTS — el flow no se rompe, sólo se degrada el recall semántico
TWILIO_ACCOUNT_SID             # Consola Twilio — contact forwarding a Willis
TWILIO_AUTH_TOKEN              # Consola Twilio — contact forwarding a Willis
TWILIO_WHATSAPP_FROM           # whatsapp:+14155238886 (sandbox) o sender aprobado
TWILIO_VALIDATE_SIGNATURE      # (opcional, PR #176) 'false' desactiva la validación de X-Twilio-Signature en /api/whatsapp. Default: activa cuando TWILIO_AUTH_TOKEN está set
TWILIO_SIGNATURE_LOG_ONLY      # (opcional, PR #176) 'true' loguea mismatches sin rechazar — usar en el primer deploy para confirmar la reconstrucción de URL, luego quitar para enforce (403)
# ── Sistema de broadcast (nuevas) ────────────────────────────────────────────
GOLDAPI_KEY                    # goldapi.io — precios oro/plata/cobre (free tier disponible)
EXCHANGE_RATE_API_KEY          # exchangerate-api.com v6 (opcional; sin clave usa tier gratuito)
CRON_SECRET                    # Header Bearer para proteger /api/broadcast/run. Vercel Cron lo inyecta automáticamente como Authorization: Bearer en el GET
MISTRAL_API_KEY                # OCR de PDFs del Mercado de Proyectos (services/marketplace/processing.ts, modelo mistral-ocr-latest). Sin esta key la subida funciona pero el OCR queda en 'failed'
```

## Sistema de Broadcast Diario (`jobs/`, `services/broadcastService.ts`)

> **Estado operativo (2026-05-05):** el broadcast diario está **pausado en producción** hasta que la cuenta de Meta Business complete la verificación. Sin verificación, Meta Cloud API solo entrega a los números agregados como **test recipients** en Developer Console → WhatsApp → API Setup (cap ~5 números). Cualquier suscriptor en `usuarios_broadcast` fuera de esa lista recibe error 131030 ("Recipient phone number not in allowed list"). El código está completo y listo: cuando la verificación se apruebe (Business Manager → Security Center → Start Verification, ~2-5 días con utility bill / RTN), basta con poblar `usuarios_broadcast` y dejar el cron correr. **No re-arquitecturar a Twilio en el interim**: el sandbox de Twilio requiere que cada número envíe `join <keyword>` primero y la sesión expira a las 24h sin actividad — es peor para un broadcast diario que la ventana de test recipients de Meta.

- **Tablas**: `usuarios_broadcast`, `daily_report_config`, `precios_diarios`, `broadcast_log`
- **Roles broadcast**: `minero` (default), `comprador`, `tecnico`, `admin`
- **Flujo**: cron → `GET /api/broadcast/run` → `runDailyBroadcast()` → fetch precios → store → `generateDailyMessage()` (template fijo) → `sendDailyBroadcast()` → Meta Cloud API → log
- **Formato de reporte (Boletín Diario)**: template determinístico encabezado `BOLETIN DIARIO` + saludo `Buenos Días,` — precio internacional del oro USD/oz (etiquetado "Oro internacional", **no "LBMA"**), conversión a LPS por onza, TC, **precio de compra al 80% del precio internacional expresado por gramo** (`oroLps × 0.80 ÷ 31.1034768` — constante `TROY_OUNCE_GRAMS`), línea `Pago realizado en Lempiras en su cuenta de FINACOOP`, fecha+hora Honduras (UTC-6), fuente dinámica desde `precios.fuente` (fallback `yahoo-finance`), link `https://www.mape.legal`. **Viñetas con `*` (no `-`) en todas las líneas de datos — consistencia reforzada en PR #159** (antes Tasa de cambio y "Pago realizado…" eran texto plano mid-bullet-list, rompiendo la jerarquía visual). **No llama a Claude** — garantiza consistencia y evita alucinaciones de precio. Fallback automático cuando `precios.oro` es null/0 (mismo encabezado + mensaje "Hoy no pude traer el precio exacto…"). El template canónico en el system prompt de María (`app/api/whatsapp/route.js` §`NOTIFICACIÓN DIARIA DE PRECIOS`) refleja la misma estructura para responder ad-hoc a quien pida el boletín por WhatsApp.
- **Servicios**:
  - `services/userService.ts` — `getOrCreateUserByPhone`, `assignRole`, `getActiveSubscribers`, `listUsers`
  - `services/pricingService.ts` — `fetchGoldPrice`, `fetchSilverPrice`, `fetchUSDHNL`, `fetchCopperPrice`, `fetchAndStorePrices` (usa metals.live como fallback — **bloqueado en Vercel**, solo funciona en local)
  - `services/metalsPriceService.ts` — `fetchLiveMetalPrices()`: fuente de precios para María. Prioridad: 1) goldapi.io si `GOLDAPI_KEY` está set, 2) Yahoo Finance COMEX futures GC=F/SI=F (no requiere API key, accesible desde Vercel)
  - `services/broadcastService.ts` — `generateDailyMessage`, `sendDailyBroadcast`, `getLastBroadcastLog`
  - `services/configService.ts` — extendido con `getDailyReportConfig`, `enableMetric`, `disableMetric`, `updateMetricCurrency`, `updateMetricConfig`, `updateAudience`, `updateSchedule`, `getBroadcastTime`
- **Cron en producción — gate Pro-ready, cron diario en Hobby**: `vercel.json` corre el cron **una vez al día** `0 14 * * *` (14:00 UTC = 8 AM Honduras) → `GET /api/broadcast/run` con `Authorization: Bearer <CRON_SECRET>`. El plan **Hobby de Vercel solo permite cron diario** — `*/15 * * * *` rompe el deploy con `Hobby accounts are limited to daily cron jobs` (confirmado en PR #173, revertido a diario). El gate `shouldFireNow()` en la ruta GET es **Pro-ready**: lee `broadcast_time` (HH:MM hora Honduras, default `'08:00'`) y dispara cuando `hondurasNow().hhmm >= broadcast_time` y no haya row de hoy. Con el tick diario a las 8 AM el efecto neto es: el boletín sale a las 08:00 si `broadcast_time <= '08:00'`; **un `broadcast_time` posterior a las 08:00 NO se envía ese día** (footgun de Hobby — un único tick diario no puede disparar más tarde). **Para una hora configurable de verdad: subir a Vercel Pro y cambiar `vercel.json` a `*/15 * * * *`** — esa línea es lo único que separa Hobby de Pro; el resto del gate ya está listo. **Idempotencia** contra `broadcast_log`: row de hoy con `triggered_by='cron'` y `aborted_reason IS NULL` → skip (`{skipped:true, reason}`, no escribe nada); un row abortado por token NO cuenta, así que un token arreglado reintenta el mismo día; los rows manuales (`api`/`admin:…`) no suprimen el cron. **`POST` (manual / "Enviar ahora") bypasea el gate y siempre envía.** `assertCron(req)` corre antes del gate (no filtra estado a no-autenticados); en `NODE_ENV=production` sin `CRON_SECRET` responde **500**; en dev sigue abierta. **`broadcast_log.fecha` ahora se escribe en fecha local de Honduras** vía `hondurasDate()` (antes UTC `toISOString().slice(0,10)`) — fuente única de "hoy" compartida entre el writer y el reader del gate; `hondurasNow()`/`hondurasDate()` viven en `services/broadcastService.ts` (Intl `America/Tegucigalpa`, `hourCycle 'h23'`, sin DST).
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
  - `getOnboardingState(telefono)` — retorna estado actual o `null` si usuario ya registrado. **Hace dos pasadas defensivas en cada read** (PR #152, post-loop bug): (a) si `datos.nombre_completo` matchea `isBlockedName`, lo borra (heal de filas envenenadas con "Maria" antes del filtro de prefijos compuestos); (b) si `row.estado` no coincide con `nextPendingState(row.datos)`, repara el drift via upsert. Sin esto las filas legacy con `nombre_completo='Maria'` y `estado='ASK_ID'` permanecían en loop infinito hasta `STALE_ROW_MS` (7 días).
- **Extracción de datos**: Claude Haiku extrae campos del mensaje natural; `1/2/3` para rol no necesita LLM. **Fast-path adicional** (PR #152): mensajes que matchean `NO_DATA_REGEX` (saludos solos, acks cortos: "hola", "ok", "gracias", etc.) o `QUESTION_REGEX` (preguntas puras: "¿qué…?", "boletín", "precio", etc.) saltan a `return {}` sin llamada a Haiku — ahí es donde la mayoría de los falsos "Maria → nombre del usuario" se originaban.
- **Multi-campo**: "Soy Juan Pérez, trabajo en Olancho" → guarda nombre Y municipio, salta a `ASK_ID`
- **Filtro `isBlockedName`** (`services/onboardingService.ts:71`): rechaza el nombre del bot, brand tokens y saludos como `nombre_completo`. **Cubre tanto match exacto como prefijos compuestos** ("Maria", "María", "Maria Jose Lopez", "María García" → todos blocked) — la versión anterior solo bloqueaba match exacto, dejando pasar cualquier compuesto que empezara con Maria. Tradeoff conocido: usuarias reales llamadas Maria/María/Mape no pueden auto-registrarse y necesitan intervención admin via `PATCH /api/admin/maria/onboarding/[phone]`.
- **Correction branch** (`handleOnboarding`): "no me llamo X" / "mi nombre no" / "reiniciar" / "incorrecto" disparan rewind del último campo capturado. **Corre incluso si `datos` está vacío** (PR #152) — antes el guard `Object.keys(current.datos).length > 0` silenciaba la corrección cuando la fila estaba vacía o ya healed por el read defensivo, dejando al usuario sin escape.
- **Escape gate al nivel de ruta** (`app/api/whatsapp/route.js:36`): el regex `ONBOARDING_ESCAPE_PATTERNS` matchea `boletin|precio (de) (oro|plata|hoy)|cotización|tipo de cambio|ley general|reglamento|acuerdo 042|art. NN|no quiero registrar(me)|más tarde|después|stop|salir`. Cuando matchea, el handler bypasea el onboarding gate completo y va directo al flujo normal de María (la fila de onboarding queda intacta para retomar después).
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
- **`/admin/maria/rag-health`** — diagnóstico + operación del RAG semántico de María. Wrapper UI sobre `/api/admin/maria/rag-health` (probes) y `/api/admin/maria/embeddings-backfill` (escritura). Status banner verde/ámbar con `hint` accionable + 4 cards (env vars, filas con/sin embedding + sample_dim, estado de los 2 RPCs, probe a OpenAI). Tres botones: **Canario (5 filas)** · **Completar (todas las pendientes)** · **Forzar re-embed total** (confirm()-gated, costo OpenAI proporcional). Cada run muestra `Candidatos / Escritas / Fallidas / Modelo` + las primeras 20 razones de fallo. Auto-recarga el status tras cada backfill. **Reemplaza el flujo de DevTools + Supabase Studio para todo el ciclo de diagnóstico-y-fix del RAG.**
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

Dos secciones agrupadas: **admin items** (Resumen · Usuarios · Profesionales · Roles · Permisos · Contenido · **Concesiones** · Configuración) y **María items** (Panel María · Conversaciones · Clientes y leads · Transacciones · Broadcast · Auditoría · **RAG / Embeddings**) separadas por un eyebrow `MARÍA` en mono small caps. Los items pasan `icon: <Foo {...ICON} />` (JSX pre-renderizado), no `Icon: Foo` — `SidebarNav` es un client component y los component refs de lucide-react no cruzan el boundary RSC server→client. El ícono de Concesiones es `Mountain` y el de RAG / Embeddings es `Sparkles`.

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

## Mercado de Proyectos — Biblioteca de Documentos (`app/admin/mercado`, `/api/admin/marketplace/*`, 2026-05-28)

Gestión de documentos para "junior ventures" mineras: subir PDFs (reportes 43-101, permisos, geología, ambiental, financiero, mapas), OCR, chunk + embed para búsqueda híbrida, y browse/descarga. **Fase 1 = admin-only**: todo vive bajo `/admin/mercado` y `/api/admin/marketplace/*`, gateado por el layout admin (`app/admin/layout.tsx`) y `requireRole('admin')` en cada handler. Por estar todo bajo `/admin` y `/api/admin`, **`proxy.ts` no necesitó cambios** y todo el acceso a datos pasa por el cliente service-role.

- **Migración 026** (`supabase/migrations/026_marketplace_documents.sql`) — 6 tablas (`projects`, `project_documents`, `document_chunks` con `vector(1536)` + ivfflat, `document_tables`, `investor_project_access`, `document_access_log`), trigger FTS sobre `document_chunks.search_vector`, y 2 RPCs `SECURITY DEFINER owner postgres`: `search_document_chunks(...)` (híbrido semántico+FTS) y `get_parent_document_chunks(...)`. **RLS Fase 1: solo policies `<t>_service_all` (FOR ALL TO service_role)** — el `service_role` de este proyecto no tiene BYPASSRLS (mismo patrón que 024/025). Las policies de lectura pública/registrada/inversionista quedan **diferidas** hasta que se construyan esas superficies. Depende de la extensión `vector` de 024.
- **Storage** — bucket privado `project-documents` (100 MB/archivo, solo `application/pdf`), creado en la sección final de la migración 026 + policy `marketplace_objects_service_all` sobre `storage.objects`. Subida vía cliente service-role; descarga vía signed URL (1h) generada server-side tras `requireRole('admin')`.
- **Procesamiento** = ruta Next.js (NO edge functions — el repo no tiene `supabase` CLI). `services/marketplace/processing.ts:processDocument(id)`: firma un signed URL (10 min) → Mistral OCR (`document_url`, sin base64) → guarda `ocr_text`/`page_count` → `chunkText` (`lib/marketplace/chunking.ts`) → `embedBatch` + `toVectorText` (reusa `lib/maria/embeddings.ts`) → inserta `document_chunks`. Idempotente (borra chunks previos en reproceso). Disparado por el cliente tras la subida (`POST .../documents/[id]/process`) y por el botón "Reprocesar" — NO fire-and-forget desde la ruta de subida (serverless congela tras responder).
- **Rutas** (`force-dynamic`, `requireRole('admin')`): `GET/POST /api/admin/marketplace/projects`, `GET .../projects/[projectId]`, `GET/POST .../projects/[projectId]/documents` (POST = multipart, primer handler con `formData()` del repo), `GET .../projects/[projectId]/search` (híbrido + fallback FTS), `POST .../documents/[documentId]/process` (`maxDuration=300`), `GET .../documents/[documentId]/download`.
- **UI** (inline tokens del Color Manual, NO clases Tailwind `bg-[--token]`): `/admin/mercado` (lista + crear), `/admin/mercado/[projectId]` (categorías + búsqueda + descarga + reproceso + subida), `components/marketplace/DocumentUpload.tsx`. Nav en `app/admin/layout.tsx` (ícono `Briefcase`).
- **Activación manual (Vercel NO la hace):** (1) aplicar `026_*.sql` en Supabase Studio (incluye el bucket); (2) setear `MISTRAL_API_KEY` en `.env.local` + Vercel; (3) `node scripts/seed-marketplace-sample.mjs` para un proyecto de ejemplo (los docs sembrados son placeholders sin archivo — descarga/OCR fallan sobre ellos; una subida real ejercita el pipeline completo).
- **Fuera de scope Fase 1 (deuda documentada):** rol "inversionista" + superficies público/registrado; extracción estructurada a `document_tables` (tabla creada, vacía); watermarking (`watermark_id` sin uso); docs grandes que excedan el límite serverless (script de reproceso como fallback futuro).

## Mercado de Equipos — catálogo de maquinaria (`/equipos`, `/admin/equipos`, 2026-07-11)

Catálogo público de equipos de lavado de oro para mineros artesanales (plantas de lavado, trommels, sluice boxes, mesas de concentración, chancadoras, bombas, generadores, cribas, cajas de esclusa, kits portátiles). No confundir con "Mercado de Proyectos" (`/admin/mercado`, documentos para junior ventures) — son features distintas.

- **Migración 027** (`supabase/migrations/027_equipos_mercado.sql`) — tabla `equipos_mercado` (slug único, categoría con CHECK de 10 valores, precios USD min/max, MOQ, specs jsonb, `search_vector` tsvector generado en español, soft-delete vía `activo`). RLS: lectura pública sólo `activo = true`; escritura admin/abogado/tecnico_ambiental vía `user_roles`; policy `FOR ALL TO service_role` explícita (el service_role del proyecto no tiene BYPASSRLS — patrón 024/025/026). Tres RPCs `SECURITY DEFINER owner postgres` (patrón 019): `search_equipos_mercado(p_query, p_categoria, p_precio_min, p_precio_max, p_limit, p_offset)` (FTS español + ILIKE fallback, retorna `total_count` por fila), `get_equipo_by_slug(p_slug)` (sólo activos), `equipos_categoria_stats()` (counts + labels). **Semántica de `p_precio_max`**: filtra por `precio_min_usd <= p_precio_max` (el precio de ENTRADA cabe en el presupuesto) — comparar contra `precio_max_usd` excluía productos con rango cuyo precio inicial era asequible (fix post-review 2026-07-12). **Gotcha plpgsql**: el RPC de stats ordena con `ORDER BY COUNT(*)` — el alias `count` es también OUT variable y la referencia ambigua tira error en runtime.
- **Tipos**: `lib/types/equipo.ts` — `EquipoCategoria`, `CATEGORIA_LABELS` (debe mantenerse en sync con el CHECK y el CASE del RPC de stats), `EquipoMercado`, `EquipoSearchResult`, `EquipoFilters`, `CategoriaStat`.
- **Servicio**: `services/equiposService.ts` — reads públicos vía proxy anon `supabase` + RPCs; writes admin vía `getAdminClient()` **dentro de cada función** (nunca module-level). `searchEquipos` aplica `sanitizeIlikeTerm` (importado de `concesionesService` — invariante PR #159 §29) + cap de 100 chars antes del RPC, y re-prueba página 0 cuando un offset pasa del final para no colapsar `total` a 0. `deleteEquipo` es soft-delete (`activo = false`) — el catálogo público nunca ve inactivos; la reactivación es `PATCH { activo: true }` (botón Reactivar en la tabla admin).
- **Rutas API**: `GET /api/equipos` (público, valida categoria contra allowlist, **rate-limited 60/5min por IP** vía `lib/rateLimit.ts`, cache 60s + SWR 5min) · `GET /api/equipos/categorias` (público, cache 300s) · `GET/POST /api/admin/equipos` + `PATCH/DELETE /api/admin/equipos/[id]` (`requireRole`: GET admin/abogado/tecnico_ambiental, writes admin/abogado; PATCH con whitelist de campos + validación numérica espejo del POST — un NaN del form llega como JSON null y sin validación violaba NOT NULL/CHECK como 500 opaco; 23505 → 409; slug regex `^[a-z0-9-]+$`). **Imágenes validadas contra `ALLOWED_IMAGE_HOSTS`** (`lib/types/equipo.ts`, debe mantenerse en sync con `images.remotePatterns` de `next.config.ts`) — un host no listado rompe `next/image` en cada superficie que muestre el producto. **`precio_max_usd: null` en PATCH borra el rango** — el form admin manda null (no undefined, que JSON.stringify descarta y el whitelist nunca ve).
- **Frontend público**: `app/equipos/page.tsx` (server, `force-dynamic`, filtros por searchParams, **degrada a catálogo vacío con log `[equipos] non-fatal` si la migración 027 no está aplicada** — no 500 en superficie pública) + `EquiposCatalogClient.tsx` (grid de cards, sidebar de filtros desktop, bottom sheet mobile `<lg`, skeleton estático sin `animate-pulse` per DESIGN.md). Detalle: `app/equipos/[slug]/page.tsx` + `EquipoDetailClient.tsx` (galería, specs, CTA WhatsApp `wa.me/50497373139` con mensaje pre-llenado + mailto a gerencia). Los precios se muestran con `--earth` en `--font-playfair` (numerales grandes per DESIGN.md).
- **Admin**: `/admin/equipos` (gateado por el layout admin; página con catch defensivo pre-migración) — tabla CRUD con modal, stats cards, `busyId` lock en acciones de fila, `<th scope="col">`. Nav item "Equipos Mercado" (ícono `Wrench`) en `app/admin/layout.tsx`.
- **Imágenes**: hotlinked de `image.made-in-china.com` — host agregado a `images.remotePatterns` en `next.config.ts` (sin esto `next/image` rechaza el host y la card crashea). Si el CDN del proveedor rompe hotlinking, migrar a Supabase Storage.
- **proxy.ts NO cambió**: `/equipos` y `/api/equipos` no están en el matcher (públicos por default); `/admin/equipos` y `/api/admin/equipos` ya estaban cubiertos por `/admin/:path*` + `/api/admin/:path*`.
- **Activación manual (Vercel NO la hace):** (1) aplicar `027_equipos_mercado.sql` en Supabase Studio → SQL Editor (idempotente); (2) `node scripts/seed-equipos.mjs` (12 productos, idempotente por slug con `ignoreDuplicates`). Hasta entonces el catálogo renderiza vacío sin romper.
- **Deuda conocida:** 2 URLs de imagen del script fuente venían truncadas en el PDF — esos productos reusan imágenes completas del mismo set (mismo approach que el script fuente, que ya repetía imágenes entre productos); reemplazar con fotos reales del proveedor cuando existan. Sin paginación en UI (la API la soporta vía limit/offset — el catálogo muestra los primeros 50). `galeria_urls`/`especificaciones` no son editables desde el form admin (sólo vía API/SQL).

## Auditoría — deuda técnica conocida (2026-05-03, parcialmente resuelta 2026-05-09)

Documentado para evitar trabajo duplicado en futuras sesiones. Ninguno está bloqueando producción.

> **Update 2026-05-09 (`claude/update-ui-colors-wGO7B`):** la sección de paleta + tipografía + audit de `app/page.tsx` / `app/globals.css` / `app/layout.tsx` quedó **resuelta** al adoptar el MAPE LEGAL Color Manual v1.0. Ver README §0 y commit `39875cf`. Los items que se mantienen son los marcados ⚠ abajo; los demás están tachados o eliminados.

> **Update 2026-05-10 (`claude/admin-audit-dashboard-NHVaE`):** Master Control Panel para María shipped + revisado por dos agentes (lógica + diseño/código). Findings críticos resueltos en commit `c4057fa` — incluyendo (a) take-over POST loguea con la forma `whatsapp:+504…` que matchea la query de `route.js` para que María vea sus propias respuestas admin, (b) `route.js` strippea el prefijo `[Admin · email]` antes de armar el prompt de Claude para no filtrar correos del admin al cliente, (c) `/api/admin/broadcast/trigger` es fire-and-forget para no exceder timeout de Vercel functions, (d) POST de `/api/admin/broadcast/subscribers` preserva opt-out (no resetea `activo`/`suscrito` en upsert), (e) PATCH de onboarding hace upsert. Ver sección "Master Control Panel — María" arriba.

> **Update 2026-05-12 (`claude/add-embedding-retrieval-adxvF` + `…-drop-functions` + `…-vector-serialization` + `…-document-embedding-rollout-state`):** RAG semántico está **shipped en código pero NO operativo en producción**. Estado al cierre (2026-05-13 07:10 UTC):
>
> **Root cause descubierto:** la columna `maria_knowledge.embedding` se había creado manualmente con **`vector(384)`** (probablemente para `gte-small` o `text-embedding-3-small` truncado), no `vector(1536)` como asume el código. Nuestro código pasa arrays de 1536 floats, y pgvector rechazaba el typmod mismatch silenciosamente vía PostgREST — el `UPDATE` regresaba count=0 sin error, y la rama original del endpoint (pre-PR #130) lo reportaba como `done: 53` falsamente. Confirmado con un `update … set embedding = array_fill(0.1::real, array[1536])::vector` desde SQL Editor que arrojó `22000: expected 384 dimensions, not 1536`.
>
> **Mitigación aplicada:** columna recreada como `vector(1536)` + IVFFLAT reconstruido + `notify pgrst, 'reload schema'`. Verificado con `format_type(atttypid, atttypmod)` → `vector(1536)`.
>
> **Estado al cierre:** aún después de la resize, el backfill sigue fallando (el usuario reportó "not working" sin pegar el JSON exacto del response). Posibles causas residuales — investigar en próxima sesión:
>   1. **PR #130 sin mergear** — si la versión deployed sigue siendo el código original (raw array + sin count check), nada cambió desde el primer intento. Verificar en `mape.legal/api/admin/maria/embeddings-backfill` que la response incluya `failed: N > 0` cuando falle (señal de que PR #130 sí está activo).
>   2. **PostgREST schema cache no se refrescó del todo** — probar re-ejecutar `notify pgrst, 'reload schema'` *después* de la resize del column, no antes.
>   3. **Privilegios** — confirmar `select grantee, privilege_type from information_schema.table_privileges where table_name = 'maria_knowledge'` muestra `service_role` con `UPDATE`. Si no, `grant all on public.maria_knowledge to service_role`.
>   4. **Manual update final test** — tras resize ya confirmamos que `array_fill(0.1::real, array[1536])::vector` no da error de dim. Ejecutar el `update … returning has_embedding` original para ver si se persiste como postgres.
> - El endpoint **`/api/admin/maria/embeddings-backfill` queda en producción** como herramienta de debug — re-ejecutable cuando se resuelva la causa.
> - PR #130 (vector serialization + count=0 check) y PR #134 (este doc update) quedan abiertos al cierre.

> **Update 2026-05-13 (PR #136 + follow-up `claude/fix-rag-embedding-bugs-gwKmX`):** dos blockers más confirmados por dos agentes paralelos (code-review + logic-audit) y arreglados:
>
> 1. **`update(values, { count: 'exact' }).eq(...)` en supabase-js v2 devolvía `count: null` (no 0)** — sin `.select()` el cliente usa `Prefer: return=minimal` y el header `Content-Range` no se propaga al property `count`. El check `count === 0` era código muerto: cada UPDATE silenciosamente fallida incrementaba `done`. El endpoint reportaba `{ done: 53, failed: 0 }` aún cuando ninguna fila se escribió — síntoma "not working" exacto. Fix (PR #136): `.update(...).eq('id', row.id).select('id')` y check `data.length === 0`. PostgREST devuelve la fila escrita, ground truth en lugar de número fantasma.
> 2. **`retrieveKnowledge()` pasaba `number[]` crudo al RPC `match_maria_knowledge`** — mismo bug JSON↔vector que PR #130 arregló para UPDATE, pero el query path se omitió. Fix (PR #136): serializar a la text form `[f1,f2,…]` antes del `rpc(...)`.
>
> Follow-up PR `claude/fix-rag-embedding-bugs-gwKmX` (este) endurece el pipeline:
>   - Helpers `toVectorText` y `buildCanonicalText` extraídos a `lib/maria/embeddings.ts` — única fuente de la serialización canónica.
>   - Timeouts (5 s query / 15 s batch) + `maxRetries: 2` + errores categorizados (401 / 429 / TIMEOUT) en `embedQuery` y `embedBatch`.
>   - Pre-check en `retrieveKnowledge` que salta directo a FTS cuando no hay embeddings — sin desperdiciar la llamada a OpenAI.
>   - Endpoint nuevo `GET /api/admin/maria/rag-health` (admin-gated, modelo `auth-config`): ENV vars + row counts + RPC probes + OpenAI probe + sample dim de un embedding + `hint` accionable. **Primer diagnóstico cuando el RAG no responda.**
>   - Página admin `/admin/maria/rag-health` (commit `d76477a`): UI wrapper sobre el endpoint anterior + `embeddings-backfill` con 3 botones (canary 5 / completar / forzar re-embed). Elimina la dependencia de DevTools paste protection y SQL Editor para el ciclo diagnóstico-y-fix.
>
> **Root cause final descubierto en producción (2026-05-13 ~18:00 HN):** después de aplicar todos los fixes anteriores el canary seguía devolviendo `failed: 5, "update affected 0 rows"`. La cadena de diagnósticos (RLS forzado? policy? grants? schema cache?) descartó todas las hipótesis estructurales; SQL Editor con `SET LOCAL ROLE service_role` + UPDATE devolvía `id=2, has_embedding=true` — la policy `maria_knowledge_service_all` funciona perfectamente cuando el rol activo es `service_role`. El problema era que **`SUPABASE_SERVICE_ROLE_KEY` en Vercel no era la JWT con claim `role: service_role`** — al validar la JWT, PostgREST hacía `SET ROLE` al rol del claim (probablemente `anon`), y entonces SELECT/RPC funcionaban (read policy + grant execute), pero UPDATE caía silenciosamente porque ninguna policy `for all to anon` existe. Fix: copiar el `service_role` secret legacy desde **Supabase → Settings → API Keys (Legacy)**, pegarlo en **Vercel → Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY (Production)**, redeploy. Canary subsecuente: `5 / 0`. ✅
>
> **Lección operativa**: cuando supabase-js `.update()` devuelve `data: []` sin error desde un cliente con la "service_role key", **la primera hipótesis a verificar es que la JWT realmente tenga `role: service_role`**. SELECT y RPC con `grant execute to anon` enmascaran el problema porque funcionan con cualquier rol válido — solo UPDATE/INSERT/DELETE revelan el mismatch. El nuevo `/admin/maria/rag-health` reduce este diagnóstico a un click; la lección general aplica a cualquier path admin que dependa del service_role.

### Lo que se aprendió (para próximas migraciones)

1. Cuando una tabla pre-existe (creada fuera de migraciones), **`create table if not exists` + `add column if not exists` son completamente no-op** si los objetos ya existen — incluso si los tipos no coinciden. La migración se ejecuta "limpia" pero produce un schema inconsistente.
2. **Inspección obligatoria antes de escribir una migración que toca una tabla existente:** correr `information_schema.columns` Y `format_type(atttypid, atttypmod)` desde `pg_attribute` para ver el typmod completo (info_schema reporta `udt_name = 'vector'` sin la dimensión).
3. **pgvector + supabase-js silent failures:** size mismatches (384 vs 1536) no se reportan como error al cliente — el UPDATE simplemente afecta 0 filas. **Cualquier path de UPDATE crítico debe usar `.update(...).eq(...).select('id')` y validar `data.length > 0`** — el patrón anterior con `{ count: 'exact' }` sin `.select()` deja `count: null` (no 0) en supabase-js v2 y el check `count === 0` es dead code. Corregido en PR #136.

### Saga de migración 024 — para que no se repita

Tres errores encadenados al aplicar 024 en producción, todos resueltos:

1. **`42P13 cannot change return type of existing function`** — la tabla y el RPC `search_maria_knowledge_fts` se habían creado manualmente antes del PR con signatures distintas. `create or replace function` no puede cambiar return types. **Fix:** prepend `drop function if exists` antes de cada `create or replace`. La forma robusta (vive en 024 actual) es un bloque `do $$ ... pg_get_function_identity_arguments(p.oid) ... drop function ... $$` que enumera todos los overloads y los droppea, en lugar de drops narrow.
2. **`42P13 return type mismatch ... integer instead of uuid`** — el `id` de `maria_knowledge` en prod es `integer` (de un setup manual con `serial`), no `uuid` como asumía la migración. `create table if not exists` es no-op cuando la tabla existe → la columna integer sobrevivió + el RPC quería retornar uuid. **Fix:** migración 024 ahora declara `id integer generated by default as identity` y los RPCs retornan `id integer` con casts explícitos `category::text, title::text` (la tabla guarda varchar).
3. **`42725 function is not unique`** — después de aplicar la migración corregida, llamar al RPC dio ambiguous-function. La policy 024 había creado el nuevo overload PERO el viejo seguía vivo (Postgres permite ambos cuando los OUT params difieren). **Fix:** el bloque `do $$` (mismo del #1) ya droppea TODO regardless of OUT params, así que esto es ahora redundante con #1.

Lección operativa: cuando una tabla existe pre-migración (creada manualmente), las assumptions de `create table if not exists` no aplican. **Antes de escribir migraciones que tocan tablas existentes, correr `information_schema.columns` para ver el schema real**, no el deseado.

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

### 11 deploys rotos por `getSupabase` inexistente — resuelto 2026-05-11 (commit `7e74179`, PR #125)
- **Síntoma**: cada deploy en Vercel (5 production + 6 preview) desde `aabc377` (12h, incluyendo el merge de PR #124) terminó en **Error**. Dashboard de Vercel mostraba `Status 5/6 Error` para todas las filas recientes — la última production OK era anterior a la migración 023.
- **Causa raíz**: `services/concesionesService.ts:16` introducido en `aabc377` importaba `import { getSupabase } from '@/services/supabase'`. Ese módulo sólo exporta un `Proxy<SupabaseClient>` llamado `supabase` — no hay símbolo `getSupabase`. Turbopack lo cazó como `Export getSupabase doesn't exist in target module` durante la compilación de `/api/concesiones/buscar` y mató el build entero antes de empezar el page-data collection.
- **Confusión**: existe un helper privado `getSupabase()` en `app/api/whatsapp/route.js:17` (cache lazy local de ese archivo, no exportado). El doc de §Framework en CLAUDE.md lo mencionaba sin aclarar el alcance, así que una lectura rápida sugería que podía importarse. Aclarado arriba: ningún archivo importa `getSupabase` desde `@/services/supabase` — todos los servicios usan el proxy `supabase` directo.
- **Fix**: cambiar a `import { supabase } from '@/services/supabase'` y usar el proxy directamente (mismo patrón que `cmsService`, `expedientesService`, `fasesService`, `dashboardService`). Removido el `if (!supabase) return [];` muerto — el proxy es siempre truthy y un env var faltante ahora tira error claro en lugar de un resultado vacío silencioso.
- **Lección recurrente**: tercera vez que un build production rompe sin que ningún gate pre-merge lo detecte (ver también PR #100 con `const clientes` dropeado y PR #104 con íconos lucide cruzando RSC). `npm run build` local sobre la rama antes de mergear sigue siendo el único filtro confiable — `tsc --noEmit` y CI checks han pasado limpios en las tres ocasiones.

### María atrapada en `ASK_ID` por nombre del bot capturado como nombre del usuario — resuelto 2026-05-15 (PR #152)
- **Síntoma reportado**: una conversación quedaba bloqueada en bucle infinito. Cada turno, sin importar el contenido del mensaje del usuario ("Mi nombre no es maria", "Boletin diario", "hola maria"), María respondía exactamente lo mismo: `"Mucho gusto, Maria. Compartime tu numero de identidad (DPI)."` — la ASK_ID question con `nombre = "Maria"` (el nombre del propio bot) renderizado como saludo.
- **Causa raíz (cinco bugs encadenados)**:
  1. `isBlockedName` solo hacía match exacto. "Maria" se bloqueaba; "Maria Jose Lopez" pasaba el filtro y se persistía como `nombre_completo`.
  2. El prompt de extracción tenía un ejemplo contradictorio: instruía a Haiku "NO extraer Maria" pero listaba `"Maria Jose Lopez"` como ejemplo de nombre válido. Haiku (modelo chico) sigue ejemplos antes que reglas.
  3. `extractFields` siempre llamaba a Haiku. Con el prompt contaminado, una entrada inocua como "hola maria" con frecuencia salía con `nombre_completo: "Maria…"`.
  4. La rama de corrección requería `Object.keys(current.datos).length > 0`. Cuando la fila estaba vacía o ya healed, la corrección se silenciaba sin escape.
  5. `getOnboardingState` no validaba consistencia: filas con `estado='ASK_ID'` + `datos.nombre_completo='Maria'` quedaban indefinidamente porque `nextPendingState` las consideraba "completas hasta DPI" y no las re-derivaba a `ASK_NAME`.
  
  Combinado: el bot capturaba "Maria" como nombre del usuario en el primer turno → buildQuestion lo usaba para saludarse a sí misma en cada turno subsiguiente → ningún input lograba escapar (ni siquiera "Mi nombre no es maria" porque el guard `Object.keys` también fallaba en ciertos casos).
- **Fix (PR #152)** — cinco capas defensivas en `services/onboardingService.ts`:
  - `isBlockedName` ahora cubre prefijos compuestos via `BLOCKED_NAME_PREFIXES = {maria, maría, mape}` — cualquier nombre cuya **primera palabra** sea una de esas devuelve true. Tradeoff conocido: usuarias reales llamadas Maria necesitan PATCH admin manual.
  - Prompt de Haiku reescrito: ejemplos cambiados a `"Jose Lopez"`, `"Ana Garcia"`; regla explícita de que compounds que empiezan con Maria/María/Mape siempre devuelven null.
  - Fast-path en `extractFields`: `NO_DATA_REGEX` (saludos/acks: hola, ok, gracias…) y `QUESTION_REGEX` (interrogativas: qué, cómo, boletín, precio…) saltan a `return {}` sin llamar a Haiku — corta el path donde más se manifestaba la alucinación.
  - Branch de corrección elimina el guard `Object.keys`: detecciones positivas siempre disparan rewind del último campo (no-op safe cuando datos está vacío).
  - `getOnboardingState` heal en cada read: (a) si `nombre_completo` matchea `isBlockedName`, lo borra; (b) si `estado` no coincide con `nextPendingState(datos)`, repara via upsert. Las filas legacy envenenadas (de la versión vulnerable del filtro) se autoarreglan en el próximo contacto, sin esperar STALE_ROW_MS ni intervención admin.
- **Lecciones operativas**:
  - Cuando un LLM chico (Haiku) recibe instrucciones contradictorias en un mismo prompt, los **ejemplos pesan más que las reglas declarativas**. Auditar ejemplos cuando una regla "no debería estar haciendo esto" se incumple.
  - Filtros de "no aceptes este valor" deben cubrir **prefijos y sufijos compuestos**, no solo match exacto, cuando el LLM puede agregar decoración.
  - State machines persistentes deben **revalidar consistencia en cada read** y autoanclar a un estado coherente — el costo es bajo (un `nextPendingState` y un upsert condicional) y evita que cualquier escritura corrupta o manual deje a un usuario atrapado por días.
  - Antes de llamar a un LLM para extracción de campos en un loop, agregar un fast-path determinístico para los inputs más comunes que NO tienen datos. Reduce costo y elimina toda una clase de alucinaciones.

### María deflectaba "¿Qué dice el Artículo 28-A?" por seed de RAG nunca ejecutado en prod — resuelto 2026-05-15 (PR #155)
- **Síntoma reportado**: María respondía a preguntas legales puntuales ("¿Qué dice el Artículo 28-A de la Ley del Ambiente?", "¿Cuáles son los 16 requisitos del SLAS-2?") con la frase de fallback `"Para una interpretación exacta… te sugiero escribir directamente a gerencia@mape.legal"`. El system prompt y el código de retrieval estaban correctos; el branch `[rag] path=none` aparecía en cada turno de Vercel logs.
- **Causa raíz (combinación de dos)**:
  1. **El seed de la base ambiental nunca corrió en producción.** Commit `a7b6a60` (2026-05-14) agregó 165 chunks (Decreto 104-93, Decreto 181-2007 con Arts. 28-A/29-C, SLAS-2) en `data/maria-knowledge/honduras-ambiental/*.md` y el script `scripts/seed-maria-honduras-ambiental.mjs`. Mergear el PR dejó los markdowns en el repo pero **Vercel no ejecuta scripts/**. Resultado: `select count(*) from maria_knowledge where source like 'honduras-ambiental/%'` → 0 filas. María buscaba el chunk semántica y por FTS, no encontraba nada, caía al guardrail genérico.
  2. **El prompt-level fix** (commit `0a60e59`, merged 16:02 UTC ese mismo día) carve-out del guardrail "deferir a gerencia" para que María cite el RAG cuando el bloque CONTEXTO DEL SISTEMA cubre la pregunta. Aunque hubiera estado deployed antes del seed, el resultado habría sido idéntico — el RAG no tenía nada que citar.
- **Diagnóstico end-to-end vía `/admin/maria/rag-health` + SQL Editor**: el admin UI reportaba `Total = 53, Sin embedding = 0` — confundente al principio (parece sano) hasta que el operador busca por `source LIKE 'honduras-ambiental/%'` y obtiene 0. El primer test de FTS `select * from search_maria_knowledge_fts('Artículo 28-A Ley del Ambiente', 5)` también devolvió 0 — confirmó que el problema era la ausencia de filas, no un threshold mal calibrado.
- **Fix aplicado**:
  1. Generar `data/maria-knowledge/seed-honduras-ambiental.sql` (672 líneas, 165 INSERTs, idempotente vía `delete … where source like 'honduras-ambiental/%'` antes del insert) y pegarlo en Supabase Studio → SQL Editor. Inserts persistieron correctamente (`select source, count(*)` → 17/117/31 por source).
  2. Backfill de embeddings desde `/admin/maria/rag-health` → botón **"Completar"**. Resultado: `Candidatos: 165 · Escritas: 165 · Fallidas: 0 · Modelo: text-embedding-3-small`. Banner verde `RAG operativo · 218/218 rows embedded`.
  3. Smoke test FTS retornó las 5 filas esperadas. WhatsApp test confirmó: María ahora cita el artículo en lugar de deflectar.
- **Mitigación estructural (PR #155)**:
  - Helper genérico nuevo `scripts/chunks-json-to-sql.mjs` — convierte cualquier `<categoria>.chunks.json` (producido por `seed-maria-*.mjs --dry-run --json`) en SQL idempotente pegable en Supabase Studio. Cubre el caso operativo donde el operador no tiene `SUPABASE_SERVICE_ROLE_KEY` localmente pero sí tiene acceso a SQL Editor. Detecta el prefijo de categoría automáticamente desde el primer chunk; valida que todos los chunks compartan ese prefijo.
  - README §"Runbook — Añadir conocimiento al RAG de María" + MARIA.md §12 documentan el checklist obligatorio en 8 pasos: transcribir markdown → escribir seed → `--dry-run --json` → cargar a Supabase (path a o b) → verificar conteos → backfill embeddings → smoke test FTS → test WhatsApp end-to-end. **Ningún paso es opcional.**
  - `scripts/seed-maria-honduras-ambiental.mjs` ya tenía la doc de los pasos manuales en su header; otros seeds futuros deben replicarla.
- **Lecciones operativas**:
  - **Vercel deploys son insuficientes para cargar contenido al RAG.** Igual que con migraciones SQL (operador aplica manualmente en Studio), los seeds son explícitamente manuales por dos razones: pueden sobrescribir filas existentes y consumen créditos de OpenAI cuando se embebe.
  - **`/admin/maria/rag-health` puede mostrar "saludable" mientras un nuevo dominio está vacío.** El banner verde indica "el pipeline funciona", no "todo el conocimiento esperado está cargado". Para datos nuevos, agregar siempre un smoke-test FTS con un keyword distintivo del documento al final del runbook.
  - **Cuando el RAG deflecta una pregunta cubierta por una fuente reciente, ir directo al chequeo `select count(*) … where source like '<categoria>/%'`** — antes de revisar threshold, prompt, o cualquier otro candidate. La causa más común es el seed faltante.

### Carryover Phase 0 — verificado limpio 2026-05-14
- ✅ `app/dashboard/minas/page.tsx:72` — el lint error `react-hooks/set-state-in-effect` que se reportaba en línea 72 ya no existe; tsc --noEmit pasa limpio y `npm run build` compila en 10.7s. El lint reporta una variante en línea 112 (`useEffect(() => { load(); }, [load])`), pero es un patrón estándar de "load on mount" — la regla strict de eslint-config-next 16 / React 19 marca este patrón pero no bloquea build ni produce regresión runtime. Compartido con el resto del codebase (~6 ubicaciones), no requiere fix puntual.
- ✅ `app/api/admin/clientes/route.ts:61` — el TS error `Cannot find name 'clientes'` está resuelto: el `const clientes = (data ?? []) as ClienteRow[]` vive en línea 46 y `tsc --noEmit` retorna exit 0.

### Lint warnings strict-mode pendientes (no bloqueantes, build pasa limpio)
9 errores y 11 warnings en `npm run lint` con eslint-config-next 16. Categorías:
- **`react-hooks/set-state-in-effect`** en 5 lugares (`app/admin/concesiones/page.tsx`, `app/dashboard/minas/page.tsx`, `app/registro/RegistroSearch.tsx`, `components/terrain/TerrainMapSection.tsx`) — todos son patrones legítimos de "fetch on mount" o "reset on filter change". La regla es nueva en React 19 y conservadora; no afecta runtime ni build.
- **`react-hooks/refs`** en `components/terrain/MiningMap3D.tsx:161-164` — refs escritas durante render para que los handlers click/keydown vean props frescas. Es un patrón intencional (los handlers se crean una vez en map init). Migración correcta: escribir refs en `useEffect`. Pendiente como deuda técnica.
- **Unused vars** menores (`useCallback`, `Search`) — limpieza cosmética. `CATEGORIA_LABELS` y `_updatedBy x2` resueltos en PR #159.
- **Unused eslint-disable directives** en `MiningMap3D.tsx` (4 líneas) — código defensivo que la regla actualizada ya no necesita silenciar.

### Auditoría completa del panel admin (PR #159, 2026-05-23)

Resultado de una auditoría multi-agente de los 49 archivos bajo `app/admin/**` + `app/api/admin/**` + servicios consumidos. 16 dominios paralelos (auth, María APIs/UI, broadcast, concesiones, usuarios, permisos, minas, performance, errores, loading/UX, security, a11y, schema, dead code, config/CMS). 7 commits temáticos, build limpio (10.6s). Las invariantes que de ahora en adelante deberían respetarse en cualquier ruta `/api/admin/*` nueva:

**1. Auth obligatorio en cada handler.** El proxy es defensa de primera línea (chequea cookies, no firma JWT). Toda ruta debe llamar `requireRole('admin', …)` al principio. Reglas legacy descubiertas y cerradas:
- `/api/whatsapp/send` ahora exige `requireRole('admin' | 'abogado' | 'tecnico_ambiental')` (antes era cookie-only via proxy → sesiones expiradas podían disparar envíos).
- `/api/debug/prices` ahora exige `requireRole('admin')` (antes era anon → exponía el mapa de env vars presentes/ausentes).

**2. No filtrar `error.message` de Supabase al cliente.** El patrón canónico ahora es `console.error('[scope] failed:', error)` + return de mensaje genérico ("Error al X"). Los errores crudos exponen nombres de tablas, columnas, constraints, y a veces fragmentos de queries. Aplicado a ~18 rutas en PR #159. Si abrís una ruta nueva, replicá el patrón.

**3. `console.error` antes de cada return 500 genérico.** Vercel function logs son la única ventana al diagnóstico en producción; sin esto, los failures son invisibles.

**4. `PG 23505` → 409.** Cualquier ruta que haga INSERT/UPSERT debe atrapar el código `23505` (unique violation) y mapearlo a 409 con mensaje específico. Antes faltaba en `roles POST`, `profesionales POST/PATCH`, `subscribers POST`, `usuarios POST` (este último también necesita mapping de "already registered" del `auth.admin.generateLink`).

**5. PATCH usuarios — invariantes de seguridad:** `lib/serverAuth.ts` no es suficiente, hay que **(a)** validar `rol` contra allowlist `['admin','abogado','tecnico_ambiental','cliente']`; **(b)** bloquear cualquier self-modificación de `rol` o `activo` (sólo `perfil_id` permitido); **(c)** chequear `wouldLeaveZeroActiveAdmins()` antes de demote/deactivate. Lo mismo aplica a DELETE para que no se borre al último admin.

**6. Config writes restringidos a keys que ya existen.** El nuevo helper canónico es `updateExistingConfigs()` en `services/configService.ts` (NO `setConfigs` — ese sigue siendo internal para callers trusted como `updateAudience/updateSchedule`). `/api/admin/config PATCH` rechaza keys desconocidas con 400 + lista de ignored. Para agregar una key nueva, usar una migración seed — no permitir crearlas vía UI.

**7. Take-over de María: `whatsapp:+504…` siempre.** `POST /api/admin/maria/conversations/[phone]` debe forzar la forma `whatsapp:${normalized}` como `numero_whatsapp` (no muestrear filas previas). Si la primera fila vino de Meta (stripped), un sample-based path orphana todas las respuestas admin de la vista de historial de María. La regla `route.js:ADMIN_PREFIX_RE` que strippea `[Admin · email]` del prompt sigue siendo necesaria.

**8. Onboarding PATCH es upsert atómico.** `/api/admin/maria/onboarding/[phone] PATCH` ahora usa `.upsert(…, { onConflict: 'telefono' })` (no el patrón SELECT-then-INSERT/UPDATE que tenía race condition).

**9. Performance — paralelizar awaits independientes.** El audit encontró 3 rutas con N awaits secuenciales de queries que no dependen una de otra. Resueltos: `/api/admin/minas/[id] GET` (5→1 round-trip), `/api/admin/maria/rag-health` (5 probes via `Promise.allSettled`), `/api/admin/usuarios GET` (2 queries paralelas). Patrón a replicar en rutas nuevas.

**10. `listUsers()` necesita `perPage` explícito.** El default es 50, silenciosamente trunca. `/api/admin/usuarios` ahora pasa `perPage: 1000` (ceiling de Supabase API) y loggea warning cuando se alcanza. Past 1000 hace falta pagination real.

**11. Embeddings backfill: parallel chunks.** `/api/admin/maria/embeddings-backfill` paralelizado en chunks de 10 (antes era loop secuencial que tocaba el ceiling de `maxDuration=60s` past ~200 rows). Per-row failures aún se acumulan independientemente.

**12. UI: row actions siempre con `busyId` lock + try/catch.** `toggleActivo`, `handleDelete`, `patchSubscriber`, `patchTransaction` ahora todos guardan un `busyRow`/`busyTxId` que deshabilita los botones durante el request. Sin esto, doble-click genera dos requests concurrentes que pueden revertir el efecto del primero.

**13. UI: no `catch { /* silent */ }`.** `config`, `contenido`, `roles`, `concesiones` páginas tenían varios catches que tragaban errores. Ahora cada uno setea un `loadError`/`saveStatus` visible al usuario (con `role="alert"` o `role="status" aria-live="polite"`).

**14. Polling pages: `document.hidden` guard.** Cualquier `setInterval` que haga fetch debe revisar `document.hidden` y saltarse el tick. Sin esto, tabs en background generan egress gratis cada N segundos. Aplicado a `/admin/maria/clientes` (faltaba) y `/admin/maria/auditoria` (nuevo polling 15s).

**15. A11y mínimo no-negociable**: todas las `<table>` admin con `<th scope="col">`; chat thread con `role="log" aria-live="polite" aria-relevant="additions"`; icon-only buttons con `aria-label`; toggles de estado con `aria-pressed`; layout con skip-to-content link + `<main id="admin-main">` + `<aside aria-label>`.

**Pendientes deliberados (no shipped en PR #159):** verificación en Supabase Studio de si `mensajes_wa` y `clientes.tipo_minero` realmente existen (queries activas las referencian); migración de forms (`usuarios`, `profesionales`, `contenido`) a labels con `htmlFor`+`id` reales (work mecánico grande); pagination real en listas (clientes, minas, subscribers, transactions); reemplazo del grouping client-side en `/api/admin/maria/conversations` por un RPC con `GROUP BY HAVING MAX(created_at)`.

### Auditoría completa del codebase (PR #167 + #170, mergeadas 2026-05-27)

Auditoría multi-agente de 6 superficies paralelas (María webhook, María web widget, auth flow, services + broadcast, terrain map, pending-items inventory) sobre los archivos que PR #159 no había tocado. 25 commits temáticos en dos tandas (PR #167 = 12 Critical + 13 High + 4 Medium; PR #170 = 4 Medium de follow-up + docs), todos con `npx tsc --noEmit` y `npm run build` limpios. Cierra las 12 Critical, 15/17 High, y 8 Medium del reporte (H7 y H15 documentados como no-issues). **Las invariantes de PR #159 se mantienen y se extienden con las que siguen:**

**16. `requireRole(...)` en todas las rutas dashboard, no solo `/api/admin/*`.** PR #159 cerró `/api/whatsapp/send` y `/api/debug/prices`. Esta ronda cerró `/api/email/send`, `/api/expedientes`, `/api/expedientes/[id]`, `/api/expedientes/[id]/transition`, `/api/expedientes/[id]/next-actions`, `/api/documentos/[id]` — todas eran cookie-only via proxy. Cualquier handler que no llama `requireRole` confía en la presencia del cookie pero no en su firma JWT. Commits `384d361`, `2f7f855`.

**17. `auth.user.id` para audit trail, nunca `body.user_id`.** `POST /api/expedientes/[id]/transition` aceptaba `user_id` del body — un caller autenticado podía atribuir su cambio de fase a otra cuenta. `logAction` ahora se llama con el `user.id` del `requireRole` validado. Commit `2f7f855`.

**18. OAuth — cross-check del par access + refresh token.** `POST /api/auth/oauth-session` validaba el JWT del `access_token` pero confiaba ciegamente en cualquier `refresh_token` que el cliente enviara. Un atacante con un access token exfiltrado (XSS, log leak) podía emparejarlo con su propio refresh token y quedar cookie-set como la víctima. Fix: llamar `auth.refreshSession({ refresh_token })` y rechazar 401 si `session.user.id !== access.user.id`. Cookie-set los tokens que Supabase retorna del refresh (no las copias del cliente — Supabase puede rotarlos). Commit `5b9d20d`.

**19. Web widget — HMAC en cada turno de assistant.** `POST /api/maria/chat` aceptaba `role: 'assistant'` del cliente sin validar origen. Un visitante podía postear turnos falsos y hacer que Claude tratara la memoria fabricada como autoritativa (cotizaciones falsas, citas legales falsas, jailbreak del WhatsApp-redirect). Fix: server firma cada `reply` con `HMAC-SHA256(SIGNING_SECRET, content).slice(0,32)`; validator rechaza 400 BAD_SIG si un turno de assistant viene sin `sig` o con `sig` inválido (comparación timing-safe). Widget guarda `sig` junto al content en sessionStorage y lo retransmite; auto-recovery limpia historial en BAD_SIG. Secret default: `MARIA_WIDGET_SECRET` env var, fallback a `SUPABASE_SERVICE_ROLE_KEY`. Commit `0c6b4f6`.

**20. Web widget — Origin/Referer check.** `Content-Type: text/plain` es "simple request" — no preflight CORS. Sin chequeo, cualquier `evil.com` podía POSTear cross-site y quemar la quota Anthropic/OpenAI/Supabase bajo el IP de la víctima. `isAllowedOrigin` acepta only same-host o `NEXT_PUBLIC_SITE_URL`. Commit `294c151`.

**21. Rate limit — confiar headers solo en Vercel.** `lib/rateLimit.ts:clientIpFrom` confiaba en `x-real-ip` y caía a `x-forwarded-for` (forjable por el cliente). Off-Vercel cualquier header es forjable. Fix: gate trust on `process.env.VERCEL === '1'`; off-Vercel colapsa a `'unknown'` (un solo bucket — degradado pero no bypassable). `x-forwarded-for` removido del fallback en Vercel también (el edge no lo strippea — `x-vercel-forwarded-for` es lo autoritativo). Commits `f714059`, `38293b3` (sweep también pasó a lazy/opportunistic).

**22. Email canonicalization antes del rate-limit key.** `app/api/auth/login` usaba `email.toLowerCase()` sin trim. Variantes cosméticas (whitespace, mayúsculas, capitalización mixta) caían en buckets distintos → un atacante rotaba para subir el límite. Fix: `String(rawEmail).trim().toLowerCase()`. Gmail `+suffix` deliberadamente NO se strippea (demasiadas edge cases por proveedor). Commit `38293b3`.

**23. Rate-limit en `/api/auth/confirm-reset` y `/api/contacto`.** Recovery JWT (~1h) sin rate-limit era brute-force ilimitado para sobrescribir contraseñas; `/api/contacto` sin rate-limit permitía flood a `gerencia@mape.legal`. Ambos ahora 5/15min y 3/15min por IP respectivamente. Commits `38293b3`, `5b63cd3`.

**24. Timeout duro en fetches externos.** `services/pricingService.ts` (GoldAPI, Yahoo COMEX × 2, exchangerate-api) usaba `fetch()` sin `AbortSignal`. Yahoo cuelga >30s ocasionalmente — el broadcast de las 8 AM se quedaba colgado pasado el ceiling de 60s de Vercel y nadie notaba. Fix: `AbortSignal.timeout(8000)` en cada fetch (8s = `PRICE_FETCH_TIMEOUT_MS` del web widget). Commit `a1399b6`.

**25. Pricing — write-back de cache + paralelización.** El web widget fetcheaba live prices pero nunca escribía a `precios_diarios` → cada turno en cold-cache disparaba 3 upstreams. El webhook llamaba `fetchAllPrices()` y luego `fetchAndStorePrices()` (que internamente vuelve a fetchAllPrices) → 2× costo. Extracted `storePrices(precios)` y ambas routes ahora hacen un solo fetch + write-back. También `fetchAllPrices` paraleliza GoldAPI gold + silver + FX (antes serial) y atribuye `fuente` honestamente cuando varios upstreams contribuyen ("goldapi.io, yahoo-finance" si gold vino de Yahoo y silver de GoldAPI). Commits `cbd48e9`, `2807a39`.

**26. Broadcast — AbortController para cortar in-flight en auth-fail.** Cuando el `WHATSAPP_TOKEN` moría mid-broadcast, `Promise.all` seguía esperando los 9 sends restantes del batch antes de respetar el `authState.aborted`. 9 × 401 = quota gastada. Fix: `sendWhatsAppText(to, body, { signal })` opcional + `AbortController` único por run; primer `isAuthError` aborta el controller → siblings tiran `AbortError` que la catch branch nueva ignora (no cuenta como `errores++`). Commit `afa0d02`.

**27. `TROY_OUNCE_GRAMS = 31.1034768` como única constante.** Boletín diario, María WhatsApp y web widget usaban `31.1034768` vs `31.1035` (drift de 0.0008% pero comparable por el cliente). Constante exportada desde `services/pricingService.ts`; todos los call-sites importan. Commit `549d875`.

**28. `.maybeSingle()` para reads opcionales.** `.single()` emite `PGRST116` cuando no hay filas Y cualquier error de DB; el patrón `const { data } = await ...` descarta el error y trata todo como "no row found". Un timeout transitorio se volvía "user not found" → flow caía al INSERT y tropezaba con unique constraint. Aplicado a `configService.getConfig`, `userService.getOrCreateUserByPhone`, `broadcastService.getLastBroadcastLog`. Commit `d9f2c21`.

**29. María webhook — sanitización canónica para PostgREST `.or()`.** `expedientes` lookup interpolaba `cliente.id` raw + `safeNombre.replace(/[,()]/g, ' ')` que no escapaba ilike metachars (`% _ \`). Nombre como `100%` matcheaba todo. Fix: UUID validar `cliente.id`; usar `sanitizeIlikeTerm` (exportado de `services/concesionesService.ts` — mismo sanitizer canonical de PR #159) para `safeNombre`. Commit `220c2ff`.

**30. Dedup de turnos consecutivos same-role en historial.** El webhook filtraba sólo dupes de assistant. Si una turn previa fallaba antes de persistir su reply, la BD quedaba `[…, user, user]` → la próxima turn pushea un tercer user → Anthropic 400 → "tuvimos un problema técnico" en loop. Fix: mismo merge pattern del web widget (`chat/route.ts`) — collapse cualquier run consecutivo mergeando contents. Commit `220c2ff`.

**31. Onboarding — no escribir columnas que pueden no existir.** `clientes.tipo_minero` existe en migración 008 con default `'artesanal'` pero NO existe en la schema competidora de migración 021. El insert explícito tropezaba con "column not found" si 021 era la schema viva; el usuario quedaba en `usuarios_broadcast` como lead permanente sin row en `clientes`. Fix: drop del field explícito — el default de 008 sigue poblando; el caso sin columna ya no falla. Commit `220c2ff`.

**32. Webhook — gate de `expediente <id>` sub-command.** Cualquier número de WhatsApp que tecleaba `expediente <uuid>` recibía `select('*')` del row completo — cliente, notas, estado, IDs internos. CLAUDE.md lo describía como "abierto por diseño" pero el diseño asumía conocimiento admin del syntax. Fix: gate detrás de admin (passphrase O `usuarios_broadcast.rol = 'admin'`); whitelist de columnas defensivo; non-admin cae al flow normal de María. Commit `695cba3`.

**33. Webhook — pasphrase nunca en plaintext en `conversaciones_whatsapp`.** `TENKA-2026` se persistía en cada insert al historial → visible en el admin UI y indexado por el RAG. Fix: `safeIncoming = incomingMessage.replace(/\bTENKA-2026\b/, '[REDACTED]')` antes de cualquier insert. También: `isAdminCommand` ahora usa `\b`-bounded regex (no substring `.includes()`) — un cliente quoteando "tried 'willis yang TENKA-2026'..." ya no dispara el dashboard. Commit `b86f456`.

**34. Webhook — `needsContact` con guard de negación.** Substring match dispara Willis alert en "no te vamos a contactar hasta que confirmes". Fix: escanear 30 chars antes del match por `\b(no|nunca|tampoco)\s+\w*\s*$`. Commit `b86f456`.

**35. Terrain map — `off()` listeners antes de `remove()` + `dvh` en mobile.** `MiningMap3D.tsx` registraba `error`, `rotate`, `pitch` listeners con arrow inline y nunca los removía. `instance.remove()` dispose internal listeners pero el closure mantiene viva la parent component cuando MapLibre tiene queued events. Fix: handlers extraídos a consts; cleanup hace `off(...)` explícito antes de `remove()`. `SiteInfoSheet` tenía `onPointerCancel` en el Wrapper, no en el handle — system-cancel no liberaba el pointer capture → "scroll lock" en iOS. Fix: handler movido al handle (mismo elemento que hace `setPointerCapture`). Heights mobile migrados de `vh` a `dvh` (iOS Safari `100vh` incluye URL bar → sheet/mapa se cortaban). Commits `30b8ac2`, `6839079`.

**Skipped con rationale (no shipped):**
- **H7 (sessionStorage "shared across tabs")** — premisa errónea: `sessionStorage` es per-tab por spec. El único escenario realista (snapshot via "open in new tab" + device compartido) no tiene fix sin romper UX esperada (clear-on-close perdería chats en cada X-click).
- **H15 (SiteInfoSheet re-snap to peek mid-interaction)** — falso positivo: el effect depende de `[site?.id, open]` (primitivos derivados de prop estabilizada por `useMemo` en el parent). No re-dispara en re-renders no relacionados.

**Mediums resueltos en follow-up (segunda tanda, 2026-05-27):**
- **Web widget hardening** (`0902145`/`9aeeffa`): el guard `!anthropic` se movió al tope del handler (503 antes de gastar rate-limit slot, body parse, o los 3 context fetches Supabase/OpenAI cuando falta la key); catch del Anthropic call mapea 4xx→400 `BAD_REQUEST` (no reintentable) vs 5xx/network→502; focus trap real dentro del `role="dialog"` (Tab last→first, Shift+Tab first→last) + `aria-modal="true"`.
- **SendGrid retry** (`2170830`): `sendEmail()` ahora reintenta 429/5xx/network con backoff exponencial (400ms, 800ms) + `AbortSignal.timeout(8000)`; 4xx permanentes fallan inmediato. Antes un blip transitorio perdía el correo silenciosamente (contacto a gerencia, notificaciones de fase/pago).
- **Terrain cosmetics** (`49a992e`): último hex literal de `components/terrain/` (`SiteInfoSheet` boxShadow) tokenizado a `color-mix(... var(--ink) 12% ...)` — grep confirma cero hex en el dir; `CompassButton` atRest usa distancia angular mínima `((d+540)%360)-180` (wrap-safe).
- **Cross-channel RAG drift** (`949f4e6`): `RAG_MATCH_COUNT`, `RAG_MATCH_THRESHOLD`, `CONCESION_TRIGGERS`, el stopwords regex, y `formatKnowledgeRows` extraídos a `lib/maria/ragShared.ts` e importados desde webhook + web widget (eran copias byte-idénticas). `buildConcesionContext`/`retrieveKnowledge` siguen per-route (distinto Supabase handle + log prefix).

**Pendientes deliberados (cosmético / requiere decisión de contenido):** `mining-data` labels ES-only en EN view (departamentos son nombres propios — asimetría intencional per voz CLAUDE.md; municipios con sufijos descriptivos sí ameritan EN si se hace pase de contenido); `transformExpediente(row: any)` typing (interface anidada de 30+ campos, cero ganancia runtime); `MapLegend` `<style>` como JSX child (micro-perf "consider" — React no re-inyecta contenido idéntico); CONCESION_TRIGGERS tightening para skip RPC en intent no-lookup (cambio de comportamiento, requiere testing de regex en ambos canales). Documentados aquí para que próximas auditorías no los re-descubran.

### Remediación de auditoría externa — Tier B (PR #176, 2026-06-05)

Una auditoría externa calificó el codebase **B (6.4/10)** con 10 "fix immediately". Se verificó cada claim contra el código real (3 pasadas de exploración paralela): **8 reales, 2 incorrectos**. Se implementó el subconjunto Tier B (quick wins + seguridad/confiabilidad); DPI-encryption, Sentry y el índice HNSW del RAG quedan fuera de scope (Tier C / proyecto aparte).

**Implementado (5 commits):**
- **Hitos de pago 40/40/20** — `services/dashboardService.ts` hardcodeaba **30/40/30** (320K/480K/800K), desincronizado del canónico 40/40/20 (640K/640K/320K) de MARIA.md + `systemPrompt.ts`. Cada expediente nuevo nacía con el calendario equivocado. **Solo afecta expedientes nuevos** — filas existentes con el split viejo necesitan corrección de datos puntual.
- **`requireRole()` en `/api/mensajes`** (GET + PATCH) — antes confiaban solo en el check de cookies del proxy (no en la firma JWT). Extiende el invariante "auth obligatorio en cada handler" de PR #159/#167. También dejaron de filtrar `error.message` de Supabase. *(El claim #5 de la auditoría — "proxy.ts es dead code / no hay middleware.ts" — es **falso**: en Next.js 16 `proxy.ts` ES la convención del framework que reemplaza `middleware.ts`, con `config.matcher`, auto-invocado. El auditor aplicó conocimiento viejo de Next.js. El gap real era el `requireRole` faltante en mensajes.)*
- **RAG threshold 0.7 → 0.5** — ver §RAG semántico.
- **Firma de webhooks** — `lib/webhookSignatures.ts` (validadores HMAC timing-safe, sin dependencia nueva): Twilio `X-Twilio-Signature` (SHA1 sobre URL+params ordenados) en `/api/whatsapp`, Meta `X-Hub-Signature-256` (SHA256 sobre raw body) en `/api/webhook/whatsapp`. Rollout escalonado Twilio: `TWILIO_SIGNATURE_LOG_ONLY='true'` primero (loguea sin rechazar) → confirmar en Vercel logs que la URL reconstruida calza → quitar el flag para enforce 403. Meta: se omite (logueado) hasta setear `WHATSAPP_APP_SECRET`. También hizo no-fatal (`.catch`) el primer insert a `transacciones_pendientes` (antes un blip de Supabase reemplazaba la respuesta de María con "problema técnico").
- **Optimistic concurrency en `advancePhase()`** — ver §Motor de Workflow.
- **Aviso legal / alcance en el system prompt** — bloque `ALCANCE Y AVISO LEGAL` (disclaimer "no soy abogada") — ver §María.
- **CI gate** — `.github/workflows/ci.yml`: `npm ci` → lint (no-gating) → `tsc --noEmit` → `next build` en cada PR/push, + script `typecheck`. Es el gate que habría cazado la clase de prod-breaks de PR #100/#104/#125. Lint es `continue-on-error` porque el baseline tiene findings strict-mode pre-existentes documentados.

**Rechazado deliberadamente (claims incorrectos de la auditoría):**
- **#5 "proxy.ts dead code"** — falso (ver arriba).
- **#7 "Five incorrect article citations"** — no verificable / probablemente alucinado. Las citas en `lib/maria/systemPrompt.ts` son internamente consistentes contra el Acuerdo 042-2013; las correcciones específicas de la auditoría ("debería ser Art. 45 / Art. 13") no se pudieron confirmar. **Cambiar citas legales para calzar con una auditoría no verificada introduciría errores reales** — requiere revisión del equipo legal de MAPE LEGAL contra el texto oficial de La Gaceta, no un edit de código.

**Diferido (fuera de Tier B):** #6 cifrado de DPI + retención + consentimiento (proyecto de cumplimiento, requiere decisiones de producto/legal); Sentry; índice HNSW del RAG + alineación del prefijo `[category]` de embeddings (Tier C — requiere migración manual + re-embed).

**Verificación:** `npm run typecheck` → exit 0; `npm run build` → exit 0 (la salida imprime `ƒ Proxy (Middleware)`, confirmando que `proxy.ts` está vivo); lint sin findings nuevos en archivos tocados.

## WhatsApp Flows — evaluado y descartado como reemplazo de María; política IA de Meta 2026 (2026-06-03)

Evaluación (**solo análisis, sin cambios de código en esta sesión**) de dos preguntas: ¿puede **WhatsApp Flows** clonar a María y resolver el bloqueo de API? Conclusión doble **No**, más un hallazgo de cumplimiento que sí importa. Postura operativa de María en MARIA.md §13.

- **Flows NO puede clonar a María.** WhatsApp Flows es un *constructor de formularios/UI estructurada* (pantallas multi-step, selectores, botones) — determinístico, sin generación, sin memoria, sin RAG. María es un *agente generativo con estado*: Claude Haiku por turno, memoria de 40 mensajes, RAG híbrido (OpenAI embeddings + pgvector + FTS), ensamblado dinámico de contexto desde 7 tablas + RPCs + precios en vivo, máquina de estados de onboarding, comandos admin en lenguaje natural, y enforcement de secuencia de procesos. El "LLM component" reciente de Flows solo permite IA *task-specific dentro de un formulario* — un subconjunto, no un clon.
- **Flows NO resuelve el bloqueo de API — corre encima de él.** Flows se publica y envía por la **misma** WhatsApp Business Cloud API: requiere la **misma** verificación de negocio de Meta, está sujeto a los **mismos** límites de mensajería (250/24h sin verificar → 1,000 Tier-1), y choca con el **mismo error 131030** a destinatarios fuera de la lista de prueba. Con "sin acceso a API todavía", Flows está *más* restringido, no menos. La verificación es prerequisito de Flows, broadcasts y notificaciones por igual.
- **Política IA de Meta (vigente 15-ene-2026) — el hallazgo estratégico.** Meta prohíbe chatbots de IA de **propósito general / dominio abierto** ("simular asistentes amplios tipo ChatGPT") en la WhatsApp Business Platform. La IA **task-specific** (soporte, agendamiento, un asistente de dominio como el legal-minero) está **explícitamente permitida**. **María es task-specific por diseño → permitida**, con condiciones a endurecer antes de salir en vivo: declaración de alcance + rechazo/redirección fija de temas fuera de dominio (hoy guardrail suave del prompt vía derivación a `gerencia@mape.legal`); declaración del propósito en el setup de WABA; postura explícita de no-entrenamiento sobre datos de chat (Anthropic API no entrena por defecto); y trail de auditoría (hoy solo se loguean comandos admin, no los turnos normales). Detalle en MARIA.md §13.
- **Realidad de transporte hoy (raíz de la confusión):** inbound **texto** entra por **Twilio** (`app/api/whatsapp/route.js`, TwiML); inbound **media** por Meta (`app/api/webhook/whatsapp/route.ts`, descarta todo no-media en `:31-34`); **outbound** (broadcast, notificaciones, take-over) por Meta Cloud API (`services/whatsappService.ts`) — el lado capado por falta de verificación. La cadena outbound de código ya está completa; solo espera el token desbloqueado por la verificación (ver §"Sistema de Broadcast Diario" → Estado operativo).
- **Camino recomendado (NO implementado — análisis):** **(1) Endurecimiento de cumplimiento** (independiente de transporte, menor riesgo): bloque de alcance/aviso legal en `lib/maria/systemPrompt.ts` (**`ALCANCE Y AVISO LEGAL` añadido en PR #176** — disclaimer "no soy abogada / esto no sustituye asesoría legal formal" en la primera respuesta legal/regulatoria/de pagos, compartido por WhatsApp + web widget) + pre-filtro determinístico nuevo `lib/maria/scopeGuard.ts` (`OUT_OF_SCOPE_REPLY`, **pendiente**) + trail de auditoría de turnos normales (**pendiente**). **(2) Consolidación de transporte** (camino crítico = verificación operativa de Meta): extraer el cerebro de María del monolito Twilio a `lib/maria/pipeline.ts` (`runMariaTurn`, provider-agnóstico — también elimina la copia duplicada del canal web), luego hacer que el webhook Meta maneje texto (cuidando el fork de clave de historial `whatsapp:+504…` vs `+504…`) + verificación de firma de webhook (**cerrado en PR #176**: Twilio `X-Twilio-Signature` en `/api/whatsapp` y Meta `X-Hub-Signature-256` en `/api/webhook/whatsapp`, ambas vía `lib/webhookSignatures.ts` — ver §Remediación de auditoría externa). **(3) Flows opcional** como *complemento* de captura estructurada (onboarding/documentos/pago), reusando `onboardingService.finalise()` — el hogar más compatible con "IA en rol de apoyo", nunca el motor.

Para traer skills nuevos cuando upstream publica una versión: `/plugin marketplace update superpowers-dev` + `/reload-plugins`. El auto-update está **off** por default para marketplaces de terceros — los contribuidores no reciben cambios de upstream sin hacer el update explícito.

