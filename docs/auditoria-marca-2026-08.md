# Auditoría de marca — MAPE LEGAL (2026-08-05)

Alcance: cumplimiento de la identidad visual y verbal declarada en
[`DESIGN.md`](../DESIGN.md) (Color Manual v1.0), [`README.md`](../README.md) §0,
`CLAUDE.md` §Estilo/UI y §Voz canónica, y la skill `cht-brand`, contrastado
contra el código real de `app/`, `components/`, `lib/` y `services/`.

Método: verificación empírica (grep sobre el árbol + CSS compilado por
`next build` + cálculo de contraste WCAG), no lectura de la documentación.
Donde la documentación y el código discrepan, manda el código.

---

## Semáforo

| Área | Estado |
|---|---|
| Favicon / iconos de aplicación | ✅ Resuelto en esta rama |
| Gate de copy legal (`check:copy`) | ✅ Limpio — 159 archivos + 50 del pase de vigencia |
| Paleta: clases genéricas de Tailwind | ✅ Cero ocurrencias |
| Tipografía: pesos ≤ 700 | ✅ Cero `font-extrabold` / `font-black` |
| Emojis en UI y plantillas de email | ✅ Cero ocurrencias |
| Voz pública (tercera persona, sin "ofrecemos") | ✅ Cero infracciones |
| Fuente de marca en superficies internas | ✅ Resuelto en esta rama |
| Skill `cht-brand` — cifras operativas | ✅ Resuelto en esta rama |
| **Coherencia visual dashboard / portal** | ❌ Dos sistemas coexistiendo |
| **Contraste WCAG en insignias de estado** | ❌ Dos pares reprueban |
| Skill `cht-brand` — posicionamiento y taglines | ⚠️ Marcado, pendiente de decisión |
| Literales de color fuera de `globals.css` | ⚠️ 565 ocurrencias |
| Activo de logotipo | ⚠️ Formato y proporción incorrectos |
| Nomenclatura MAPE LEGAL / MAPE.LEGAL | ⚠️ Sin criterio aplicado |

---

## 0. Favicon — corregido

El favicon anterior (`app/favicon.ico`) era el marcador de posición por
defecto: un círculo negro con un triángulo blanco, sin relación con la
identidad. Reemplazado por la marca real, derivada del activo oficial.

Detalle en el commit `feat(brand): reemplazar el favicon genérico…`.
Se añadieron además `app/icon.png` (512) y `app/apple-icon.png` (180), que
antes no existían — el sitio no tenía icono para Android, PWA ni iOS.

Nota técnica reutilizable: los frames del `.ico` deben ir en **RGBA**.
Guardados en RGB, Turbopack rompe el build con
`Format error decoding Ico: The PNG is not in RGBA format!`.

---

## 1. La fuente de marca está anulada en las superficies internas — ALTA

`app/globals.css` declara los tokens tipográficos correctamente
(`--font-body: var(--font-inter)…`) y `<body>` los aplica. Pero **no existe
el bloque `@theme inline`** que `CLAUDE.md` §Estilo/UI da por supuesto, y
`--font-sans` nunca se redefine.

En Tailwind v4 la utilidad se emite como `.font-sans{font-family:var(--font-sans)}`
y `--font-sans` conserva su valor por defecto. Verificado en el CSS compilado:

```
.font-sans{font-family:var(--font-sans)}
--font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", …
```

Inter no aparece en esa cadena. Toda clase `font-sans` **sustituye Inter por
la fuente del sistema operativo** (Segoe UI en Windows, San Francisco en macOS,
Roboto en Android). Hay **190 ocurrencias**:

| Archivo | Ocurrencias |
|---|---|
| `app/dashboard/expedientes/[id]/page.tsx` | 47 |
| `app/dashboard/minas/[id]/page.tsx` | 43 |
| `app/portal/page.tsx` | 20 |
| `app/dashboard/mensajes/page.tsx` | 20 |
| `app/dashboard/minas/page.tsx` | 19 |
| `app/dashboard/page.tsx` · `app/dashboard/expedientes/page.tsx` | 12 c/u |
| `app/auth/establecer-password/page.tsx` | 8 |
| `app/portal/layout.tsx` | 5 |
| `app/dashboard/clientes/page.tsx` | 3 |
| `components/ui/button.tsx` | 1 |

