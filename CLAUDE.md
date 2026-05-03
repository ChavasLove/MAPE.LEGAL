@AGENTS.md
@DESIGN.md

# Arquitectura y Convenciones — MAPE.LEGAL

## Framework
Next.js **16.2.4** con App Router y Turbopack. Esta versión tiene cambios importantes:
- `middleware.ts` está **obsoleto** — usar `proxy.ts` con export named `proxy` (no `middleware`)
- `params` en rutas dinámicas es `Promise<{id: string}>` — siempre `await params` antes de usar
- Leer `node_modules/next/dist/docs/` antes de escribir código relacionado con routing o server components

## Autenticación
- Login unificado: `POST /api/auth/login` → cookies httpOnly (`auth-token`, `auth-role`, `user-email`)
- 4 roles: `admin`, `abogado`, `tecnico_ambiental`, `cliente`
- Redirección por rol: admin→`/admin`, abogado/tecnico→`/dashboard`, cliente→`/portal`
- Guard de rutas en `proxy.ts` — siempre mantener sincronia con nuevas rutas protegidas
- Cookie `admin-token` mantenida por compatibilidad con código heredado
- `/admin/login` redirige automáticamente a `/login` — no duplicar lógica de auth

## Base de Datos
- Supabase (PostgreSQL). Dos clientes:
  - `services/supabase.ts` — cliente anónimo para lecturas públicas y portales de cliente
  - `services/adminSupabase.ts` — cliente service-role para escrituras admin y operaciones privilegiadas
- Migraciones en `supabase/migrations/` (001–009):
  - 006: `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones`
  - 007: `contactos` (formulario de landing)
  - 008: `clientes`, `minas`, `contratos`, `indice_legalidad`, `transacciones_oro`, `conversaciones_whatsapp`, `transacciones_pendientes`
  - 009: Patch — columnas WhatsApp en `clientes` y `transacciones_pendientes`
- Tablas del motor de workflow: `fases`, `transiciones_fase`, `expediente_fases`, `pagos`, `documentos`, `registro_auditoria`
- Tabla `clientes` (piloto core) — columnas clave: `telefono_whatsapp`, `situacion_tierra`, `tipo_mineral`, `fecha_registro`, `nombre`, `municipio`
- **`expedientes` NO tiene FK a `clientes`** — el campo `cliente` es texto libre. Usar `contratos` para la relación correcta.

## Motor de Workflow (`modules/`)
- `modules/types.ts` — tipos de dominio: `Fase`, `TransicionFase`, `NextActionsResult` (incluye `is_final: boolean`)
- `modules/workflow.ts` — `getNextActions()`, `getBlockingReasons()`, `getAvailableTransitions()`
  - Chequeo real de documentos contra tabla `documentos` (estado `verificado`)
  - `is_final: true` cuando no hay transiciones salientes — distingue proceso completado de bloqueado
- `modules/expedientes.ts` — `advancePhase()`, `validatePaymentForPhase()`, `logAction()`
  - Requiere `transition_id` explícito si hay múltiples transiciones disponibles (evita pick silencioso)
  - Revierte `expedientes.fase_actual_id` si falla el insert en `expediente_fases`

## Servicios
| Archivo | Propósito |
|---|---|
| `services/emailService.ts` | SendGrid REST API — `sendEmail()`, shell HTML de marca, plantillas: avance, rechazo, pago, contacto interno, acuse de contacto, bienvenida de usuario |
| `services/whatsappService.ts` | Meta Cloud API v21.0 — texto, templates, webhook parser |
| `services/cmsService.ts` | Lectura/escritura de `contenido_cms` — anon para leer, admin para escribir |
| `services/configService.ts` | Lectura/escritura de `configuracion_sistema` — solo admin client |
| `services/dashboardService.ts` | Datos de expedientes para el dashboard (`DashExpediente`, `DashHito`, `DashDoc`) |

