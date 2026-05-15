# MAPE.LEGAL — Plataforma de Formalización Minera

**Versión 1.1 — Piloto Iriona 2026**
Última actualización: 9 de mayo de 2026
Propietario: Corporación Hondureña Tenka, S.A. (CHT)
Administrador Único: Willis Yang
Dominio: mape.legal · App privada en Vercel + Supabase

---

## 0. BRAND IDENTITY · COLOR MANUAL v1.0

> **Hard rule:** El color manual de abajo es la **única fuente de verdad** para color y tipografía en MAPE LEGAL. *No invented hex outside this manual* — si un color que necesitas no está aquí, no existe; abre PR para agregarlo.
>
> **Future work** (frontend, backend, emails, dashboard, landing, broadcast templates, asistente María) **debe alinearse a esta identidad**. Cualquier hex hardcodeado fuera de `app/globals.css` es deuda técnica y debe reemplazarse por el token correspondiente.

### Principio de marca
*"Tinta, piedra, musgo."* — autoridad natural, no naturaleza decorativa.

**Eje:** Legal (precisión) · Institucional (credibilidad) · Natural (territorio) · Técnico (rigor de proceso).

### 0.1 Tokens de color

#### Primaria — tinta + grises
| Token | Hex | Rol | Uso |
|---|---|---|---|
| `--ink` | `#1F2A38` | CTA · headings · footer | Color ancla del sistema. Texto principal sobre claros, fondo sobre oscuros, default de botón primario |
| `--ink-2` | `#3B4A5C` | Hover de ink | Estado hover de superficies/botones que parten de `--ink`. No usar como texto base |
| `--slate` | `#5E6B7B` | Nav secundaria · captions | Meta, breadcrumbs, leyendas, eyebrow |
| `--slate-lt` | `#A3A8AB` | Disabled · hairlines on dark | Estado deshabilitado, hairlines sobre footer/hero |
| `--plum` | `#5F5F77` | Acento raro | Avatares default, tags neutrales en panel admin. Casi nunca |

#### Naturaleza — territorio
| Token | Hex | Rol | Uso |
|---|---|---|---|
| `--moss` | `#2F5D50` | CTA secundaria · titles | Botón WhatsApp, italic em de H1, focus rings, link hover |
| `--moss-2` | `#587E5E` | Live dot · activo | Dot pulsante de notificación, estados activos en steppers |
| `--earth` | `#8B6A4A` | Numerales · ornamentos | Numerales grandes en stats strip, separadores cortos del eyebrow |
| `--sand` | `#D8C3A5` | Hero accent · italic em | Único cálido permitido en hero/footer. Itálico de H1, líneas topográficas |
| `--concrete` | `#F0EDE5` | Block quote · callout | Fondo de citas, callouts. Más cálido que `--bg-soft` |

#### Funcionales — sólo estado, nunca decoración
| Token | Hex | Rol | Uso |
|---|---|---|---|
| `--green` | `#2A8E50` | OK · verified | Documento verificado, step COMPLETED, hito pagado, ACH confirmado |
| `--amber` | `#C58B2C` | In review · due soon | Step IN_REVIEW, alerta WARN, deadline a 2-5 días |
| `--red` | `#B23A3A` | Block · overdue | Step REJECTED/BLOCKED, oposición Art. 66, deadline vencido |
| `--blue` | `#2A6BA8` | Info · new | Documento nuevo en bandeja WA, mensaje informativo, tag "actualizado" |

> Verde / ámbar / rojo / azul son **señales de estado**. Nada de "tarjetas verdes porque se ven frescas" ni "borde rojo porque resalta".

#### Neutros — papel y bordes
| Token | Hex | Rol | Uso |
|---|---|---|---|
| `--bg` | `#FFFFFF` | Surface · cards · modal | Cards, modals, inputs. **Nunca** fondo de página en producto |
| `--bg-soft` | `#FAF9F5` | Page background · paper | Lienzo principal de la app y landing. El "papel" de MAPE LEGAL |
| `--t1` | `#1F2A38` | Body strong · headings | Texto principal, alias de `--ink` |
| `--t2` | `#4B5563` | Body default | Color por defecto de párrafos sobre `--bg-soft` |
| `--t3` | `#8E96A2` | Caption · helper | Texto auxiliar: helpers de input, timestamps |
| `--border` | `#E2E0D8` | Hairline default | Bordes 1px de cards, separadores. Default total |
| `--border-2` | `#C9C5B9` | Stronger hairline | Cards de feature destacada y elementos enfatizados |

