# CHT — Sistema de Diseño · Guía Obligatoria

**Corporación Hondureña Tenka · MAPE.LEGAL**
Todo código de interfaz debe cumplir este sistema. No improvises colores, fuentes ni componentes fuera de esta guía.

---

## 1. Paleta de Colores

### Primaria (UI estructural)
| Token | Hex | Uso |
|-------|-----|-----|
| `primary-950` | `#1F2A44` | Sidebar, nav, fondos oscuros |
| `primary-900` | `#162033` | Texto principal oscuro, encabezados |
| `primary-500` | `#5E6B7A` | Texto secundario, bordes |
| `primary-300` | `#A3AAB3` | Placeholders, texto deshabilitado |
| `primary-50`  | `#F5F6F7` | Fondo de página, superficies neutras |

### Natural (Marca / Identidad territorial)
| Token | Hex | Uso |
|-------|-----|-----|
| `forest-800` | `#2F5D50` | Verde primario de marca, CTAs principales |
| `forest-600` | `#6E7F5E` | Acentos verdes secundarios |
| `earth-600`  | `#8C6A4A` | Acento tierra, elementos mineros |
| `earth-200`  | `#D8C3A5` | Fondos cálidos, tarjetas de contexto |
| `earth-50`   | `#F0EDE8` | Fondo crema, secciones alternadas |

### Funcional (Estados y acciones)
| Token | Hex | Uso |
|-------|-----|-----|
| `action-green` | `#3E7C59` | Éxito, completado, aprobado |
| `action-gold`  | `#C49A4A` | Pendiente, en proceso, advertencia |
| `action-red`   | `#A94442` | Error, rechazado, bloqueado |
| `action-blue`  | `#3A6EA5` | En revisión, informativo |

### Reglas de uso
- **Nunca** mezcles colores de la paleta natural con grises puros (`slate-*`, `gray-*`) en el mismo componente.
- El fondo de página en la landing es siempre `#F5F6F7` (primary-50) o `#F0EDE8` (earth-50), **no** `white` puro.
- El fondo de página en el dashboard es siempre `#162033` (primary-900) o `#1F2A44` (primary-950).
- Los botones primarios usan `#2F5D50` (forest-800), **nunca** `green-600` ni `emerald-*` de Tailwind genérico.

---

## 2. Tipografía

### Fuentes
| Rol | Familia | Pesos usados |
|-----|---------|--------------|
| Títulos / Headlines | **Playfair Display** | Bold (700), SemiBold (600), Medium (500) |
| Cuerpo / UI | **Inter** | Regular (400), Medium (500), SemiBold (600) |

### Escala tipográfica
| Nivel | Fuente | Tamaño / Leading | Peso |
|-------|--------|-----------------|------|
| H1 | Playfair Display | 42px / 52px | Bold |
| H2 | Playfair Display | 28px / 36px | SemiBold |
| H3 | Playfair Display | 20px / 28px | Medium |
| Body | Inter | 16px / 24px | Regular |
| Small | Inter | 14px / 20px | Regular |
| Caption | Inter | 12px / 16px | Regular |

### Reglas
- Todos los `<h1>`, `<h2>`, `<h3>` usan **Playfair Display**.
- Todo texto de UI (labels, botones, tablas, badges) usa **Inter**.
- No uses `font-black` (900) — el peso máximo es Bold (700).
- Interletrado (`tracking-*`): solo en labels en mayúsculas (`tracking-widest`).

---

## 3. Componentes UI

### Botones
```
Primario  → bg #2F5D50, text white, rounded-lg, px-6 py-3, font-semibold Inter
Secundario → border #2F5D50, text #2F5D50, bg transparent, mismos radios y padding
Texto      → text #2F5D50, sin borde ni fondo, underline en hover
```
- Radio de borde: `rounded-lg` (8px) — **nunca** `rounded-2xl` ni `rounded-full` en botones de acción.
- No uses `shadow-2xl` en botones; máximo `shadow-sm`.

### Badges / Estados de expediente
| Estado | Color de fondo | Color de texto | Hex fondo | Hex texto |
|--------|---------------|----------------|-----------|-----------|
| Completado | Verde claro | Verde oscuro | `#D1FAE5` | `#065F46` |
| En revisión | Azul claro | Azul oscuro | `#DBEAFE` | `#1E40AF` |
| Pendiente cliente | Ámbar claro | Ámbar oscuro | `#FEF3C7` | `#92400E` |
| Bloqueado | Rojo claro | Rojo oscuro | `#FEE2E2` | `#991B1B` |

