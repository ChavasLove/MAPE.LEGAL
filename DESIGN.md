# MAPE LEGAL — Color Manual & Design System (Obligatorio)

**Corporación Hondureña Tenka · MAPE.LEGAL**
Source of truth para toda decisión de color, tipografía y componente. La fuente canónica está en [`README.md`](./README.md) (sección *Color Manual v1.0*) y en `app/globals.css`.

> **Hard rule:** No invented hex outside this document or `app/globals.css`. Si un color que necesitas no está aquí, no existe — abre PR para agregarlo.

---

## 0. Brand DNA

**Eje de posicionamiento:** Legal (precisión) · Institucional (credibilidad) · Natural (territorio) · Técnico (rigor de proceso).

**Principio:** *"Tinta, piedra, musgo."* — autoridad natural, no naturaleza decorativa.

**Evitar:** verdes brillantes, gradientes startup, formas orgánicas excesivas, gold metallic, neón.
**Preferir:** tonos minerales, verdes desaturados (musgo), neutros tierra (papel), jerarquía tipográfica fuerte.

---

## 1. Paleta de Colores

### 1.1 Primaria — tinta + grises

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#1F2A38` | Color ancla del sistema. Texto principal, fondo principal sobre oscuros, default de botón primario, sidebar, footer |
| `--ink-2` | `#3B4A5C` | Hover de superficies/botones que parten de `--ink`. No usar como texto base |
| `--slate` | `#5E6B7B` | Texto secundario de UI: meta, breadcrumbs, leyendas, eyebrow |
| `--slate-lt` | `#A3A8AB` | Disabled, hairlines sobre fondos oscuros (footer, hero) |
| `--plum` | `#5F5F77` | Acento muy ocasional: avatares default, tags neutrales en panel admin |

### 1.2 Naturaleza — territorio

| Token | Hex | Uso |
|---|---|---|
| `--moss` | `#2F5D50` | Botón WhatsApp, italic em de H1, focus rings, link hover, secondary CTA |
| `--moss-2` | `#587E5E` | Live dot de notificación, estados activos en steppers, ring de foco |
| `--earth` | `#8B6A4A` | Numerales grandes en stats strip, separadores cortos del eyebrow, ornamentos |
| `--sand` | `#D8C3A5` | Único cálido permitido en hero/footer. Itálico de H1, líneas topográficas, divisores sobre ink |
| `--concrete` | `#F0EDE5` | Fondo de citas, callouts, placeholders. Más cálido que `--bg-soft` |

### 1.3 Funcionales — sólo estado, nunca decoración

| Token | Hex | Uso |
|---|---|---|
| `--green` | `#2A8E50` | Documento verificado, step COMPLETED, hito pagado, ACH confirmado |
| `--amber` | `#C58B2C` | Step IN_REVIEW, alerta WARN, deadline a 2-5 días, observación pendiente |
| `--red` | `#B23A3A` | Step REJECTED/BLOCKED, oposición Art. 66, alerta CRITICAL, deadline vencido |
| `--blue` | `#2A6BA8` | Documento nuevo en bandeja WA, mensaje informativo, tag "actualizado" |

> Verde / ámbar / rojo / azul son **señales de estado**. Nada de "tarjetas verdes porque se ven frescas" ni "borde rojo porque resalta". Se rompe la legibilidad del sistema de alertas.

### 1.4 Neutros — papel y bordes

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#FFFFFF` | Cards, modals, inputs. **Nunca** fondo de página en producto |
| `--bg-soft` | `#FAF9F5` | Lienzo principal de la app y landing. El "papel" de MAPE LEGAL |
| `--t1` | `#1F2A38` | Texto principal, alias de `--ink` para semántica tipográfica |
| `--t2` | `#4B5563` | Color por defecto de párrafos sobre `--bg-soft` |
| `--t3` | `#8E96A2` | Texto auxiliar: helpers de input, timestamps, footer copy sobre claro |
| `--border` | `#E2E0D8` | Hairline 1px de cards, separadores, líneas de tabla. Default total |
| `--border-2` | `#C9C5B9` | Stronger hairline para feature cards y elementos enfatizados |

### 1.5 Pares texto/fondo aprobados (WCAG)