### 0.2 Tipografía

| Rol | Familia | Variable CSS | Pesos |
|---|---|---|---|
| Display / Títulos | **Playfair Display** | `--font-display` | 500 / **600** / 700 |
| UI / Cuerpo | **Inter** | `--font-body` | 400 / 500 / 600 / 700 |
| Mono / Numerales / Eyebrow | **JetBrains Mono** | `--font-mono` | 400 / 500 |

Cargadas en `app/layout.tsx` vía `next/font/google`. **Peso máximo: 700.**

### 0.3 Pares texto/fondo aprobados (WCAG)

| FG | BG | Uso |
|---|---|---|
| `--ink` on `--bg-soft` | AAA — Default body / heading |
| `--t2` on `--bg-soft` | AAA — Default body copy |
| `--slate` on `--bg-soft` | AA — Captions, meta |
| `--moss` on `--bg-soft` | AAA — Section title em / link |
| `--earth` on `--bg-soft` | AA (large) — Stat numerals |
| `--bg` on `--ink` | AAA — Hero copy / footer body |
| `--sand` on `--ink` | AAA — Hero italic / topo accent |
| `--green` on `--bg-soft` | AA — OK pill text |
| `--red` on `--bg-soft` | AA — Block / overdue text |
| `--blue` on `--bg-soft` | AA — Info text |
| `--amber` on `--bg-soft` | LG — Warn pill text (large only) |

Para tonos derivados usa **`color-mix(in oklch, var(--ink) 80%, white)`** — nunca inventes hex.

### 0.4 Reglas

#### Sí
- `color-mix(in oklch, …)` para hover, fondos translúcidos, pill backgrounds.
- Body `--t2` sobre `--bg-soft`. Headings `--ink`. Captions `--t3` o `--slate`.
- Hairlines `--border` (1px). `--border-2` solo en feature cards.
- `--sand` solamente sobre `--ink` (hero italic, líneas topográficas).

#### No
- Funcionales como decoración (verde/ámbar/rojo/azul son **estado**).
- Gradientes (excepto overlay radial del hero).
- `#FFFFFF` como fondo de página (usa `--bg-soft`).
- Opacidad >0.10 en líneas topográficas claras.
- `font-weight: 800` o `900` (cap = 700).
- `rounded-full` en botones, `rounded-2xl` en cards.
- `shadow-xl` / `shadow-2xl` (solo en modales).
- Animaciones continuas en UI de producción.

### 0.5 Implementación — drop-ins

#### `app/globals.css` (canonical)
```css
:root {
  /* Primaria */
  --ink:        #1F2A38;
  --ink-2:      #3B4A5C;
  --slate:      #5E6B7B;
  --slate-lt:   #A3A8AB;
  --plum:       #5F5F77;
  /* Naturaleza */
  --moss:       #2F5D50;
  --moss-2:     #587E5E;
  --earth:      #8B6A4A;
  --sand:       #D8C3A5;
  --concrete:   #F0EDE5;
  /* Funcionales */
  --green:      #2A8E50;
  --amber:      #C58B2C;
  --red:        #B23A3A;
  --blue:       #2A6BA8;
  /* Neutros */
  --bg:         #FFFFFF;
  --bg-soft:    #FAF9F5;
  --t1:         #1F2A38;
  --t2:         #4B5563;
  --t3:         #8E96A2;
  --border:     #E2E0D8;
  --border-2:   #C9C5B9;
}

.btn-primary:hover {
  background: color-mix(in oklch, var(--ink) 88%, white);
}
```

#### Style Dictionary JSON (para herramientas de design tokens)
```json
{
  "color": {
    "ink":      { "value": "#1F2A38", "type": "color" },
    "ink-2":    { "value": "#3B4A5C", "type": "color" },
    "slate":    { "value": "#5E6B7B", "type": "color" },
    "slate-lt": { "value": "#A3A8AB", "type": "color" },
    "moss":     { "value": "#2F5D50", "type": "color" },
    "moss-2":   { "value": "#587E5E", "type": "color" },
    "earth":    { "value": "#8B6A4A", "type": "color" },
    "sand":     { "value": "#D8C3A5", "type": "color" },
    "concrete": { "value": "#F0EDE5", "type": "color" },
    "green":    { "value": "#2A8E50", "type": "color" },
    "amber":    { "value": "#C58B2C", "type": "color" },
    "red":      { "value": "#B23A3A", "type": "color" },
    "blue":     { "value": "#2A6BA8", "type": "color" },
    "bg":       { "value": "#FFFFFF", "type": "color" },
    "bg-soft":  { "value": "#FAF9F5", "type": "color" },
    "t1":       { "value": "#1F2A38", "type": "color" },
    "t2":       { "value": "#4B5563", "type": "color" },
    "t3":       { "value": "#8E96A2", "type": "color" },
    "border":   { "value": "#E2E0D8", "type": "color" },
    "border-2": { "value": "#C9C5B9", "type": "color" }
  }
}
```

