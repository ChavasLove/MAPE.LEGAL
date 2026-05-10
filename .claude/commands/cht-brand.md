# CHT Brand Context — Skill de Identidad Corporativa

**Trigger:** Cualquier mención de CHT, mape.legal, Tenka, expediente minero Honduras,
o solicitud de crear algo "en el estilo de CHT".

**Ver también:** `DESIGN.md` (tokens de diseño completos) · `CLAUDE.md` (arquitectura) · `docs/ai-context.md` (reglas de idioma en código)

---

## Regla de oro de comunicación

- **Al cliente (UI, emails, documentos):** español siempre.
- **Arquitectura y código interno:** inglés.
- Nunca mezclar ambos en un mismo texto dirigido al usuario final.

---

## 1. Identidad de Marca

| Campo | Valor |
|---|---|
| Nombre legal | Corporación Hondureña Tenka, S.A. |
| Marca comercial | CHT |
| Sub-marca digital | mape.legal |
| Descriptor | Consultoría Estratégica |
| Tagline principal | "Legalizamos tu proyecto minero." |
| Tagline secundario | Consultoría legal y estratégica para una minería artesanal y de pequeña escala, responsable y en cumplimiento con la ley hondureña. |
| URL | www.mape.legal |
| Mercado | Honduras — piloto: Iriona, Colón |
| Sector | Minería Artesanal y de Pequeña Escala (MAPE) |

**Pilares de valor** (usar en copy y UI):
1. **Legalidad Total** — Permisos mineros, ambientales y municipales.
2. **Gestión Integral** — Acompañamiento en todo el proceso hasta la aprobación.
3. **Experiencia Territorial** — Conocimiento profundo del contexto local y regulatorio.
4. **Responsabilidad Ambiental** — Minas legales, territorios sostenibles.

**Frases de marca aprobadas:**
- "Legalizamos tu proyecto minero."
- "Minería legal, territorio sostenible."
- "Acompañamiento integral hasta el permiso."
- "Tu permiso, paso a paso."

**CHT NO dice:**
- Plazos fijos sin condicionarlos a la documentación del cliente.
- Que gestiona documentos que son EXCLUSIVO CLIENTE.
- Precios sin el contexto del hito correspondiente.

---

## 2. Formato de Datos (UI)

```
Moneda:    Lempiras (L) — nunca USD salvo conversión BCH explícita
Fecha:     DD/MM/YYYY
Zona:      America/Tegucigalpa (UTC-6)
Código:    CHT-IR-NNN  (ej. CHT-IR-028)
```

**Estructura de expediente:**
```ts
Expediente {
  codigo:           "CHT-IR-028"
  cliente:          "Minería La Esperanza"
  ubicacion:        "Iriona, Colón"
  faseActual:       "Fase 2 - Evaluación Ambiental"
  estado:           "En revisión" | "Pendiente cliente" | "Completado" | "Bloqueado"
  actualizado:      "15/05/2026"
  responsables:     { abogado: string, psa: string }
  hitos:            { h1: boolean, h2: boolean, h3: boolean }
  indice_legalidad: { tierra, permiso, licencia, municipal, comercializador }
}
```

---

## 3. Contexto Operativo — Manual Operativo CHT 2026

### Roles del sistema

| Rol | Responsabilidades clave |
|---|---|
| Abogado CHT | Trámites ante INHGEOMIN, SERNA, Alcaldía y Notaría |
| Técnico Ambiental CHT (PSA) | Herramienta técnica, inspecciones, seguimiento SLAS-2 |
| Administración CHT | Gestión del sistema, facturación, coordinación |
| CLIENTE — EXCLUSIVO | Documentos personales, pagos directos, garantía bancaria |

---

### Proceso 1 — Formalización Minera (L 1,600,000 total)

**Hitos de pago:**

| Hito | Monto | Trigger |
|---|---|---|
| H1 | L 480,000 (30%) | Firma del contrato |
| H2 | L 480,000 (30%) | Obtención Constancia INHGEOMIN |
| H3 | L 800,000 (50%) | Índice de Legalidad Absoluta al 100% |

