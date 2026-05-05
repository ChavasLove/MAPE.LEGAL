@AGENTS.md
@DESIGN.md

# Arquitectura y Convenciones — MAPE.LEGAL

## Framework
Next.js **16.2.4** con App Router y Turbopack. Esta versión tiene cambios importantes:
- `middleware.ts` está **obsoleto** — usar `proxy.ts` con export named `proxy` (no `middleware`)
- `params` en rutas dinámicas es `Promise<{id: string}>` — siempre `await params` antes de usar
- Leer `node_modules/next/dist/docs/` antes de escribir código relacionado con routing o server components

## Autenticación
- Login unificado: `POST /api/auth/login` → cookies httpOnly (`auth-token`, `auth-role`, `auth-refresh`, `user-email`)
- 4 roles: `admin`, `abogado`, `tecnico_ambiental`, `cliente`
- Redirección por rol: admin→`/admin`, abogado/tecnico→`/dashboard`, cliente→`/portal`
- Guard de rutas en `proxy.ts` — siempre mantener sincronia con nuevas rutas protegidas
- Cookie `admin-token` mantenida por compatibilidad con código heredado
- `/admin/login` redirige automáticamente a `/login` — no duplicar lógica de auth
- **Rate limit**: 5 intentos por (IP + email) cada 15 min en `/api/auth/login` y `/api/admin/auth/login` — `lib/rateLimit.ts` (in-memory, defensa adicional sobre Supabase). `/api/auth/resend-confirmation` usa el mismo limiter con 3 intentos por (IP + email) cada 15 min.
- **Refresh**: `POST /api/auth/refresh` rota `auth-token` (1h) usando `auth-refresh` (30d) y re-deriva `auth-role` consultando `user_roles` con service-role client (no confía en la cookie expirada). Cliente debe llamar antes de la expiración del access token.
- **`auth-role` cookie tiene maxAge 30d** (no 1h como el access token) — garantiza que el guard de `proxy.ts` siga teniendo rol disponible entre la expiración del access token y la siguiente llamada a `/refresh`. Se setea en `login` y se re-setea en cada `refresh`.
- **Confirmación de correo obligatoria**: el login (`app/api/auth/login/route.ts`) rechaza usuarios con `email_confirmed_at = null` retornando `403 { code: 'EMAIL_NOT_CONFIRMED' }`. La página de login renderiza un botón "Reenviar correo" que llama a `POST /api/auth/resend-confirmation` (genera link con `auth.admin.generateLink('signup')` y lo envía vía SendGrid usando `emailConfirmacionCorreo`).
- **Trigger de auto-rol**: migración `015_auto_user_roles_trigger.sql` instala `on_auth_user_created` sobre `auth.users` que inserta `user_roles(user_id, 'cliente', true)` automáticamente. Garantiza que ningún usuario quede sin rol, sin importar el origen (Supabase Studio, API admin, signup futuro). El trigger requiere `grant insert on user_roles to supabase_auth_admin` — sin ese grant la creación de usuarios falla con "Database error saving new user".
- **Flujo de invitación admin**: `POST /api/admin/usuarios` recibe `{ email, rol, perfil_id? }` (sin password). Llama `auth.admin.generateLink({ type: 'invite' })` para crear el usuario sin disparar el mailer interno de Supabase, luego envía la invitación con `emailInvitacionUsuario()` vía SendGrid. El invitado configura su propia contraseña en `/auth/establecer-password` (que usa el SDK de Supabase con `detectSessionInUrl: true` para leer el fragment de la URL post-redirect). Admins nunca ven ni transmiten contraseñas en claro.

### Configuración requerida en Supabase Studio (deploy manual)
- **Auth → URL Configuration → Redirect URLs**: agregar `${NEXT_PUBLIC_SITE_URL}/login?confirmed=1` y `${NEXT_PUBLIC_SITE_URL}/auth/establecer-password`. Sin esto los enlaces de confirmación e invitación rebotan silenciosamente con "redirect not allowed".
- **Auth → Email**: `Enable email confirmations = ON`, `mailer_autoconfirm = OFF`, `Mailer OTP expiry = 86400` (24h, máximo permitido).
- **Auth → SMTP**: dejar deshabilitado — los correos salen por SendGrid desde nuestro código, no desde el mailer interno de Supabase.

## Base de Datos
- Supabase (PostgreSQL). Dos clientes:
  - `services/supabase.ts` — cliente anónimo para lecturas públicas y portales de cliente
  - `services/adminSupabase.ts` — cliente service-role para escrituras admin y operaciones privilegiadas