> **Nota:** este proyecto usa Tailwind v4 con `@theme inline` en `globals.css` — **no** `tailwind.config.js`. Si introduces Tailwind config-based en otro repo (mobile, packaging), usa los mismos hex aliasados como `ink`, `moss`, `state.{ok,warn,block,info}`.

### 0.6 Documentos relacionados

- [`DESIGN.md`](./DESIGN.md) — guía completa de componentes UI, escala tipográfica, reglas de uso.
- [`app/globals.css`](./app/globals.css) — implementación canónica de los tokens.
- [`components/decor/TopoBand.tsx`](./components/decor/TopoBand.tsx) — motivo topográfico.

---

## 1. VISIÓN Y PROPÓSITO

MAPE.LEGAL es la plataforma digital interna de CHT que actúa como **motor de evidencia legal de origen mineral** para minería artesanal y de pequeña escala en Honduras.

Su propósito es generar, almacenar y certificar evidencia legalmente defendible de que el oro proviene de operaciones formalizadas conforme a la **Ley de Minería, Reglamento MAPE (Acuerdo 042-2013), ILO 169, SLAS-2** y estándares internacionales (CRAFT / Fairmined / RJC).

> "La plataforma que convierte minería informal en oro traceable, certificado y premium para Chiopa Industrias y mercados éticos internacionales."

---

## 2. CONTEXTO DE NEGOCIO

- **CHT** = Corporación Hondureña Tenka, S.A.
- **Fundador:** Willis Yang (Administrador Único)
- **Socio 50%:** Ricardo Alfredo Montes Nájera

**Modelo de ingresos:**
1. Servicios de formalización — paquete ancla L 1.600.000 + titulaciones + contratos de sociedad minera
2. Margen de comercialización de oro — compra a mineros 80% LBMA → venta a Chiopa Industrias 85% LBMA

**Piloto 2026:** Asociación de Mineros de Iriona, Colón (~60 mineros)

**Catálogo de servicios:**
| Servicio | Precio | Pagos |
|---|---|---|
| Formalización Minera MAPE | L 1.600.000 | 3 hitos: 20% / 30% / 50% |
| Titulación de Propiedad | L 60.000 base + L 25.000/manzana adicional | Único |
| Contrato de Sociedad Minera | L 55.000 (co-pago 50/50) | Único |

---

## 3. ARQUITECTURA TÉCNICA

| Componente | Decisión |
|---|---|
| Hosting | Vercel |
| Base de datos | Supabase (PostgreSQL + Auth + Storage) |
| Framework | Next.js 16.2.4 (App Router, Turbopack) |
| Frontend | React 19 + Tailwind v4 (`@theme inline`) |
| Autenticación | httpOnly cookies (`auth-token`, `auth-role`, `user-email`) — 4 roles |
| Guard de rutas | `proxy.ts` (Next.js 16 — reemplaza `middleware.ts`) |
| Email | SendGrid REST API |
| WhatsApp | Meta Cloud API v21.0 (webhook) + Twilio (María bot) |
| IA | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) — asistente María |

---

## 4. ESQUEMA DE BASE DE DATOS (23 migraciones)