| FG | BG | Uso |
|---|---|---|
| `--ink` | `--bg-soft` | Default body / heading (AAA) |
| `--t2` | `--bg-soft` | Default body copy (AAA) |
| `--slate` | `--bg-soft` | Captions, meta (AA) |
| `--t3` | `--bg-soft` | Helper / hint (large only — LG) |
| `--ink` | `--bg` | Card title (AAA) |
| `--moss` | `--bg-soft` | Section title em / link (AAA) |
| `--earth` | `--bg-soft` | Stat numerals (large — AA) |
| `--bg` | `--ink` | Hero copy / footer body (AAA) |
| `--sand` | `--ink` | Hero italic / topo accent (AAA) |
| `--slate-lt` | `--ink` | Footer meta on dark (AA) |
| `--bg` | `--moss` | Secondary CTA on moss (AA) |
| `--green` | `--bg-soft` | OK pill text (AA) |
| `--amber` | `--bg-soft` | Warn pill text (large — LG) |
| `--red` | `--bg-soft` | Block / overdue text (AA) |
| `--blue` | `--bg-soft` | Info text (AA) |

Para tonos derivados (hover, fondo de pill, fondo translúcido) usa `color-mix(in oklch, var(--ink) 80%, white)` — **nunca inventes un nuevo hex**.

---

## 2. Tipografía

| Rol | Familia | Variable CSS | Pesos |
|---|---|---|---|
| Títulos / Display | **Playfair Display** | `--font-display` | Medium 500, SemiBold 600 (default), Bold 700 |
| Cuerpo / UI | **Inter** | `--font-body` | Regular 400, Medium 500, SemiBold 600, Bold 700 |
| Mono / Numerales / Eyebrow | **JetBrains Mono** | `--font-mono` | Regular 400, Medium 500 |

Los tres se cargan en `app/layout.tsx` vía `next/font/google` y exponen las variables CSS arriba.

### Reglas tipográficas
- `<h1>`–`<h6>` heredan `--font-display` desde `globals.css`.
- Cuerpo, botones, labels, tablas usan `--font-body` (Inter) — default del `<body>`.
- Eyebrows en mayúsculas, numerales y código usan `--font-mono`.
- **Peso máximo: 700.** Nunca `font-weight: 800` o `900`.
- Italic de H1 va en `var(--moss)` o `var(--sand)` según contraste — nunca un color funcional.

### Escala

| Nivel | Tamaño / Leading | Familia | Peso |
|---|---|---|---|
| H1 hero | clamp(48px, 6vw, 84px) / 1.02 | Display | 600 |
| H2 sección | clamp(32px, 3.6vw, 46px) / 1.08 | Display | 600 |
| H3 grupo | 24px / 1.2 | Display | 600 |
| Body | 16px / 1.6 | Body | 400 |
| Small | 14px / 1.5 | Body | 400 |
| Caption / mono | 12px / 1.4 | Mono | 500 |
| Eyebrow | 11px / 1.4, letter-spacing 0.18em UPPER | Mono | 600 |

---

## 3. Componentes UI

### Botones
| Tipo | Background | Color | Border | Radio | Sombra |
|---|---|---|---|---|---|
| Primary | `--ink` | `#fff` | none | `8px` | `shadow-sm` máx |
| Secondary (moss) | `--moss` | `#fff` | none | `8px` | `shadow-sm` máx |
| Ghost | transparent | `--t2` → `--ink` (hover) | `1px solid --border` | `8px` | none |
| Text-only | transparent | `--ink` | none | none | underline en hover |

Hover de primary: `color-mix(in oklch, var(--ink) 88%, white)`.
**Nunca** `rounded-full` ni `rounded-2xl` en botones de acción. **Nunca** `shadow-xl` o `shadow-2xl`.

### Badges / pills (estado)

`rounded-full`, `padding: 8px 14px`, `font-size: 13px`, `font-weight: 600`, `font-family: --font-body`.

| Estado | BG | Texto | Border |
|---|---|---|---|
| OK · Verificado | `color-mix(in oklch, var(--green) 14%, white)` | `--green` | `color-mix(in oklch, var(--green) 30%, white)` |
| En revisión · vence | `color-mix(in oklch, var(--amber) 14%, white)` | `--amber` | `color-mix(in oklch, var(--amber) 30%, white)` |
| Bloqueante · oposición | `color-mix(in oklch, var(--red) 14%, white)` | `--red` | `color-mix(in oklch, var(--red) 30%, white)` |
| Nuevo documento WA | `color-mix(in oklch, var(--blue) 14%, white)` | `--blue` | `color-mix(in oklch, var(--blue) 30%, white)` |

### Cards

```
background: var(--bg)
border:     1px solid var(--border)
radius:     12px (rounded-xl)
shadow:     0 2px 6px rgba(31,42,56,0.05)  /* shadow-sm only */
padding:    24px
```

`--border-2` solo para cards de feature destacada y elementos enfatizados.

### Tablas