- Migraciones en `supabase/migrations/` (001–015):
  - 006: `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones`
  - 007: `contactos` (formulario de landing)
  - 008: `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`, `conversaciones_whatsapp`, `transacciones_pendientes`
  - 009: Patch — columnas WhatsApp en `clientes` y `transacciones_pendientes`
  - 012: `documentos_referencia` — Manual Operativo 2026, consultado por María en tiempo real
  - 015: Trigger `on_auth_user_created` sobre `auth.users` que inserta `user_roles(user_id, 'cliente', true)` automáticamente + backfill de usuarios existentes
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
| `services/emailService.ts` | SendGrid REST API — `sendEmail()`, shell HTML de marca, plantillas: avance, rechazo, pago, contacto interno, acuse de contacto, confirmación de correo, invitación de usuario |
| `services/whatsappService.ts` | Meta Cloud API v21.0 — texto, templates, webhook parser |
| `services/cmsService.ts` | Lectura/escritura de `contenido_cms` — anon para leer, admin para escribir |
| `services/configService.ts` | Lectura/escritura de `configuracion_sistema` — solo admin client |
| `services/dashboardService.ts` | Datos de expedientes para el dashboard (`DashExpediente`, `DashHito`, `DashDoc`). `createDashExpediente()` genera `numero_expediente` desde `MAX(numero_expediente)` del año (no `COUNT(*)` — colisionaba tras deletes y bajo concurrencia) |

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
- `POST /api/auth/refresh` — renueva el `auth-token` usando el `auth-refresh` cookie; limpia cookies si el refresh expiró
- `GET /api/broadcast` — estado: último broadcast, suscriptores activos, precios más recientes
- `GET+POST /api/broadcast/run` — disparar broadcast diario (protegido por `CRON_SECRET` header, sin auth cookie). Vercel Cron envía `GET`; `POST` queda para invocación manual con body JSON
- `GET /api/broadcast/config` — configuración de métricas del reporte diario
- `PATCH /api/broadcast/config` — cambiar métrica: `{ metric, action, currency?, patch?, updated_by? }`
- `GET /api/broadcast/prices?days=7` — historial de precios; `?latest=true` para solo el más reciente

## Asistente Virtual María (`app/api/whatsapp/route.js`)
Webhook Twilio que conecta WhatsApp con Claude AI.

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
- **Prompt dinámico**: base + contexto de cliente + contexto de expediente + **manualContext** + (si conversación en curso) bloque `CONTEXTO CRÍTICO` que prohíbe re-saludos
- **Manual Operativo 2026**: cuando el mensaje menciona "paso N", "primer paso", "siguiente paso", "cómo empiezo", "manual operativo", "quién es responsable" o similares, `buildManualContext(message, supabase, recentHistory)` consulta `documentos_referencia` y añade un bloque `REFERENCIA MANUAL OPERATIVO` al system prompt. Detección regex, no LLM. `detectProceso()` mira el mensaje + últimos 6 turnos para elegir `formalizacion` / `titulacion` / `sociedad` y filtra el query por `proceso`; defaultea a `formalizacion` si no hay señal. "primer paso" sin número se traduce a `paso_numero=1` del proceso detectado. Falla silenciosa: si la tabla está vacía o la query falla, `manualContext = ''` y el flujo no se interrumpe.

- **Memoria de conversación**: el system prompt incluye un bloque `MEMORIA DE CONVERSACIÓN — REGLA INNEGOCIABLE` que prohíbe re-preguntar datos ya dichos en los últimos 6 turnos (servicio, nuevo-vs-en-trámite, etc.) y obliga a responder "primer paso" / "siguiente paso" con el paso concreto del servicio identificado en lugar de pedir aclaración.
- **Dedup**: filtra mensajes assistant consecutivos antes de enviar a Claude
- **Base de conocimiento legal**: Reglamento Minería Honduras (Acuerdo 042-2013) embebido en el system prompt — números clave, scripts de respuesta rápida, áreas excluidas, sanciones
- **Tablas Supabase**:
  - `conversaciones_whatsapp` — historial por `numero_whatsapp`, columnas `role`, `content`
  - `transacciones_pendientes` — registros pendientes (`estado`, `mensaje_original`, `respuesta_asistente`, `detalle`)
  - `clientes` — lookup por `telefono_whatsapp`; auto-registro desde conversación
  - `expedientes` — consultado para contexto de fase/hitos del cliente
