# MAPE.LEGAL — README HYPER-DETALLADO

**Versión 1.0 — Piloto Iriona 2026**
Fecha de creación: 26 de abril de 2026
Propietario: Corporación Hondureña Tenka, S.A. (CHT)
Administrador Único: Willis Yang
Dominio: www.mape.legal (público futuro) / App privada en Vercel + Supabase

---

## 1. VISIÓN Y PROPÓSITO (OFICIAL)

MAPE.LEGAL es la plataforma digital interna de CHT que actúa como **motor de evidencia legal de origen mineral** para minería artesanal y de pequeña minería en Honduras.

Su propósito principal es generar, almacenar y certificar de forma automática evidencia legalmente defendible de que el oro proviene de operaciones formalizadas conforme a la **Ley de Minería, Reglamento MAPE, ILO 169, SLAS-2** y estándares internacionales (CRAFT / Fairmined / RJC).

**Frase de una línea:**
> "La plataforma que convierte minería informal en oro traceable, certificado y premium para Chiopa Industrias planta de refinamiento de oro en Honduras y mercados éticos internacionales."

**Visión ampliada (CEO level):**
Convertirse en el Verra / Fairmined de Honduras: la primera plataforma nacional que une formalización legal + trazabilidad + comercialización de oro responsable. Escalamiento: Iriona → todo el corredor aurífero hondureño → Centroamérica.

---

## 2. CONTEXTO DE NEGOCIO (CHT)

- **CHT** = Corporación Hondureña Tenka, S.A.
- **Fundador y Administrador Único:** Willis Yang
- **Socio 50%:** Ricardo Alfredo Montes Nájera

**Modelo de ingresos dual:**
1. Servicios de formalización (paquete ancla L 1.600.000 + titulaciones + contratos de sociedad minera)
2. Margen de comercialización de oro (compra a mineros 80% LBMA → venta a Chiopa Industrias 85% LBMA)

**Piloto 2026:** Asociación de Mineros de Iriona, Colón (~60 mineros)

**Servicios que la plataforma soporta:**
- Paquete Ancla Formalización Minera (L 1.600.000 – 3 hitos: 30%/40%/30%)
- Titulación de Propiedad (L 38.000 base + L 8.000 por manzana adicional)
- Contrato de Sociedad Minera (L 55.000 – co-pagado 50/50)

---

## 3. ARQUITECTURA TÉCNICA

| Componente | Decisión |
|---|---|
| Hosting | Vercel (app privada) |
| Base de datos | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Framework | Next.js 16.2.4 (App Router, Turbopack) |
| Frontend | React + Tailwind v4 (`@theme inline`) |
| Autenticación | httpOnly cookies (`auth-token`, `auth-role`) — 4 roles: admin, abogado, tecnico_ambiental, cliente |
| Guard de rutas | `proxy.ts` (Next.js 16 — reemplaza `middleware.ts`) |
| Almacenamiento | Supabase Storage (fotos georeferenciadas, documentos, constancias) |
| Notificaciones | Meta WhatsApp Business Cloud API v21.0 + SendGrid REST API |
| Documentos | Plantillas HTML → PDF (Certificate of Origin automático) |
| CMS | Tabla `contenido_cms` en Supabase — editable desde panel admin |

> Dominio público (www.mape.legal) se activa solo en lanzamiento comercial.

---

## 4. ESQUEMA DE BASE DE DATOS

Objeto central: **unidad minera (mina)**

| Tabla | Descripción |
|---|---|
| `clientes` | Mineros y dueños de tierra por separado |
| `minas` | Coordenadas UTM, categoría ambiental, estado legal |
| `indice_legalidad` | 5 componentes (0–100%) |
| `contratos` | Consultoría, sociedad minera, arrendamiento |
| `tipos_tramite` | Catálogo de trámites |
| `plantillas_hitos` | Hitos por tipo de servicio |
| `expedientes` | Número EXP-2026-XXX, fase, progreso visual |
| `asignaciones` | Abogado + PSA por expediente |
| `tareas` | 54 pasos del Manual Operativo con rol codificado |
| `notificaciones` | WhatsApp + sistema |
| `documentos` | Estado: listo / procesando / ilegible / verificado / rechazado |
| `transacciones_oro` | Trazabilidad futura |

---

## 5. MÓDULOS ESENCIALES DEL PILOTO (4 módulos)