Es el hallazgo de mayor alcance: el cliente que entra al portal y el equipo
que usa el dashboard no ven la tipografía de la marca.

### ✅ Corregido en esta rama

Se añadió a `app/globals.css` el bloque que `CLAUDE.md` ya daba por existente:

```css
@theme inline {
  --font-sans: var(--font-body);
}
```

Verificado en el CSS recompilado: `.font-sans{font-family:var(--font-body)}`.
Las 190 ocurrencias quedan resueltas sin tocar un solo componente.

Comprobaciones colaterales, todas limpias:

- `font-mono` sigue resolviendo a JetBrains. Tailwind emite su
  `--font-mono` por defecto en el offset 20014 del bundle y el `:root` de
  `globals.css` lo redefine en el 48331 — misma especificidad, gana el
  posterior. No hacía falta declararlo en `@theme` (y hacerlo con el mismo
  nombre habría sido autorreferencial).
- `--font-serif` no se mapea: `font-serif` tiene cero usos en el árbol.
- `--default-font-family` pasa a `var(--font-body)`, de modo que `html`
  hereda Inter igual que `body`. Sin regresión.

---

## 2. Coexisten dos sistemas visuales — ALTA

`CLAUDE.md` documenta que admin y dashboard fueron migrados al Color Manual en
2026-05-10, pero esa migración cubrió `app/admin/**` y `app/dashboard/layout.tsx`,
**no las páginas del dashboard ni el portal**.

Resultado hoy:

| Superficie | Lienzo | Tarjetas | Texto de cuerpo |
|---|---|---|---|
| `app/admin/**` | `var(--bg-soft)` | `var(--bg)` + `var(--border)` | `var(--ink)` / `var(--t2)` |
| `app/dashboard/**` (páginas) | `var(--bg-soft)` (del layout) | `#1F2A38` opaco | `#A3A8AB` |
| `app/portal/**` | `#FAF9F5` | `#1F2A38` opaco | `#A3A8AB` |

El layout pinta el "papel" claro correcto y las páginas pintan tarjetas oscuras
encima: un híbrido que no corresponde a ninguna especificación. `DESIGN.md` §6 es
explícito — tarjetas `--bg`, hairline `--border`, `shadow-sm`, numeral en `--earth`.

Tres consecuencias concretas:

1. **`--slate-lt` usado como texto de cuerpo.** Es el literal más frecuente del
   repositorio (158 ocurrencias). `DESIGN.md` §1.1 lo reserva para *"Disabled,
   hairlines sobre fondos oscuros"*, y §1.5 lo aprueba sólo como *"footer meta on
   dark"*. En el dashboard es el color por defecto de tablas y párrafos.
2. **Encabezados de tabla fuera de norma.** §3 exige `th` con fondo `--ink` y
   texto `#fff` (contraste 14.52). El dashboard usa `#A3A8AB` sobre `#1F2A38`
   (6.05): cumple AA, pero rompe la jerarquía del sistema.
3. **`--moss` como relleno.** En `app/dashboard/page.tsx:66` y
   `app/dashboard/minas/page.tsx` se usa `#2F5D50` como fondo de botón — esto
   sí es correcto (§3, CTA secundario), pero escrito como literal.

---

## 3. Insignias de estado que reprueban WCAG — ALTA

Contraste calculado sobre los pares reales del dashboard:

| Par | Ratio | Veredicto |
|---|---|---|
| `#5E6B7B` sobre `#2A3347` — insignia "Pendiente" | **2.32** | **Falla** (mínimo 4.5) |
| `#8B6A4A` sobre `#F2D8B0` — insignia "Alerta" | **3.58** | **Falla** para texto normal |
| `#A3A8AB` sobre `#1F2A38` — texto de tabla | 6.05 | AA |
| `#A3A8AB` sobre `#0F1621` — campos de formulario | 7.56 | AAA |
| `#FFFFFF` sobre `#1F2A38` — lo que exige §3 | 14.52 | AAA |

Ambas insignias se renderizan a `text-xs` (12 px) con `font-semibold`, que WCAG
clasifica como texto normal — el umbral aplicable es 4.5, no 3.0. Ubicaciones:
`app/dashboard/minas/[id]/page.tsx:31,34` y `app/dashboard/clientes/page.tsx:168`.

