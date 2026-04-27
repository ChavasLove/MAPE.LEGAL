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

## Base de Datos
- Supabase (PostgreSQL). Dos clientes:
  - `services/supabase.ts` — cliente anónimo para lecturas públicas y portales de cliente
  - `services/adminSupabase.ts` — cliente service-role para escrituras admin y operaciones privilegiadas
- Migraciones en `supabase/migrations/` (001–006). La 006 incluye tablas: `roles`, `contenido_cms`, `configuracion_sistema`, `notificaciones`

## Servicios
| Archivo | Propósito |
|---|---|
| `services/emailService.ts` | SendGrid REST API — `sendEmail()`, plantillas para avances y pagos |
| `services/whatsappService.ts` | Meta Cloud API v21.0 — texto, templates, webhook parser |
| `services/cmsService.ts` | Lectura/escritura de `contenido_cms` — anon para leer, admin para escribir |
| `services/configService.ts` | Lectura/escritura de `configuracion_sistema` — solo admin client |
| `services/dashboardService.ts` | Datos de expedientes para el dashboard (`DashExpediente`, `DashHito`, `DashDoc`) |

## Tipos importantes
- `DashExpediente.abogado` → `{ nombre: string; initials: string }` (inglés, no `iniciales`)
- `DashExpediente.psa` → `{ nombre: string; initials: string }`

## Rutas API principales
- `GET/POST /api/expedientes` — lista y creación
- `GET /api/expedientes/[id]` — detalle
- `POST /api/expedientes/[id]/transition` — avanzar fase
- `PATCH /api/documentos/[id]` — verificar/rechazar documento
- `POST /api/email/send` — enviar email vía SendGrid
- `POST /api/whatsapp/send` — enviar mensaje WhatsApp
- `GET+POST /api/webhook/whatsapp` — webhook Meta (verificación + mensajes entrantes)
- `GET+POST+DELETE /api/admin/cms` — editor CMS
- `GET+PATCH /api/admin/config` — configuración del sistema
- `GET+POST /api/admin/roles` + `PATCH+DELETE /api/admin/roles/[id]` — gestión de roles

## Estilo / UI
- Tailwind v4 con `@theme inline` en `globals.css` — **no usar** `tailwind.config.js`
- Colores siempre con `style={{ color: '...' }}` inline usando los tokens de DESIGN.md
- No usar clases genéricas de Tailwind (`green-*`, `gray-*`, `slate-*`) — solo los hex del sistema de diseño
- Fuentes: `font-sans` para Inter (UI), headings usan Playfair Display automáticamente vía `globals.css`

## Variables de Entorno Requeridas (Producción)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
WHATSAPP_TOKEN
WHATSAPP_PHONE_ID
WHATSAPP_VERIFY_TOKEN
```