1. **Registro de Productores** — Verificación real-time de permisos INHGEOMIN/SERNA, ficha completa (RTN, coordenadas, situación de tierra, foto GPS)
2. **Registro de Transacciones** — Compra de oro con peso, ley, fecha, coordenadas de origen + Certificate of Origin automático
3. **Generación Automática de Certificado de Origen** — Evidencia legal defendible (fotos georeferenciadas + constancia ILO 169 + índice de legalidad)
4. **Seguimiento de Expedientes Legales** — Dashboard con barra de progreso por fase

---

## 6. DASHBOARD

Prototipo React completo funcional en `/public/dashboard.html`. Características:

- **Sidebar izquierdo:** Lista de expedientes con ID, cliente, tipo, barra de progreso, badge de estado
- **Área principal:** Detalle del expediente, hitos y documentos
- **WA Feed (barra derecha):** Mensajes WhatsApp en vivo, estados de documentos, botones de verificación, filtros y contador de pendientes
- **Topbar:** Logo MAPE.LEGAL + usuario + notificaciones

El prototipo simula: actualización de estado de documentos, toast de éxito/error, modales de rechazo con motivo, verificación PSA / Abogado.

---

## 7. INTEGRACIÓN CON MANUAL OPERATIVO 2026

El dashboard y Supabase están diseñados para mapear exactamente los **54 pasos del Manual Operativo 2026** (versión 1.0).

Cada paso tiene: Rol, acciones, documentos requeridos, plazo y deliverable.

> **Regla de oro:** Ningún paso se marca como completado sin deliverable físico/digital en el expediente.

Fase 0 (Onboarding) ya está 100% mapeada en la plataforma.

---

## 8. FLUJOS CLAVE (Camino B)

1. Onboarding → Hito 1 (30%) → Apertura expediente en MAPE.LEGAL
2. Visita de campo (fotos GPS) → Categorización SLAS-2
3. Generación automática de constancias y Certificate of Origin
4. Feed WhatsApp → Verificación IA / humana → Evidencia sellada
5. Comercialización provisional (mientras tramitan permisos)

---

## 9. ESTADO ACTUAL (27-abr-2026)

### Completado
- [x] Dominio confirmado
- [x] Arquitectura decidida (Vercel + Supabase)
- [x] Prototipo Dashboard 100% funcional
- [x] Schema ER diseñado (6 migraciones aplicadas en desarrollo)
- [x] Manual Operativo 54 pasos completo
- [x] Menu de Servicios 2026 aprobado
- [x] Mapa Iriona con 60 mineros
- [x] Sistema de diseño CHT (Playfair Display + Inter, tokens de color, DESIGN.md)
- [x] Landing page — todos los componentes alineados al brand
- [x] Sistema RBAC completo: 4 roles, cookies httpOnly, guard `proxy.ts`
- [x] Login unificado `/login` con redirección por rol
- [x] Dashboard (abogado/admin): resumen operativo, lista de expedientes, detalle con 4 tabs, mensajes WhatsApp
- [x] Portal de cliente (read-only): estado del expediente, hitos, documentos
- [x] Panel Admin: gestión de roles, CMS editor, configuración del sistema
- [x] Servicio de email (SendGrid REST) con plantillas para avance de expediente, rechazo y pago
- [x] Servicio WhatsApp (Meta Cloud API v21.0) con webhook de entrada
- [x] Build limpio: 35 rutas, 0 errores TypeScript, 0 advertencias
- [x] Branch `claude/audit-script-errors-Q3GnB` actualizado en GitHub

### Pendiente para producción
- [ ] Ejecutar `supabase/migrations/006_roles_cms_config.sql` en Supabase producción
- [ ] Imagen hero (`public/images/hero-rio-honduras.jpg`) — colocar manualmente
- [ ] Variables de entorno en Vercel: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`
- [ ] Crear usuario admin inicial en Supabase Auth (Willis Yang)
- [ ] Configurar webhook de WhatsApp en Meta Business Portal → `/api/webhook/whatsapp`
- [ ] Tablas `clientes` y `minas` — registro de productores (siguiente sprint)

---

## 10. CONFIDENCIALIDAD Y USO

> Uso exclusivo interno de CHT y socios autorizados.
> Documento confidencial. Prohibida reproducción sin autorización escrita del Administrador Único.
> Todos los datos de mineros y expedientes están protegidos por RLS de Supabase.