Las insignias de `DESIGN.md` §3 (`color-mix(in oklch, var(--amber) 14%, white)`
con texto `--amber`) no tienen este problema. Adoptarlas resuelve el defecto y
la deuda de color a la vez.

---

## 4. La skill `cht-brand` contradice la fuente de verdad — ALTA

`.claude/commands/cht-brand.md` se presenta como contexto de identidad
corporativa, pero sus datos operativos están desactualizados y en un punto son
internamente inconsistentes. Es el riesgo más serio de la auditoría: no produce
un defecto visual, produce **cifras equivocadas en respuestas al cliente**.

| Dato | Skill `cht-brand` | Canónico (`lib/maria/systemPrompt.ts`, `MARIA.md`, `services/dashboardService.ts`) |
|---|---|---|
| Hitos de formalización | 30 / 30 / 50 → L 480,000 · 480,000 · 800,000 | **40 / 40 / 20 → L 640,000 · 640,000 · 320,000** |
| Suma de los hitos | L 1,760,000 ≠ L 1,600,000 (la propia skill lo admite en una nota) | L 1,600,000 ✓ |
| Disparador del Hito 2 | "Obtención Constancia INHGEOMIN" | "Ingreso del expediente completo a SERNA (paso 25)" |
| Disparador del Hito 3 | "Índice de Legalidad Absoluta al 100%" | "Permiso INHGEOMIN + licencia ambiental (paso 32)" |
| Titulación — precio base | L 38,000 (hasta 2 mz) | **L 60,000** (hasta 2 mz) |
| Titulación — manzana adicional | L 8,000 | **L 25,000** |

La divergencia de titulación ya estaba señalada en `CLAUDE.md` §Capa de Vigencia
como pendiente; esta auditoría confirma que la de hitos es igual de real y más
grave, porque el desglose ni siquiera cuadra con el total del contrato.

**Además, el posicionamiento de la skill quedó obsoleto en Fase 2C.** Ninguna de
sus cinco frases aprobadas ni su descriptor aparecen en el producto:

| Frase de la skill | Ocurrencias en el código |
|---|---|
| "Legalizamos tu proyecto minero." | 0 |
| "Minería legal, territorio sostenible." | 0 |
| "Acompañamiento integral hasta el permiso." | 0 |
| "Tu permiso, paso a paso." | 0 |
| Descriptor "Consultoría Estratégica" | 0 |

El `h1` real es *"Legalización de permisos de pequeña minería de oro en Honduras."*
Y hay un conflicto de gobernanza de fondo: el tagline principal de la skill
("**Legalizamos** tu proyecto minero") está en primera persona del plural, que
`CLAUDE.md` §Voz canónica prohíbe expresamente. El sitio respeta esa regla — cero
ocurrencias de `ofrecemos|brindamos|nos comprometemos|trabajamos para` — de modo
que la skill prescribe hoy lo que el canon prohíbe.

### ✅ Corregido en esta rama (las cifras) · ⚠️ Pendiente (el posicionamiento)

Se corrigieron en `.claude/commands/cht-brand.md` los tres datos con fuente
canónica verificable: los hitos pasan a 40/40/20 (L 640,000 · 640,000 · 320,000,
que sí suman el total del contrato), sus disparadores reales, y el precio de
titulación a L 60,000 + L 25,000/mz. Se corrigió además una cuarta discrepancia
que apareció al verificar: el Índice de Legalidad Absoluta **no** es el
disparador de H3 — se verifica en el paso 36, con el Paquete Ancla ya cerrado, y
los honorarios que le siguen (paso 37) son un servicio adicional con cotización
separada.

Se añadió al encabezado del archivo una nota de precedencia: la skill es contexto
de marca, no fuente de verdad de precios ni de proceso; ante discrepancia manda
`MARIA.md` / `lib/maria/systemPrompt.ts`. Un dato replicado es un dato que se
desincroniza, y este ya se había desincronizado al menos dos veces.

Las cinco frases y el descriptor quedan **marcados en el archivo como pendientes
de revisión, no retirados**. Retirar o reformular el posicionamiento de la marca
es una decisión del dueño de marca, no una corrección de código.

---

## 5. 565 literales de color fuera de `globals.css` — MEDIA

`DESIGN.md` §10: *"cualquier color hardcodeado fuera de `globals.css` es deuda
técnica"*. Distribución (superiores):