| Migración | Contenido |
|---|---|
| 001 | Workflow por fases, pagos, auditoría |
| 002 | Grafo de transiciones explícito, historial de fases |
| 003 | Renombrado al español (fases, pagos, registro_auditoria…) |
| 004 | Dashboard: hitos, documentos, mensajes_wa, legalidad_items, progress_fases |
| 005 | Admin: perfiles_profesionales, user_roles |
| 006 | Roles dinámicos, CMS (contenido_cms), configuracion_sistema, notificaciones |
| 007 | Contactos del formulario de landing |
| 008 | Piloto core: clientes, minas, contratos, indice_legalidad, transacciones_oro, conversaciones_whatsapp, transacciones_pendientes |
| 009 | Patch: columnas WhatsApp en clientes (telefono_whatsapp, situacion_tierra, tipo_mineral, fecha_registro) y transacciones_pendientes (mensaje_original, respuesta_asistente) |
| 010 | Admin commands + onboarding states (`admin_actions`, `onboarding_states`) |
| 012 | `documentos_referencia` — Manual Operativo 2026 |
| 013 | `precios_diarios.fetched_at` + vista `precios_frescura` |
| 014 | `proceso` en `documentos_referencia` + seed titulación/sociedad |
| 015 | Trigger `on_auth_user_created` + función `handle_new_auth_user` |
| 016 | `broadcast_log.error_msg` + `broadcast_log.aborted_reason` |
| 017 | Drop policy recursiva `"Admins manage user_roles"` |
| 018 | INSERT policy default-cliente (reemplazada por 019) |
| 019 | RPC `get_user_role_for_login` (SECURITY DEFINER) + policy self-only |
| 020 | `certificados_origen` + vista pública `certificados_origen_publicos` |
| 021 | Esquema ER de tareas (refactor) |
| 022 | Plantilla de 54 pasos de expediente |
| **023** | **`concesiones_mineras_registro` + vista pública + RPCs SECURITY DEFINER (`search_concesion_minera`, `concesiones_minera_stats`). 587 filas transcritas del registro INHGEOMIN (3 PDFs).** |

**Tablas principales:**

| Tabla | Descripción |
|---|---|
| `expedientes` | Expediente legal EXP-2026-XXX con progreso por fases |
| `fases` / `transiciones_fase` | Grafo del workflow operativo |
| `expediente_fases` | Historial de fases por expediente |
| `pagos` | Pagos validados por fase |
| `hitos` | Hitos de cobro (3 por expediente) |
| `documentos` | Documentos requeridos por expediente |
| `mensajes_wa` | Feed de documentos enviados por WhatsApp |
| `legalidad_items` | Snapshot de 5 componentes de legalidad por expediente |
| `clientes` | Entidad minero/cliente, vinculable a auth.users |
| `minas` | Sitio minero con coordenadas UTM, área, tipo |
| `contratos` | Contrato CHT ↔ cliente por expediente |
| `indice_legalidad` | Índice de legalidad por mina (5 componentes, 0–100 pts) |
| `transacciones_oro` | Ventas de oro con tasa BCH; totals generados automáticamente |
| `conversaciones_whatsapp` | Historial del bot María por número |
| `transacciones_pendientes` | Confirmaciones pendientes del bot |
| `perfiles_profesionales` | Abogados y técnicos ambientales CHT |
| `concesiones_mineras_registro` | **Registro público INHGEOMIN** — 587 concesiones (125 explotación otorgada + 170 exploración otorgada + 292 en solicitud, mayoría pendientes). Tres `categoria` canónicas; RLS público read, admin write. Vista `concesiones_mineras_publicas` para anon. RPCs `search_concesion_minera` (trigram) + `concesiones_minera_stats` (KPIs) son SECURITY DEFINER → consumibles desde anon-key. Seedea con `node scripts/seed-concesiones-mineras.mjs`. |
| `user_roles` | Roles de usuarios del sistema (admin/abogado/tecnico/cliente) |
| `roles` | Catálogo dinámico de roles con permisos JSON |
| `contenido_cms` | Contenido editable de la landing page |
| `configuracion_sistema` | Configuración global del sistema |
| `notificaciones` | Log de notificaciones enviadas |
| `contactos` | Formulario de contacto de la landing |
| `registro_auditoria` | Audit trail append-only |

---

## 5. RUTAS DE LA PLATAFORMA

