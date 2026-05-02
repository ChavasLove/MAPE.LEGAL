# CHT — Sistema de Diseño · Guía Obligatoria

**Corporación Hondureña Tenka · MAPE.LEGAL**
Todo código de interfaz debe cumplir este sistema. No improvises colores, fuentes ni componentes fuera de esta guía.

---

## 0. Brand DNA (Base No-Visual)

**Eje de posicionamiento:**
- Legal (precisión, autoridad)
- Institucional (credibilidad, adyacente al Estado)
- Natural (territorio, tierra, sostenibilidad)
- Técnico (rigor de proceso — flujos por fases y puntos de cumplimiento)

**Principio de diseño:** "Autoridad natural — no naturaleza decorativa."

**Evitar:**
- Verdes brillantes
- Gradientes con apariencia startup
- Formas orgánicas excesivas

**Preferir:**
- Tonos minerales
- Verdes desaturados
- Neutros tierra
- Jerarquía tipográfica fuerte

---

## 1. Paleta de Colores

### 1.1 Primaria (Núcleo de Marca)

| Token CSS | Clase Tailwind | Hex | Uso |
|-----------|---------------|-----|-----|
| `--cht-primary-navy` | `primary-950` | `#1F2A44` | Sidebar, nav, CTAs principales, botones |
| `--cht-deep-navy` | `primary-900` | `#162033` | Encabezados, texto principal oscuro |
| `--cht-slate` | `primary-500` | `#5E6B7A` | Texto secundario, bordes |
| `--cht-light-slate` | `primary-300` | `#A3AAB3` | Placeholders, texto deshabilitado |
| `--cht-off-white` | `primary-50` | `#F5F6F7` | Fondo de página, superficies neutras |

### 1.2 Natural (Capa Controlada, No Decorativa)

| Token CSS | Clase Tailwind | Hex | Uso |
|-----------|---------------|-----|-----|
| `--cht-forest` | `forest-800` | `#2F5D50` | Verde sostenibilidad, CTAs secundarios |
| `--cht-olive` | `forest-600` | `#6E7F5E` | Acentos tierra / agricultura |
| `--cht-earth` | `earth-600` | `#8C6A4A` | Acento suelo / territorio |
| `--cht-sand` | `earth-200` | `#D8C3A5` | Superficies naturales claras, énfasis sobre oscuro |
| — | `earth-50` | `#F0EDE8` | Fondo crema, secciones alternas |

Usar con moderación → acentos, no base de UI.

### 1.3 Funcional (Retroalimentación del Sistema)

| Token CSS | Clase Tailwind | Hex | Uso |
|-----------|---------------|-----|-----|
| `--cht-success` | `action-green` | `#3E7C59` | Aprobado / Completado |
| `--cht-warning` | `action-gold` | `#C49A4A` | Pendiente / Atención |
| `--cht-danger` | `action-red` | `#A94442` | Riesgo legal / Rechazado |
| `--cht-info` | `action-blue` | `#3A6EA5` | Informativo / En revisión |

### 1.4 Mapeo Semántico (Dashboard — CRÍTICO)

Vinculado directamente al sistema operativo:

| Estado | Color | Clase | Fondo badge | Texto badge |
|--------|-------|-------|-------------|-------------|
| Completado | Verde | `action-green` | `badge-success-bg` `#E6F2EC` | `#2F5D50` |
| Pendiente cliente | Ámbar | `action-gold` | `badge-warning-bg` `#F5EBDD` | `#8C6A4A` |
| En revisión | Azul | `action-blue` | `badge-info-bg` `#DBEAFE` | `#3A6EA5` |
| Bloqueado | Rojo | `action-red` | `badge-danger-bg` `#F8E5E4` | `#A94442` |

### Reglas de uso
- **Nunca** mezcles colores de la paleta natural con grises puros (`slate-*`, `gray-*`) en el mismo componente.
- El fondo de página en la landing es siempre `primary-50` (`#F5F6F7`) o `earth-50` (`#F0EDE8`), **no** `white` puro.
- El fondo de página en el dashboard es siempre `primary-900` (`#162033`) o `primary-950` (`#1F2A44`).
- Los botones primarios de acción usan `primary-950` (`#1F2A44`) — **nunca** `green-600`, `emerald-*` ni colores Tailwind genéricos.
- Los CTAs vinculados a naturaleza/ambiente usan `forest-800` (`#2F5D50`).

---

## 2. Tipografía

### Fuentes

| Rol | Familia | Pesos usados | Variable CSS |
|-----|---------|--------------|-------------|
| Títulos / Headlines | **Playfair Display** | Bold (700), SemiBold (600), Medium (500) | `--font-playfair` |
| Cuerpo / UI | **Inter** | Regular (400), Medium (500), SemiBold (600) | `--font-inter` |