### Plantillas de email disponibles
| Función | Destinatario | Evento |
|---|---|---|
| `emailExpedienteAvance` | cliente | Fase avanzada |
| `emailDocumentoRechazado` | cliente | Documento rechazado |
| `emailHitoPago` | cliente | Hito de pago generado |
| `emailContactoInterno` | `gerencia@mape.legal` | Formulario de contacto recibido |
| `emailContactoAcuse` | visitante del sitio | Confirmación de recepción |
| `emailBienvenidaUsuario` | nuevo usuario | Cuenta creada con credenciales y link de login |

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
- `GET+POST /api/admin/usuarios` — lista y creación de usuarios (POST envía welcome email automáticamente)
- `GET /api/admin/clientes` — lista todos los clientes registrados por WhatsApp con sus expedientes vinculados vía `cliente_id` FK (admin client, protegido por proxy)
- `GET /api/broadcast` — estado: último broadcast, suscriptores activos, precios más recientes
- `POST /api/broadcast/run` — disparar broadcast diario (protegido por `CRON_SECRET` header, sin auth cookie)
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
- **Historial**: últimos 20 mensajes de `conversaciones_whatsapp` por número de WhatsApp
- **Lookup de cliente**: busca en tabla `clientes` por `telefono_whatsapp` (strip de `whatsapp:` prefix) — si existe, inyecta nombre/municipio/tierra en el prompt; si no, instruye registro natural
- **Contexto de expediente**: tras el lookup de cliente, consulta `expedientes` por `cliente_id = cliente.id` (fallback: `cliente ILIKE nombre`). Inyecta en el prompt: `numero_expediente`, fase actual, paso actual, estado, cierre estimado, hitos pendientes. Si no hay expediente: instruye a María a explicar Fase 0 e Hito 1. Helper: `buildExpedienteContext(exps)` en `route.js`.
- **Prompt dinámico**: base + contexto de cliente + contexto de expediente + (si conversación en curso) bloque `CONTEXTO CRÍTICO` que prohíbe re-saludos
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

## Landing page — imágenes
Todas las imágenes están en `public/images/`. Distribución actual:
| Imagen | Componente |
|---|---|
| `RIVER AND MOUNTAINS.png` | Hero (fondo) + og:image |
| `MAPE LEGAL LOGO 1.JPG` | Hero (nav), Login, Admin, Dashboard, Portal |
| `Servicios Legales.png` | About |
| `Tophographic map.png` | Problem |
| `Services Tophography .png` | Solution |
| `Technitians Field Work.png` | Services |
| `Artisanal Miner Image 01 .JPG` | Impact |
| `Estudio de Impacto Ambiental.png` | Beneficiarios |

## SEO / Open Graph
Configurado en `app/layout.tsx`:
- `metadataBase` usa `NEXT_PUBLIC_SITE_URL` (fallback: `https://mape.legal`)
- `openGraph`: type website, locale `es_HN`, siteName, og:image apuntando a `RIVER AND MOUNTAINS.png`
- `twitter`: card `summary_large_image`
- La página principal (`app/page.tsx`) sobreescribe `openGraph` con título y descripción específicos

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
- Fuentes: `font-sans` para Inter (UI), headings usan Playfair Display automáticamente vía `globals.css`

## Landing page — responsividad móvil
Todos los componentes en `components/landing/` están optimizados para móvil. Convenciones establecidas:

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
CRON_SECRET                    # Header Bearer para proteger POST /api/broadcast/run desde cron externo
```

## Sistema de Broadcast Diario (`jobs/`, `services/broadcastService.ts`)

- **Tablas**: `usuarios_broadcast`, `daily_report_config`, `precios_diarios`, `broadcast_log`
- **Roles broadcast**: `minero` (default), `comprador`, `tecnico`, `admin`
- **Flujo**: cron → `POST /api/broadcast/run` → `runDailyBroadcast()` → fetch precios → store → `generateDailyMessage()` (template fijo) → `sendDailyBroadcast()` → Meta Cloud API → log
- **Formato de reporte**: template determinístico "Estimado Socio MAPE" — LBMA USD/oz, conversión a LPS, TC, precio de compra al 80% LBMA, fecha+hora Honduras (UTC-6), enlaces a goldapi.io y www.mape.legal. **No llama a Claude** — garantiza consistencia y evita alucinaciones de precio. Fallback automático cuando `precios.oro` es null/0.
- **Servicios**:
  - `services/userService.ts` — `getOrCreateUserByPhone`, `assignRole`, `getActiveSubscribers`, `listUsers`
  - `services/pricingService.ts` — `fetchGoldPrice`, `fetchSilverPrice`, `fetchUSDHNL`, `fetchCopperPrice`, `fetchAndStorePrices`
  - `services/broadcastService.ts` — `generateDailyMessage` (template fijo), `sendDailyBroadcast`, `getLastBroadcastLog`
  - `services/configService.ts` — extendido con `getDailyReportConfig`, `enableMetric`, `disableMetric`, `updateMetricCurrency`, `updateMetricConfig`, `updateAudience`, `updateSchedule`
- **Cron en producción**: configurado en `vercel.json` — schedule `0 14 * * *` (14:00 UTC = 8:00 AM Honduras, UTC-6 todo el año) → `POST /api/broadcast/run` con `Authorization: Bearer <CRON_SECRET>`. Si `CRON_SECRET` no está seteado, el endpoint queda abierto (skip de auth).
- **Comando de prueba local**:
  ```bash
  curl -X POST http://localhost:3000/api/broadcast/run \
    -H "Authorization: Bearer <CRON_SECRET>" \
    -H "Content-Type: application/json" \
    -d '{"triggered_by":"test"}'
  ```

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
