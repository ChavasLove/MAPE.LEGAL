# MAPE.LEGAL — Plataforma de Formalización Minera

**Versión 1.1 — Piloto Iriona 2026**
Última actualización: 2 de mayo de 2026
Propietario: Corporación Hondureña Tenka, S.A. (CHT)
Administrador Único: Willis Yang
Dominio: mape.legal · App privada en Vercel + Supabase

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

## 4. ESQUEMA DE BASE DE DATOS (9 migraciones)

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

## 8. ESTADO ACTUAL (2 mayo 2026)

### Completado
- [x] Dominio y hosting (Vercel + Supabase)
- [x] Schema completo — 9 migraciones aplicadas en desarrollo
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

### Pendiente para producción
- [ ] Aplicar migraciones 007–009 en Supabase producción
- [ ] Variables de entorno en Vercel (ver sección 9)
- [ ] `node scripts/seed-super-admin.mjs` post-deploy
- [ ] SPF + DKIM para `gerencia@mape.legal` en SendGrid
- [ ] Webhook Meta Business Portal → `/api/webhook/whatsapp`
- [ ] Webhook Twilio → `/api/whatsapp`

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

---

## 9. ESTADO ACTUAL (26-abr-2026)

- [x] Dominio confirmado
- [x] Arquitectura decidida (Vercel + Supabase)
- [x] Prototipo Dashboard 100% funcional
- [x] Schema ER diseñado (3 iteraciones)
- [x] Manual Operativo 54 pasos completo
- [x] Menu de Servicios 2026 aprobado
- [x] Mapa Iriona con 60 mineros
- [x] Sistema de diseño CHT implementado (Playfair Display + Inter, tokens de color completos)
- [x] Landing page — todos los componentes alineados al brand (11 componentes)
- [x] Imágenes territoriales aplicadas en landing (río, mapa, campo, legal, logo CHT)
- [x] Precios eliminados de la landing — cotizaciones por solicitud privada únicamente
- [x] Garantía de tiempo de gestión como mensaje principal
- [ ] Schema Supabase creado
- [ ] Primera pantalla real (productor registry)
- [ ] Conexión WhatsApp Business API

---

## 11. CONFIDENCIALIDAD

Uso exclusivo interno de CHT y socios autorizados.
Documento confidencial — prohibida reproducción sin autorización del Administrador Único.
Todos los datos de mineros y expedientes están protegidos por RLS de Supabase.