Fallback de títulos: `Georgia, serif`
Fallback de cuerpo: `system-ui, sans-serif`

### Escala tipográfica

| Nivel | Fuente | Tamaño / Leading | Peso | Clase |
|-------|--------|-----------------|------|-------|
| H1 | Playfair Display | 42px / 52px | Bold | `text-5xl font-bold` |
| H2 | Playfair Display | 28px / 36px | SemiBold | `text-4xl` |
| H3 | Playfair Display | 20px / 28px | Medium | `text-xl font-semibold` |
| Body | Inter | 16px / 24px | Regular | `text-base font-sans` |
| Small | Inter | 14px / 20px | Regular | `text-sm font-sans` |
| Caption | Inter | 12px / 16px | Regular | `text-xs font-sans` |

### Reglas
- Todos los `<h1>`, `<h2>`, `<h3>`, `<h4>` usan **Playfair Display** (aplicado automáticamente en `globals.css`).
- Todo texto de UI (labels, botones, tablas, badges) usa **Inter** — agrega `font-sans` explícitamente.
- No uses `font-black` (900) — el peso máximo es Bold (700).
- Interletrado (`tracking-*`): solo en labels en mayúsculas (`tracking-widest`).

---

## 3. Componentes UI

### Botones

```
Primario   → bg primary-950 (#1F2A44), text white, rounded-lg, px-6 py-3, font-semibold Inter
Secundario → border primary-950, text primary-950, bg transparent, mismos radios y padding
Texto      → text primary-950, sin borde ni fondo, underline en hover
```

- Radio de borde: `rounded-lg` (8px) — **nunca** `rounded-2xl` ni `rounded-full` en botones de acción.
- Sombra máxima: `shadow-sm` — **nunca** `shadow-2xl`, `shadow-xl`, `shadow-lg` en botones.

### Badges / Estados de expediente

Todos los badges: `rounded-full`, `px-3 py-1`, `text-xs font-semibold Inter`.

| Estado | Fondo | Texto |
|--------|-------|-------|
| Completado | `#E6F2EC` | `#2F5D50` |
| En revisión | `#DBEAFE` | `#3A6EA5` |
| Pendiente cliente | `#F5EBDD` | `#8C6A4A` |
| Bloqueado | `#F8E5E4` | `#A94442` |

### Tarjetas (Cards)

- Fondo: `white`
- Borde: `1px solid #E5E7EB`
- Radio: `rounded-xl` (12px)
- Sombra: `shadow-sm` únicamente
- Padding interno: `p-6`

### Tablas

- Header: fondo `#1F2A44`, texto `white`, `text-xs font-semibold uppercase tracking-wider`
- Filas: fondo `white`, borde inferior `#E5E7EB`, hover `#F5F6F7`
- Texto de celda: `text-sm Inter`, color `#162033`

```css
table { border-collapse: collapse; }
th { background: #1F2A44; color: white; }
td { border-bottom: 1px solid #E1E5EA; }
```

---

## 4. Landing Page

### Comportamiento de color

- Fondo base: `primary-50` (`#F5F6F7`)
- Secciones alternas: `primary-50` / `earth-50` (`#F0EDE8`)

### Sección Hero

```css
filter: brightness(0.80) contrast(1.05) saturate(0.82);
overlay: bg-gradient-to-b from-black/40 via-black/30 to-black/70;
fallback: bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950;
```

Tono: documental, no promocional.

### Navegación (nav)

Marca exclusivamente tipográfica — sin logotipo de imagen:

```
MAPE.LEGAL          ← text-white font-bold text-base tracking-tight
Corporación Hondureña Tenka  ← text-white/45 text-[10px] tracking-widest uppercase
```

### Botones CTA

```css
.primary-button  { background: #1F2A44; color: white; }  /* Institucional */
.secondary-button { border: 1px solid #1F2A44; color: #1F2A44; }
/* CTAs de contexto ambiental/territorial usan forest-800 #2F5D50 */
```

### Layout

- Ancho máximo de contenido: `max-w-6xl` (1152px)
- Padding horizontal: `px-6` (móvil) / `px-8` (desktop)
- Espaciado vertical entre secciones: `py-20` o `py-24`

---

## 5. Dashboard (UI Misión Crítica)

### Tema base

```css
background: #162033;                   /* primary-900 */
cards:      #1F2A44;                   /* primary-950 */
borders:    rgba(94,107,122,0.3);      /* primary-500/30 */
```

### Tarjetas de estadísticas: `grid-cols-4, gap-6`

### Lógica de color de estado (alineada al flujo operativo)

| Estado | Color | Significado |
|--------|-------|-------------|
| Completado | Verde `action-green` | Entregable verificado |
| Pendiente | Ámbar `action-gold` | En espera |
| En revisión | Azul `action-blue` | Procesando por autoridad |
| Bloqueado | Rojo `action-red` | Problema legal |