> H1 + H2 + H3 = L 1,760,000. El total del contrato es L 1,600,000; el desglose interno cubre el anticipo.

**Fases:**
| Fase | Pasos | Descripción |
|---|---|---|
| 0 | 1–6 | Onboarding y evaluación inicial |
| 1 | 7–13 | Solicitud e inicio ante INHGEOMIN |
| 2 | 14–27 | Licenciamiento Ambiental SERNA / SLAS-2 (16 requisitos) |
| 3 | 28–32 | Resolución final y título de permiso minero |
| 4 | 33–38 | Permiso municipal, registro comercializador, cierre |

Plazo total estimado: **6–14 meses**

**Índice de Legalidad Absoluta** (los 5 deben estar en verde para cobrar H3):
1. Tierra titulada o contrato registrado
2. Permiso INHGEOMIN
3. Licencia ambiental SERNA
4. Permiso de operación municipal
5. Registro de Comercializador INHGEOMIN

**Advertencias críticas:**
- Publicación en La Gaceta: presentar ante INHGEOMIN en máximo **5 días** desde su fecha.
- Período de oposición: **15 días hábiles** desde última publicación.
- Pago T.G.R. 1: máximo **10 días** desde confirmación SERNA.
- PSA vencido invalida todo el expediente.
- SERNA no revisa expedientes incompletos — nunca presentar con pendientes.

---

### Proceso 2 — Titulación de Propiedad

| Campo | Detalle |
|---|---|
| Precio base | L 38,000 (hasta 2 manzanas) + L 8,000/manzana adicional |
| Pago | Único al inicio |
| Plazo estimado | 4–8 meses |
| Fases | Diagnóstico y clasificación → Gestión ante INA o IP → Inscripción en Registro de la Propiedad |
| Advertencia | Tierra en áreas protegidas, territorios indígenas o zonas de reserva NO puede titularse |

---

### Proceso 3 — Contrato de Sociedad Minera

| Campo | Detalle |
|---|---|
| Precio total | L 55,000 (co-pagado: L 27,500 por parte) |
| Plazo estimado | 2–3 semanas |
| Partes | Dueño de tierra + Operador minero |
| Participación referencial del dueño | 20–30% de producción |
| Fases | Due diligence → Acuerdo → Redacción → Revisión (2 rondas) → Notarización → Registro IP → Entrega |

---

## 4. Principios Operativos CHT

```
01 — Ningún avance sin expediente completo.
02 — El sistema es la memoria del equipo.
03 — El cliente es informado, no sorprendido.
04 — CHT asesora — no sustituye al cliente.
05 — La garantía condicionada es sagrada.
06 — Las fechas críticas no se negocian.
```

---

## 5. Vocabulario Clave

| Término | Significado en contexto CHT |
|---|---|
| Expediente | Carpeta digital+física de un cliente en el sistema |
| INHGEOMIN | Instituto Hondureño de Geología y Minas |
| SERNA | Secretaría de Recursos Naturales y Ambiente |
| SLAS-2 | Sistema de Licenciamiento Ambiental SERNA |
| SIMHON | Sistema de Información Minero Honduras |
| DUPAI | Formulario de solicitud de permiso ante INHGEOMIN |
| PSA | Prestador de Servicios Ambientales (Técnico Ambiental habilitado) |
| MAPE | Minería Artesanal y de Pequeña Escala |
| EIA | Estudio de Impacto Ambiental (categoría 4 SLAS-2) |
| Índice de Legalidad | Verificación de los 5 componentes legales completos |
| T.G.R. 1 | Pago a la Tesorería General de la República (requisito 16 SERNA) |
| DECA | Dirección de Evaluación y Control Ambiental |
| Fondo Rotatorio DECA | Cuenta BANADESA Nº 02001-000131-0 |
| Hito | Punto de cobro condicionado a un entregable verificado |
| EXCLUSIVO CLIENTE | Paso que CHT asesora pero NO ejecuta |
| Constancia de Solicitud | Documento habilitante de INHGEOMIN para iniciar trámite SERNA |