Todos los badges: `rounded-full`, `px-3 py-1`, `text-xs font-semibold Inter`.

### Tarjetas (Cards)
- Fondo: `white` o `#F5F6F7`
- Borde: `1px solid #E5E7EB` (slate-200 equivalente)
- Radio: `rounded-xl` (12px)
- Sombra: `shadow-sm` únicamente
- Padding interno: `p-6`

### Tablas
- Header: fondo `#F5F6F7`, texto `#5E6B7A`, `text-xs font-semibold uppercase tracking-wider`
- Filas: fondo `white`, borde inferior `#E5E7EB`, hover `#F5F6F7`
- Texto de celda: `text-sm Inter`, color `#162033`

---

## 4. Iconografía

Usa íconos de línea fina (`stroke-width: 1.5`) estilo Lucide o Heroicons Outline. Nunca íconos rellenos (filled) en la UI principal.

Categorías de íconos del sistema:
- **Expediente** — documento con esquina doblada
- **Documento** — papel con líneas
- **Permiso** — escudo o sello
- **Ambiente** — hoja o árbol
- **Topografía** — ondas de contorno
- **Ubicación** — pin de mapa
- **Pago** — moneda o billete
- **Notificación** — campana

Tamaño estándar: `20px` en UI, `24px` en encabezados de sección, `32px` en hero o ilustraciones.

---

## 5. Layout y Espaciado

### Landing page
- Ancho máximo de contenido: `max-w-6xl` (1152px)
- Padding horizontal de secciones: `px-6` (móvil) / `px-8` (desktop)
- Espaciado vertical entre secciones: `py-20` o `py-24`
- Secciones alternas: `#F5F6F7` y `#F0EDE8` — **no** `white` puro ni `slate-50`

### Dashboard interno
- Sidebar: ancho fijo `256px`, fondo `#1F2A44`
- Área de contenido: fondo `#F5F6F7`, padding `p-8`
- Tarjetas de estadísticas: grid `grid-cols-4`, gap `gap-6`

### Grid y columnas
- Desktop: 12 columnas
- Tablet: 8 columnas
- Móvil: 4 columnas

---

## 6. Estilo Fotográfico

Imágenes deben seguir estas reglas:
- **Temáticas válidas**: ríos hondureños, montañas y selva tropical, trabajo de campo con casco (minería responsable), mapas geológicos, documentos legales sobre mesa.
- **Tratamiento**: ligeramente desaturado, filtro de brillo reducido al 75–85 %, contraste +5 %.
- **Prohibido**: imágenes de stock genéricas, personas sin contexto territorial hondureño, imágenes de minería industrial o destructiva.
- Todas las imágenes hero llevan overlay `bg-gradient-to-b from-black/30 via-black/20 to-black/60`.

---

## 7. Componente de Mapa

El mapa territorial usa `Leaflet.js` con las siguientes capas:
- Puntos rojos: Coordenadas en Consulta
- Rectángulos beige: Asentamiento Pech o Paya
- Puntos grises: Municipios
- Rectángulos de colores: Concesiones activas (verde = activa, amarillo = en trámite)

Leyenda siempre visible en esquina inferior derecha, fondo blanco con `rounded-lg shadow-sm`.

---

## 8. Tono de Voz UI

- **Español** para toda la interfaz de usuario.
- Formal pero accesible: no uses jerga legal excesiva en labels de botones.
- CTAs: verbos de acción directa — "Iniciar trámite", "Ver expediente", "Subir documento", "Agendar consulta".
- **Nunca** uses anglicismos en la UI: "Dashboard" es la excepción aceptada por convención técnica.
- Mensajes de error: explicativos, no técnicos — "No se pudo cargar el expediente. Intenta de nuevo." en lugar de códigos HTTP.

---

## 9. Lo que NO se hace

- No uses `tailwind.config.js` — este proyecto usa Tailwind v4 con `@theme` en `globals.css`.
- No uses `shadow-2xl` ni `shadow-xl` en componentes de UI (solo en modales).
- No uses `rounded-full` en botones de acción (solo en badges y avatares).
- No uses colores Tailwind genéricos (`green-*`, `emerald-*`, `gray-*`) — usa los tokens de esta guía.
- No agregues información de contacto personal (nombres, teléfonos, WhatsApp) en la landing page.
- No toques `public/dashboard.html` desde la landing page — son sistemas separados.
- No uses `font-black` (peso 900).
- No uses animaciones complejas (`animate-bounce`, `animate-spin`) en UI de producción.