| Archivo | Literales |
|---|---|
| `app/dashboard/minas/[id]/page.tsx` | 120 |
| `app/dashboard/expedientes/[id]/page.tsx` | 92 |
| `app/dashboard/minas/page.tsx` | 62 |
| `app/portal/page.tsx` | 55 |
| `app/dashboard/mensajes/page.tsx` · `expedientes/page.tsx` | 39 c/u |

La mayoría son **duplicados exactos de tokens** (`#A3A8AB`, `#1F2A38`, `#5E6B7B`):
deuda, no color inventado. Pero seis valores **no existen en la paleta**:

| Valor | Usos | Naturaleza |
|---|---|---|
| `#0F1621` | 29 | Tinta más oscura que `--ink`; fondo de campos de formulario |
| `#E0EDE3` | 26 | Tinte verde a mano — debería ser `color-mix(… var(--green) 14%, white)` |
| `#EFD7D5` | 25 | Tinte rojo a mano |
| `#F4E9D6` | 14 | Tinte ámbar a mano |
| `#D6E2F0` | 13 | Tinte azul a mano |
| `#2A3347` · `#F2D8B0` | 5 · 1 | Fondos de insignia (los del §3 de esta auditoría) |

Los cuatro tintes son aproximaciones manuales de la fórmula `color-mix` que
`DESIGN.md` §3 ya prescribe: sustituirlos es mecánico y elimina de paso el
defecto de contraste.

**Falso positivo a no corregir:** `app/login/page.tsx:19-22` usa `#FFC107`,
`#FF3D00`, `#4CAF50` y `#1976D2` — son los colores oficiales de la "G" de
Google en el botón de OAuth. Una marca de terceros conserva su propia paleta.

---

## 6. El activo del logotipo — MEDIA

`public/images/MAPE LEGAL LOGO 1.JPG` es el único logotipo del repositorio y se
usa en 10 superficies (admin, dashboard, portal, login y las cuatro pantallas de
autenticación). Tres problemas:

1. **Es un JPG con fondo opaco.** Su negro es `#1E1E1E` uniforme, mientras que
   `--ink` es `#1F2A38`. Sobre la barra lateral del panel de administración
   (`background: var(--ink)`) el logotipo se ve como un **rectángulo de un negro
   ligeramente distinto**, con borde visible. Un logotipo debe ser PNG con alfa
   o SVG; JPG además introduce artefactos de compresión sobre línea fina.
2. **La proporción declarada no corresponde al activo.** El archivo es 916×908
   (≈ 1:1), pero se declara `80×32` (2.5:1) en `app/admin/layout.tsx` y
   `app/dashboard/layout.tsx`, y `80×28` (2.86:1) en `app/portal/layout.tsx`.
   Las pantallas de autenticación sí lo declaran cuadrado (72×72, 32×32, 52×52).
3. **No aparece en el sitio público.** `app/page.tsx`, `PublicNav` y `SiteFooter`
   usan sólo el wordmark tipográfico. El logotipo existe únicamente puertas
   adentro — decisión defendible para una pieza institucional, pero conviene que
   sea deliberada y no un residuo.

Relacionado: la `og:image` es la fotografía `RIVER AND MOUNTAINS.png`, sin marca.
Cada vez que se comparte un enlace del sitio, la tarjeta no lleva identidad.

---

## 7. Nomenclatura sin criterio aplicado — MEDIA

Tres formas conviven en superficies de usuario:

| Forma | Ocurrencias |
|---|---|
| `MAPE LEGAL` | 103 |
| `MAPE.LEGAL` | 51 |
| `mape.legal` | 63 |
| `CHT` | 32 |
| `Corporación Hondureña Tenka` | 7 |

Existe un criterio — `CLAUDE.md` lo enuncia al pasar para `/precios`: *"marca
MAPE LEGAL, no MAPE.LEGAL plataforma"* — pero no está escrito como regla ni se
aplica. Casos que lo contradicen: `app/mercados/page.tsx:122` titula *"Cómo lo
produce MAPE.LEGAL."* (es la marca actuando, debería ser MAPE LEGAL), y
`app/admin/layout.tsx:90` / `app/portal/layout.tsx:32` rotulan la cabecera como
`MAPE.LEGAL` junto a un `alt="MAPE LEGAL"` en la misma imagen.

La skill `cht-brand` propone además una cuarta capa (sub-marca digital
`mape.legal` en minúsculas) que nadie usa como tal.