Vinculado a Fases 0–4 y principio "No avanzar sin expediente completo".

---

## 6. Iconografía

Estilo: **línea fina** (`stroke-width: 1.5`), Lucide o Heroicons Outline. **Nunca** íconos rellenos en UI principal.

Categorías:
- **Expediente** — documento con esquina doblada
- **Documento** — papel con líneas
- **Permiso** — escudo o sello
- **Ambiente** — hoja o árbol
- **Topografía** — ondas de contorno
- **Ubicación** — pin de mapa
- **Pago** — moneda o billete
- **Notificación** — campana

Tamaños: `20px` en UI · `24px` en encabezados de sección · `32px` en hero o ilustraciones.

---

## 7. Espaciado

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 40px;
```

### Dashboard interno
- Sidebar: ancho fijo `256px`, fondo `primary-950`
- Área de contenido: fondo `primary-50`, padding `p-8`

---

## 8. Sombra y Profundidad

Mantener mínimo:

```css
box-shadow: 0 2px 6px rgba(0,0,0,0.05);  /* shadow-sm */
```

- `shadow-sm` únicamente en cards y elementos UI.
- `shadow-xl` o `shadow-2xl` solo en modales — **nunca** en componentes de página o botones.

---

## 9. Fotografía

- **Temáticas válidas**: ríos hondureños, montañas y selva tropical, trabajo de campo con casco, mapas geológicos, documentos legales sobre mesa.
- **Tratamiento**: desaturado (`saturate(0.82)`), brillo 75–80 %, contraste +5 %.
- **Prohibido**: imágenes de stock genéricas, personas sin contexto territorial hondureño, minería industrial.
- Todas las imágenes hero llevan overlay `bg-gradient-to-b from-black/30 via-black/20 to-black/60`.

---

## 10. Componente de Mapa

El mapa territorial usa `Leaflet.js` con las siguientes capas:
- Puntos rojos: Coordenadas en Consulta
- Rectángulos beige: Asentamiento Pech o Paya
- Puntos grises: Municipios
- Rectángulos de colores: Concesiones activas (verde = activa, amarillo = en trámite)

Leyenda siempre visible en esquina inferior derecha, fondo blanco con `rounded-lg shadow-sm`.

---

## 11. Tokens CSS — Referencia de Implementación

```css
:root {
  /* Primary */
  --cht-primary-navy: #1F2A44;
  --cht-deep-navy:    #162033;
  --cht-slate:        #5E6B7A;
  --cht-light-slate:  #A3AAB3;
  --cht-off-white:    #F5F6F7;

  /* Nature */
  --cht-forest: #2F5D50;
  --cht-olive:  #6E7F5E;
  --cht-earth:  #8C6A4A;
  --cht-sand:   #D8C3A5;
  --cht-cream:  #F0EDE8;

  /* Functional */
  --cht-success: #3E7C59;
  --cht-warning: #C49A4A;
  --cht-danger:  #A94442;
  --cht-info:    #3A6EA5;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}
```

---

## 12. Tono de Voz UI

- **Español** para toda la interfaz de usuario.
- Formal pero accesible: no uses jerga legal excesiva en labels de botones.
- CTAs: verbos de acción directa — "Iniciar trámite", "Ver expediente", "Subir documento", "Agendar consulta".
- **Nunca** uses anglicismos en la UI: "Dashboard" es la excepción aceptada por convención técnica.
- Mensajes de error: explicativos — "No se pudo cargar el expediente. Intenta de nuevo." en lugar de códigos HTTP.

Ejemplos:
- ❌ "Your project is almost ready!"  →  ✅ "Expediente en revisión — SERNA"
- ❌ "Upload your files"  →  ✅ "Cargar documentos requeridos (Requisito 8/16)"

---

## 13. Lo que NO se hace

- No uses `tailwind.config.js` — este proyecto usa Tailwind v4 con `@theme inline` en `globals.css`.
- No uses `shadow-2xl` ni `shadow-xl` en componentes de UI (solo en modales).
- No uses `rounded-full` en botones de acción (solo en badges y avatares).
- No uses colores Tailwind genéricos (`green-*`, `emerald-*`, `gray-*`, `slate-*`, `amber-*`) — usa los tokens de esta guía.
- No agregues información de contacto personal (nombres, teléfonos, WhatsApp) en la landing page.
- No toques `public/dashboard.html` desde la landing page — son sistemas separados.
- No uses `font-black` (peso 900).
- No uses animaciones complejas (`animate-bounce`, `animate-spin`) en UI de producción.
- No uses `rounded-2xl` ni `rounded-3xl` en tarjetas o botones — `rounded-xl` para cards, `rounded-lg` para botones.
