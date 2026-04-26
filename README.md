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
| Frontend | React + Tailwind |
| Backend | Supabase Edge Functions + Row Level Security |
| Autenticación | Supabase Auth (roles: Admin CHT, Abogado, Técnico Ambiental, Cliente) |
| Almacenamiento | Supabase Storage (fotos georeferenciadas, documentos, constancias) |
| Notificaciones | Supabase Realtime + WhatsApp Business API |
| Documentos | Plantillas HTML → PDF (Certificate of Origin automático) |

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
- [ ] Imagen hero (`public/images/hero-rio-honduras.jpg`) — colocar manualmente
- [ ] Schema Supabase creado
- [ ] Primera pantalla real (productor registry)
- [ ] Conexión WhatsApp Business API

---

## 10. CONFIDENCIALIDAD Y USO

> Uso exclusivo interno de CHT y socios autorizados.
> Documento confidencial. Prohibida reproducción sin autorización escrita del Administrador Único.
> Todos los datos de mineros y expedientes están protegidos por RLS de Supabase.
