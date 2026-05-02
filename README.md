# MAPE.LEGAL — Internal Development Reference

**Corporación Hondureña Tenka, S.A. (CHT)**
Administrador Único: Willis Yang
Dominio: www.mape.legal · Plataforma privada: Vercel + Supabase

---

## 1. Propósito

MAPE.LEGAL es el **motor de evidencia legal de origen mineral** de CHT para la minería artesanal y de pequeña minería en Honduras.

Genera, almacena y certifica evidencia legalmente defendible de que el oro proviene de operaciones formalizadas conforme a la **Ley de Minería, Reglamento MAPE, ILO 169, SLAS-2** y estándares internacionales (CRAFT / Fairmined / RJC / EUDR 2027).

---

## 2. Arquitectura Técnica

| Componente | Implementación |
|---|---|
| Framework | Next.js 16 — App Router, TypeScript, React 19 |
| Hosting | Vercel |
| Base de datos | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Estilos | Tailwind CSS v4 — `@theme inline` en globals.css |
| Autenticación | Supabase Auth + cookies httpOnly |
| Almacenamiento | Supabase Storage |
| Notificaciones | Supabase Realtime + WhatsApp Business API |
| Documentos | Plantillas HTML → PDF (Certificate of Origin automático) |

> **IMPORTANTE:** Tailwind v4 usa `@theme inline` — no usar `tailwind.config.js`.
> Ver `DESIGN.md` para todos los tokens de color y tipografía del sistema CHT.

---

## 3. Estructura del Proyecto

```
app/
  (landing)         → página pública www.mape.legal
  admin/
    login/          → login del panel de administración
    (protected)/    → panel de administración (requiere cookie admin-token)
      usuarios/     → gestión de cuentas de acceso
      profesionales/ → gestión de perfiles abogados/técnicos
  dashboard/        → dashboard operativo CHT (pendiente)
  api/
    admin/          → CRUD admin (service role Supabase)
    contacto/       → formulario de contacto landing
    ...

components/landing/ → 8 secciones de la landing pública
modules/
  types.ts          → tipos de dominio (español, espejo del DB)
  workflow.ts       → motor de transiciones de fase
  expedientes.ts    → lógica de avance de expediente
services/
  supabase.ts       → cliente anon (browser)
  adminSupabase.ts  → cliente service role (server-only)
supabase/migrations/ → migraciones SQL numeradas (001–007)
```

---

## 4. Esquema de Base de Datos

Migraciones aplicadas en orden:

| Migración | Contenido |
|---|---|
| 001 | Workflow por fases (fases, transiciones, expedientes) |
| 002 | Motor de workflow (registro de auditoría, pagos) |
| 003 | Nomenclatura española |
| 004 | Schema dashboard inicial |
| 005 | Schema admin: `perfiles_profesionales`, `user_roles` |
| 006 | Schema ER completo: `clientes`, `minas`, `asignaciones`, `plantillas_tareas`, `tareas`, `contratos`, `notificaciones`, `transacciones_oro` |
| 007 | Seed: 54 pasos del Manual Operativo 2026 + titulación + sociedad minera |

Objeto central: **expediente** (vinculado a un cliente y una mina).

---

## 5. Roles del Sistema

| Rol | Acceso |
|---|---|
| `admin` | Panel `/admin` completo + Dashboard completo |
| `abogado` | Dashboard operativo `/dashboard` |
| `tecnico_ambiental` | Dashboard operativo `/dashboard` |
| `cliente` | Vista de expediente (futuro) |

La función `is_cht_staff()` (SQL, SECURITY DEFINER) controla RLS en todas las tablas nuevas.

---

## 6. Autenticación

- **Panel Admin (`/admin`):** Cookie httpOnly `admin-token` (Supabase access_token). Middleware protege todas las rutas `/admin/*` excepto `/admin/login`. La verificación de rol `admin` ocurre en el endpoint de login.
- **Dashboard (`/dashboard`):** Cookie httpOnly `dashboard-session` — pendiente de implementación.
- **`/api/admin/*`:** Usa cliente service role (`SUPABASE_SERVICE_ROLE_KEY`) — nunca exponer al browser.

---

## 7. Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 8. Sistema de Diseño

Ver **`DESIGN.md`** — guía obligatoria de colores, tipografía y componentes.

Principios clave:
- Fuentes: Playfair Display (títulos) + Inter (UI/cuerpo)
- Colores: tokens CHT únicamente — no usar clases Tailwind genéricas (`gray-*`, `green-*`, `slate-*`)
- Background landing: `primary-50` / `earth-50`
- Background dashboard: `primary-900` / `primary-950`

---

## 9. Motor de Tareas (54 Pasos)

El proceso de formalización minera consta de **54 pasos** agrupados en 5 fases:

| Fase | Nombre | Pasos |
|---|---|---|
| 0 | Onboarding | 1–6 |
| 1 | INHGEOMIN | 7–19 |
| 2 | SERNA / MiAmbiente | 20–31 |
| 3 | Resolución Minera | 32–42 |
| 4 | Municipal + Comercializador | 43–54 |

Las plantillas viven en `plantillas_tareas` (migración 007). Al crear un expediente se instancian en `tareas` (una fila por paso por expediente).

Procesos adicionales: `titulacion` (8 pasos) y `sociedad_minera` (6 pasos).

---

## 10. Estado del Proyecto (02-may-2026)

**Completado:**
- [x] Sistema de diseño CHT (Tailwind v4, tokens completos)
- [x] Landing pública — 8 secciones, DESIGN.md compliant, sin precios ni datos confidenciales
- [x] Optimización de imágenes (`next/image`, avif/webp, LCP priority)
- [x] Panel admin: login + usuarios + perfiles profesionales
- [x] Migraciones 001–007: schema completo + 54 pasos del Manual Operativo
- [x] Tipos de dominio en TypeScript (`modules/types.ts`)
- [x] Middleware de autenticación (rutas `/admin/*` protegidas)
- [x] API routes admin: CRUD usuarios (service role), CRUD profesionales, auth login/logout

**Pendiente:**
- [ ] Dashboard operativo (`/dashboard`) — layout, login, expedientes, 54-step engine
- [ ] Índice de legalidad — cálculo en tiempo real
- [ ] Certificate of Origin — generación PDF
- [ ] WhatsApp Business API — notificaciones
- [ ] Variables de entorno en Vercel
- [ ] Aplicar migraciones en Supabase producción

---

## 11. Confidencialidad

Uso exclusivo interno de CHT y socios autorizados.
Prohibida la reproducción sin autorización escrita del Administrador Único.