| Elemento | Background | Color |
|---|---|---|
| `th` | `--ink` | `#fff` (Inter SemiBold uppercase tracking-wider) |
| `td` | `--bg` | `--t1` |
| `tr` border-bottom | `--border` | — |
| `tr:hover` | `--bg-soft` | — |

---

## 4. Reglas — `Sí` y `No`

### Sí
- **`color-mix(in oklch, var(--ink) 80%, white)`** para tonos derivados (hover, fondos translúcidos).
- **Body en `--t2` sobre `--bg-soft`** como default; headings en `--ink`; eyebrows y captions en `--t3` o `--slate`.
- **Hairlines siempre `--border`** (`#E2E0D8`, 1px). Solo escala a `--border-2` en feature cards.
- **`--sand` es el único cálido sobre `--ink`** — reservado para H1 italic, líneas topográficas y separadores en hero/footer. No en CTAs ni bloques de UI.

### No
- **No funcionales como decoración.** Verde/ámbar/rojo/azul son señales de estado.
- **No gradientes** salvo el overlay radial del hero. Cards, buttons, badges, fondos: sólidos. Nada glassmorphism, nada neón.
- **No `#FFFFFF` como fondo de página.** El "papel" es `--bg-soft`. El blanco puro queda para cards, modales e inputs.
- **No opacidad >0.10 en líneas topográficas claras.** Hero=0.06, footer light=0.05, dark=0.18.
- **No `font-weight: 800` ni `900`.** Cap = 700.
- **No `rounded-full` en botones, no `rounded-2xl` en cards.** Botones `rounded-lg` (8px), cards `rounded-xl` (12px).
- **No `shadow-xl` / `shadow-2xl`** en componentes de página, solo en modales.
- **No animaciones continuas** (`animate-pulse`, `animate-bounce`, blink) en UI de producción.
- **No emojis** en componentes UI ni en email templates.
- **No info de contacto personal en landing.**

---

## 5. Landing page

- Fondo base: `--bg-soft`. Secciones alternas: `--bg-soft` ↔ `--bg`.
- Hero: ink stats strip, sand H1 italic, TopoBand light overlay opacity 0.06.
- Footer: ink fondo, sand acento, slate-lt meta, TopoBand dark band 48px opacity 0.18.
- CTAs primarios: `--ink`. CTAs ambientales: `--moss`.
- Marca tipográfica en nav (`MAPE LEGAL` en Playfair 600, `Color Manual · v1.0` en JetBrains Mono small caps).

---

## 6. Dashboard (UI misión crítica)

- Fondo: `--bg-soft` (no `--ink`). El dashboard sigue el mismo "papel" del producto.
- Sidebar: `--ink` con texto blanco, hover `--ink-2`, item activo `color-mix(in oklch, var(--moss) 8%, white)` con borde-izquierdo `--moss`.
- Cards de estadística: `--bg`, `border 1px solid --border`, `shadow-sm`. Numeral grande en `--earth`, `--font-display`.
- Estados de fila: usar las pills de §3 (OK/En revisión/Bloqueado/Nuevo). Nunca colorear filas completas — solo el badge.

---

## 7. Iconografía

Línea fina (`stroke-width: 1.5`). Heroicons Outline o Lucide. Tamaños 20px en UI · 24px en encabezados · 32px en hero. **Nunca** íconos rellenos en UI principal.

---

## 8. TopoBand (motivo topográfico)

Watermark embossed de líneas de contorno. Implementación canónica: `components/decor/TopoBand.tsx`.

| Variant | Color | Opacity por defecto |
|---|---|---|
| `light` (sobre claros) | `--ink` (#1F2A38) | 0.06 |
| `dark` (sobre `--ink`) | `--moss` (#2F5D50) | 0.18 |

Posiciones: `overlay` (full-bleed detrás de contenido) · `band` (48px en top edge, footer).
Reglas: `pointer-events: none`, `aria-hidden`, opacidad ≤ 0.20, sin fills coloreados, sin animación.

---

## 9. Tono de voz UI

Español, formal pero accesible. CTAs con verbo de acción: "Iniciar trámite", "Ver expediente", "Subir documento".
Mensajes de error explicativos — "No se pudo cargar el expediente. Intenta de nuevo."

---

## 10. Implementación

- **Source of truth:** `app/globals.css`. Tokens declarados en `:root`.
- **Tailwind v4:** se usa `@theme inline` en `globals.css` — **no** `tailwind.config.js`.
- **Stack snippets** (CSS, Tailwind config, Style Dictionary JSON): ver README §Color Manual.
- **Future work:** cualquier color hardcodeado fuera de `globals.css` es deuda técnica. Si encuentras uno, abre PR para reemplazarlo por el token correspondiente.