### Páginas
| Ruta | Acceso | Estado |
|---|---|---|
| `/` | Público | ✅ Landing page completa |
| `/login` | Público | ✅ Login unificado con redirección por rol |
| `/admin` | admin | ✅ Panel de administración |
| `/admin/usuarios` | admin | ✅ Gestión de usuarios + welcome email |
| `/admin/roles` | admin | ✅ Gestión de roles |
| `/admin/contenido` | admin | ✅ Editor CMS |
| `/admin/config` | admin | ✅ Configuración del sistema |
| `/admin/profesionales` | admin | ✅ Perfiles profesionales |
| `/admin/concesiones` | admin | ✅ Registro INHGEOMIN — 587 concesiones (KPIs, filtros, tabla paginada) |
| `/registro` | Público | ✅ Búsqueda pública en vivo del registro INHGEOMIN |
| `/verificar/[numero]` | Público | ✅ Verificación de certificados de origen |
| `/dashboard` | abogado / tecnico / admin | ✅ Dashboard operativo |
| `/dashboard/expedientes` | abogado / tecnico / admin | ✅ Lista de expedientes |
| `/dashboard/expedientes/[id]` | abogado / tecnico / admin | ✅ Detalle con 4 tabs |
| `/dashboard/mensajes` | abogado / tecnico / admin | ✅ Feed WhatsApp |
| `/portal` | cliente | ✅ Portal read-only de estado del expediente |

### API principal
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/login` | POST | Login unificado → cookies httpOnly |
| `/api/expedientes` | GET / POST | Lista y creación de expedientes |
| `/api/expedientes/[id]` | GET | Detalle del expediente |
| `/api/expedientes/[id]/next-actions` | GET | Estado del workflow |
| `/api/expedientes/[id]/transition` | POST | Avanzar fase |
| `/api/documentos/[id]` | PATCH | Verificar / rechazar documento |
| `/api/contacto` | POST | Formulario landing → emails gerencia + acuse |
| `/api/email/send` | POST | Envío directo vía SendGrid |
| `/api/whatsapp/send` | POST | Envío WhatsApp Meta Cloud API |
| `/api/webhook/whatsapp` | GET + POST | Webhook Meta (verificación + mensajes) |
| `/api/whatsapp` | GET + POST | Webhook Twilio — asistente María |
| `/api/admin/cms` | GET / POST / DELETE | Editor CMS |
| `/api/admin/config` | GET / PATCH | Configuración del sistema |
| `/api/admin/concesiones` | GET | Lista paginada del registro INHGEOMIN (admin/abogado/tecnico) |
| `/api/admin/concesiones/stats` | GET | KPIs del registro INHGEOMIN |
| `/api/admin/concesiones/[id]` | GET / PATCH | Detalle + edición (sin DELETE) |
| `/api/concesiones/buscar` | GET | **Pública** — RPC `search_concesion_minera` con cache 60s + SWR 5min |
| `/api/admin/roles` | GET / POST | Gestión de roles |
| `/api/admin/usuarios` | GET / POST | Gestión de usuarios |
| `/api/prices` | GET | Precios LBMA en tiempo real |

---

## 6. ASISTENTE VIRTUAL MARÍA

Webhook Twilio en `app/api/whatsapp/route.js` conecta WhatsApp con Claude AI.

- **Modelo**: `claude-haiku-4-5-20251001`
- **Persona**: María, asistente CHT — español hondureño, tuteo, ≤5 líneas por mensaje, cero emojis
- **Conocimiento**: Servicios CHT + Reglamento Ley Minería Honduras (Acuerdo 042-2013)
- **Historial**: últimos 20 mensajes de `conversaciones_whatsapp` por número
- **Contexto dinámico**: inyecta datos del cliente conocido; suprime re-saludos en conversaciones en curso
- **Auto-registro**: extrae nombre y municipio de la conversación y registra en `clientes`
- **Dedup**: filtra mensajes assistant consecutivos antes de enviar a Claude
- **Trigger de transacción**: "✅ Listo" + "Confirmas" → inserta en `transacciones_pendientes`
- **Modo admin**: `willis yang` + `TENKA-2026` → reporte ejecutivo de 3 mensajes
- **Contact forwarding**: respuestas con promesa de callback → alerta WhatsApp a Willis (+504 3210 0683)

---

## 7. MOTOR DE WORKFLOW

```
GET /api/expedientes/:id/next-actions
  → getNextActions(expedienteId)
      → getAvailableTransitions(fase_actual_id)   ← grafo transiciones_fase
      → getBlockingReasons(expedienteId, faseId)  ← chequea documentos + pagos
  → { can_advance, is_final, blocking[], available_transitions[] }

POST /api/expedientes/:id/transition
  → advancePhase(expedienteId, userId, transitionId)
      → valida condiciones
      → cierra expediente_fases (salida_en)
      → actualiza expedientes.fase_actual_id
      → abre nuevo expediente_fases (entrada_en)
      → inserta registro_auditoria
      → revierte si falla el insert