- **Cotización por gramos (con decimales)**: regla en el system prompt bajo `CUANDO PREGUNTAN POR EL PRECIO DEL ORO` instruye a María a multiplicar `X gramos × precio_compra_CHT/gramo` cuando el cliente menciona un peso. Acepta `4.5`, `4,5` (coma decimal hondureña) y `medio gramo` (=0.5). Prohibido el fallback "tengo que consultar" si `PRECIOS DE REFERENCIA` ya tiene el precio por gramo.
- **Broadcast diario 8 AM**: sección `NOTIFICACIÓN DIARIA DE PRECIOS` en el system prompt documenta el formato canónico que envía el cron. Saludo fijo "Estimado Socio MAPE", sin emojis, sin comentarios de mercado, números con formato hondureño (`L 245,000.00`).
- **Trigger de transacción**: cuando la respuesta incluye `"Listo"` + `"Confirmas"` se inserta en `transacciones_pendientes`
- **Extracción estructurada**: segunda llamada a Haiku post-respuesta — parsea JSON de la conversación para registrar nombre/municipio/manzanas; strip de bloques markdown antes del parse; variable de error: `clientInsertError` (no `insertError`)
- **Columnas correctas en queries** (errores comunes a evitar):
  - `expedientes.tipo` (no `tipo_servicio`) · `expedientes.inicio` (no `fecha_inicio`)
  - `hitos` (no `hitos_pago`) · `hito.estado === 'cobrado'` (no `'confirmado'`)
  - `expedientes.cliente` es texto (no FK) — no hacer join a `clientes` desde `expedientes`

## Landing page

**Estado real (auditoría 2026-05-03):** la landing activa es `app/page.tsx` (≈523 líneas, autocontenido, usa clases definidas en `app/globals.css`). Los 15 archivos de `components/landing/*` (`Hero.tsx`, `About.tsx`, `Problem.tsx`, `Solution.tsx`, `Services.tsx`, `Impact.tsx`, `Beneficiarios.tsx`, `Footer.tsx`, `Contacto.tsx`, `News.tsx`, `Programs.tsx`, `Roadmap.tsx`, `ValorSection.tsx`, `WhyNow.tsx`, `PriceWidgets.tsx`) están **huérfanos** — `grep` confirma cero imports en todo el repo. Cualquier cambio de UI debe hacerse en `app/page.tsx`, no en los componentes huérfanos.

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
- Tailwind v4 con `@theme inline` en `globals.css` — **no usar** `tailwind.config.js`
- Colores siempre con `style={{ color: '...' }}` inline usando los tokens de DESIGN.md
- No usar clases genéricas de Tailwind (`green-*`, `gray-*`, `slate-*`) — solo los hex del sistema de diseño
- Fuentes: `font-sans` para Inter (UI). **Estado real:** Playfair Display **no** está cargada (ni en `app/layout.tsx` ni vía `@font-face` en `globals.css`). Los `<h1–h4>` caen al fallback `Georgia, serif`. Pendiente: cargar `Playfair_Display` desde `next/font/google` para cumplir DESIGN.md §2.

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
  - `services/pricingService.ts` — `fetchGoldPrice`, `fetchSilverPrice`, `fetchUSDHNL`, `fetchCopperPrice`, `fetchAndStorePrices`
  - `services/broadcastService.ts` — `generateDailyMessage` (template fijo), `sendDailyBroadcast`, `getLastBroadcastLog`
  - `services/configService.ts` — extendido con `getDailyReportConfig`, `enableMetric`, `disableMetric`, `updateMetricCurrency`, `updateMetricConfig`, `updateAudience`, `updateSchedule`
- **Cron en producción**: configurado en `vercel.json` — schedule `0 14 * * *` (14:00 UTC = 8:00 AM Honduras, UTC-6 todo el año) → `GET /api/broadcast/run` con `Authorization: Bearer <CRON_SECRET>`. Vercel Cron Jobs envían **GET** (no POST) e inyectan ese header automáticamente cuando `CRON_SECRET` está seteado en las env vars del proyecto. La ruta también acepta `POST` para invocación manual con body JSON (`roles`, `triggered_by`). Si `CRON_SECRET` no está seteado, el endpoint queda abierto (skip de auth).
- **Comando de prueba local**:
  ```bash
  curl -X POST http://localhost:3000/api/broadcast/run \
    -H "Authorization: Bearer <CRON_SECRET>" \
    -H "Content-Type: application/json" \
    -d '{"triggered_by":"test"}'
  ```