Propuesta de regla, para fijar en `DESIGN.md`:

- **MAPE LEGAL** — la marca. Sujeto de toda oración, todo titular, todo `alt`.
- **mape.legal** — el dominio. Sólo en URLs y correos.
- **MAPE.LEGAL** — la plataforma, cuando el texto se refiere al sistema como
  producto. Si no es ese el caso, es MAPE LEGAL.
- **Corporación Hondureña Tenka, S.A.** — la persona jurídica. Sólo en piezas
  legales (`copy-legal.ts`, aviso legal, pie institucional).

---

## 8. Hallazgos menores — BAJA

- **Radio de tarjeta.** `rounded-2xl` (16 px) en 8 puntos de las pantallas de
  autenticación (`login`, `registro`, `recuperar-password`, `resetear-password`);
  `DESIGN.md` §3 fija 12 px (`rounded-xl`) para tarjetas.
- **Trazo de iconografía.** §7 exige `stroke-width: 1.5`. Hay 113 usos correctos
  frente a 38 con `strokeWidth={2}`, 5 con `1.8`, 4 con `1`, 3 con `1.75` y uno
  con `2.5`.
- **`shadow-xl`.** Una sola ocurrencia
  (`app/dashboard/expedientes/[id]/page.tsx:84`) y está en un modal, que es
  justamente la excepción que §4 permite. Sin acción.
- **`animate-spin`.** 12 ocurrencias, todas en `Loader2` durante peticiones en
  curso. §4 prohíbe animaciones continuas y nombra `animate-pulse`,
  `animate-bounce` y `blink`, no `spin`; un indicador acotado a la duración de
  la petición no es decoración. Se documenta para que no se re-descubra: **no es
  infracción**.
- **`theme-color`.** `app/layout.tsx:55` declara `#1F2A38` como literal, donde el
  resto del sistema usaría el token. Es correcto en valor.

---

## Plan de remediación sugerido

Ordenado por relación impacto/esfuerzo, no por severidad.

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| ~~1~~ | ~~`@theme inline` con `--font-sans` en `globals.css`~~ | ✅ hecho | §1 completo (190 puntos) |
| ~~2~~ | ~~Corregir hitos, disparadores y precio de titulación en `cht-brand`~~ | ✅ hecho | §4 (cifras) |
| 3 | Sustituir las 6 insignias por las de `DESIGN.md` §3 con `color-mix` | 3 archivos | §3 + parte de §5 |
| 4 | Fijar la regla de nomenclatura en `DESIGN.md` y corregir los casos que la contradicen | 1 sección + ~5 archivos | §7 |
| 5 | Exportar el logotipo a PNG con alfa (o SVG) y corregir las proporciones declaradas | 1 activo + 3 layouts | §6.1, §6.2 |
| 6 | Migrar `app/dashboard/**` y `app/portal/**` al Color Manual | 9 archivos, ~500 literales | §2 + §5 |
| 7 | Tarjeta `og:image` con identidad | 1 activo | §6 |
| 8 | Normalizar `strokeWidth` y `rounded-2xl` | mecánico | §8 |

Los puntos 1 y 2 se aplicaron en esta rama por ser los de mejor relación
impacto/riesgo: uno arregla 190 puntos con una línea, el otro corrige cifras que
se comunican al cliente. Los puntos 3 a 5 son acotados. El 6 es el trabajo de fondo: es
donde vive la mayor parte de la deuda y conviene tratarlo como una tarea propia,
con verificación visual a 320 / 375 / 768 / 1024 antes de mergear, según el
quality gate que `CLAUDE.md` ya exige para cambios de landing.

---

## Lo que está bien

No todo es deuda. Verificado limpio:

- `check:copy` pasa sin violaciones sobre 159 archivos más 50 del pase de
  vigencia normativa. El aparato de cumplimiento legal funciona.
- Cero clases genéricas de color de Tailwind (`bg-gray-*`, `text-green-*`, …) en
  todo `app/` y `components/`.
- Cero `font-extrabold` / `font-black`: el tope de 700 se respeta.
- Cero emojis en componentes de UI y plantillas de correo.
- Cero infracciones a la regla de voz en tercera persona del copy público.
- `app/admin/**` está correctamente tokenizado y sirve de referencia de cómo
  debe verse el resto del producto.