```

---

## 8. ESTADO ACTUAL (11 mayo 2026)

### Completado
- [x] Dominio y hosting (Vercel + Supabase)
- [x] Schema completo — 23 migraciones (008 base + 010–023 incrementales)
- [x] Motor de workflow con chequeo real de documentos e `is_final`
- [x] Sistema RBAC: 4 roles, cookies httpOnly, guard `proxy.ts`
- [x] Login unificado con redirección por rol
- [x] Dashboard operativo (abogado / técnico / admin)
- [x] Portal de cliente (read-only)
- [x] Panel admin completo: usuarios, roles, CMS, configuración, profesionales
- [x] Servicios de email (SendGrid) — 6 plantillas
- [x] Servicio WhatsApp (Meta Cloud API v21.0)
- [x] Asistente María con base de conocimiento legal (Reglamento 042-2013)
- [x] Modo admin Willis Yang — reporte ejecutivo en WhatsApp
- [x] Auto-registro de clientes desde conversación WhatsApp
- [x] Tablas piloto core: clientes, minas, contratos, indice_legalidad, transacciones_oro
- [x] RLS activo en todas las tablas (005–009)
- [x] Sistema de diseño CHT en DESIGN.md — tokens en globals.css
- [x] Landing page completa — 8 componentes, imágenes, Open Graph
- [x] Phase 1 — Realineación de superficie pública (2026-05-10)
  - Landing institucional reemplaza la página de ventas
  - Portal público de Verificación de Certificado de Origen
    (`/verificar`, `/verificar/[numero]`, `/api/verificar/[numero]`)
  - Migración 020 + vista pública `certificados_origen_publicos`
  - Metadata SEO canónica enriquecida en `app/layout.tsx`
  - Eliminación de `components/landing/*` (15 archivos huérfanos)
- [x] Phase 2A — Mine Registry CRUD + Índice de Legalidad UI (2026-05-10)
  - `POST /api/admin/minas` (creación con validación server-side)
  - `GET, PATCH /api/admin/minas/[id]` (sin DELETE — registros mineros indelebles)
  - `GET, PATCH /api/admin/indice-legalidad/[mina_id]` (upsert por componente)
  - `/dashboard/minas`: modal "+ Nueva mina", row → detail link
  - `/dashboard/minas/[id]`: tabs General · Legalidad · Contratos · Transacciones
  - Edit modal para campos de mina; retiro vía `estado='clausurada'`
  - Cierra el gap de auditoría: `minas` UI 0/10 → ~7/10
- [x] **Phase 2E — Registro INHGEOMIN público + María RAG (2026-05-11)**
  - 587 concesiones transcritas de 3 PDFs INHGEOMIN (125 explotación otorgada
    + 170 exploración otorgada + 292 en solicitud)
  - Migración 023 con tabla `concesiones_mineras_registro`, vista pública,
    RPCs `search_concesion_minera` y `concesiones_minera_stats`
    (SECURITY DEFINER al estilo migración 019)
  - Admin UI `/admin/concesiones` con KPIs, filtros, paginación
  - Página pública `/registro` con búsqueda en vivo (debounce 250ms)
  - Endpoint público `/api/concesiones/buscar` con cache edge 60s + SWR 5min
  - María integration: `buildConcesionContext()` keyword-triggered,
    inyecta hasta 5 filas en el system prompt con guardrail explícito de no
    afirmar aprobación cuando la categoría es `solicitud_pendiente`
  - Scripts idempotentes: `aggregate-concesiones-jsonl.mjs` (JSONL→JSON merge)
    + `seed-concesiones-mineras.mjs` (upsert chunked por
    `(categoria, numero_registro)`)

### Pendiente para producción
- [ ] Aplicar migraciones 007–023 en Supabase producción (si no se han corrido)
- [ ] Variables de entorno en Vercel (ver sección 9)
- [ ] `node scripts/seed-super-admin.mjs` post-deploy
- [ ] `node scripts/seed-concesiones-mineras.mjs` post-deploy (587 filas INHGEOMIN)
- [ ] `node scripts/seed-maria-honduras-ambiental.mjs` post-deploy (165 chunks RAG legal — ver §RAG)
- [ ] SPF + DKIM para `gerencia@mape.legal` en SendGrid
- [ ] Webhook Meta Business Portal → `/api/webhook/whatsapp`
- [ ] Webhook Twilio → `/api/whatsapp`

### Runbook — Añadir conocimiento al RAG de María

**Vercel no corre scripts de seed.** Cada documento nuevo en `data/maria-knowledge/**` requiere dos pasos manuales antes de que María lo pueda citar. La omisión del paso 1 fue causa raíz del incidente 2026-05-15 (María deflectaba "¿Qué dice el Artículo 28-A?" a `gerencia@mape.legal` porque los 165 chunks de Ley 104-93 / Decreto 181-2007 / SLAS-2 nunca se insertaron en producción).

**Flujo canónico para añadir nuevo conocimiento:**

1. **Transcribir** la fuente (PDF, gaceta, manual) a markdown verbatim en `data/maria-knowledge/<categoria>/NN-titulo.md`.
2. **Escribir / extender el seed script** en `scripts/seed-maria-<categoria>.mjs` siguiendo el patrón de `seed-maria-honduras-ambiental.mjs` (chunker estructura-aware, idempotente por `source LIKE '<categoria>/%'`, soporta `--dry-run --json`).
3. **Verificar localmente** con `node scripts/seed-maria-<categoria>.mjs --dry-run --json` → revisar `data/maria-knowledge/<categoria>.chunks.json` y el conteo total de chunks.
4. **Cargar a producción — elegir UNO:**
   - **(a)** Con env vars locales (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):
     ```bash
     node scripts/seed-maria-<categoria>.mjs
     ```
   - **(b)** Sin env vars locales — generar SQL pegable en Supabase Studio:
     ```bash
     node scripts/seed-maria-<categoria>.mjs --dry-run --json
     node scripts/chunks-json-to-sql.mjs data/maria-knowledge/<categoria>.chunks.json \
       > data/maria-knowledge/seed-<categoria>.sql
     # Pegar el .sql en Supabase Studio → SQL Editor → Run
     ```
5. **Generar embeddings** — log in como admin a `/admin/maria/rag-health` → botón **"Completar (todas las pendientes)"**. Alternativamente `node scripts/embed-maria-knowledge.mjs` si hay env vars locales.
6. **Verificar end-to-end:**
   - `/admin/maria/rag-health` debe mostrar `Sin embedding: 0` y banner verde `RAG operativo`.
   - Smoke test FTS desde SQL Editor: `select * from public.search_maria_knowledge_fts('<keyword del nuevo doc>', 5);` — debe retornar filas.
   - Pregunta de prueba por WhatsApp → María debe citar el documento.

**Diagnóstico cuando "el RAG no funciona":**
- Primer chequeo: abrir `/admin/maria/rag-health` (admin only). El JSON / UI dice exactamente qué falta — env vars, RPCs, embeddings count, dim mismatch, OpenAI key, etc.
- Segundo chequeo: SQL `select source, count(*), count(*) filter (where embedding is not null) from public.maria_knowledge group by source;` — confirma que (a) los chunks están seedeados y (b) tienen embedding.
- Logs de Vercel filtrados por `[rag]` muestran si María elige `path=semantic`, `path=fts`, o `path=none` en cada turno.

### Próximas fases en cola
- **Phase 2B** — Transactions + Certificate issuance: `transacciones_oro` CRUD,
  flujo de emisión que crea filas en `certificados_origen` con
  `hash_verificacion` (SHA-256), generación de PDF imprimible. Después de 2B,
  certificados reales fluyen a `/verificar/[numero]`.
- **Phase 2C** — Expediente full tracking: UI de fases INHGEOMIN, `hitos`,
  `tareas`, upload de documentos atado a fases; cierra gap de `contratos` UI.
- **Phase 0** — Estabilización (recomendado entre 2B y 2C, dado que 2B es el
  primer paso legalmente consecuente): `middleware.ts`, race conditions del
  workflow, fix de import errors en webhook María, lint warning carryover en
  `app/dashboard/minas/page.tsx`.
- **Phase 2D** — Refactor visual: dashboard inline styles → tokens del
  Color Manual v1.0.

---

## 9. VARIABLES DE ENTORNO REQUERIDAS

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_SITE_URL=https://mape.legal

# Email (SendGrid)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=gerencia@mape.legal
SENDGRID_FROM_NAME=MAPE.LEGAL

# WhatsApp — Meta Cloud API
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_VERIFY_TOKEN=

# WhatsApp — Twilio (asistente María)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# IA — Anthropic (asistente María)
ANTHROPIC_API_KEY=
```

Ver `.env.example` en el repositorio para plantilla completa.