### Tolerancia a expiración del `WHATSAPP_TOKEN`
Los User access tokens de Meta caducan a 60 días; cuando ocurre, el broadcast de las 8 AM falla en silencio salvo por las trazas del cron. Para evitar esa clase de incidentes:
- **Pre-flight**: `sendDailyBroadcast()` llama `checkWhatsAppTokenHealth()` antes del fan-out. Si Meta responde 401 o `OAuthException` (códigos 102/190/463), aborta el envío, registra `broadcast_log.error_msg` con la causa + el hint de regeneración, y devuelve `aborted_reason: 'whatsapp_auth'`. **No** se itera la lista de suscriptores con un token muerto.
- **Mid-broadcast abort**: si el token cae a mitad del envío, el primer `WhatsAppApiError.isAuthError === true` interrumpe los lotes restantes. Sin esto un token caducado generaba N×401 en `broadcast_log`.
- **Errores tipados**: `services/whatsappService.ts` exporta `WhatsAppApiError { status, code, subcode, type, fbtraceId, isAuthError, rawBody }` y `WhatsAppTokenHealth`. Cualquier caller que necesite distinguir auth de transitorios debe `instanceof WhatsAppApiError && e.isAuthError`.
- **Diagnóstico**: `GET /api/admin/whatsapp/health` (admin-gated) hace una llamada `GET /{phone_id}?fields=display_phone_number,verified_name`. Es la primera comprobación cuando el reporte diario no llegó.
- **Migración**: `016_broadcast_log_error.sql` agrega `error_msg text` a `broadcast_log`. Hasta que se aplique en Supabase Studio, el insert con `error_msg: null` funciona, pero el campo poblado se guardará silenciosamente como descartado.
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

## Auditoría — deuda técnica conocida (2026-05-03)

Documentado para evitar trabajo duplicado en futuras sesiones. Ninguno está bloqueando producción.

### Landing
- `components/landing/*` — 15 archivos huérfanos (cero imports). Decidir: revivir o eliminar.
- `Hero.tsx:34` referencia `LOGO CHT.png` (no existe).
- `Problem.tsx:83` referencia `Map.png` (no existe).
- `Footer.tsx:3` — `border-t border-primary-900` sobre `bg-primary-950` queda invisible (`#1F2A44` vs `#162033`).

### `app/page.tsx` (landing activa)
- Línea ~192-193: hex hardcoded `#057a55` (Tailwind `emerald-700`) en lugar del token DESIGN.md `action-green` `#3E7C59`.
- Líneas 129, 133, 137, 150 (aprox.): `fontWeight: 800` inline — DESIGN.md §2 cap = 700.
- Línea 505 (aprox.): teléfono placeholder `+504 9XXX-XXXX` — CLAUDE.md prohíbe contacto personal en landing.
- Línea 34 (aprox.): nav-logo con `href="#"` — usar `/` o `#top`.
- Quote section (~464): mezcla comillas curvas `"` y rectas `"`.
- `Roadmap.tsx:75` y `Problem.tsx:99` linkean a `/dashboard.html` — DESIGN.md §13 prohíbe esa cross-link.

### `app/globals.css`
- Tokens `--green: #057a55`, `--amber: #92580a` (líneas 8-10) — paletas Tailwind `emerald`/`amber` prohibidas por DESIGN.md.
- `font-weight: 800` en líneas 59, 76, 129, 133, 137, 150, 203, 211 — exceden cap de 700.
- `box-shadow` en `.mockup-window` (109), `.float-notif` (131), `.float-notif2` (139), `.progress-card` (183) — exceden `shadow-sm` permitido (DESIGN.md §8).
- `animation: blink 1.4s` (línea 260) — animación continua prohibida por DESIGN.md §13.

### `app/layout.tsx`
- No carga Playfair Display — solo Inter. Headings caen a Georgia.
- No declara `metadataBase`, `openGraph`, `twitter`. Solo `title` + `description`.

### Componentes huérfanos (si se reviven)
- `components/landing/PriceWidgets.tsx:33` — `${sign}<0.01%` produce `-<0.01%` (signo mal posicionado).
- `components/landing/Roadmap.tsx:72` — `animate-pulse` viola DESIGN.md §13.
- `components/landing/WhyNow.tsx:3,8,13,18` — emojis (🌍 ⚖️ 🏭 📊) violan tono de marca.
- `components/landing/ValorSection.tsx:99` — hex `#1A1018` no documentado en DESIGN.md.
