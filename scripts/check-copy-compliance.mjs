#!/usr/bin/env node
/**
 * check-copy-compliance.mjs — verificador de términos prohibidos (Fase 2C §1.1)
 *
 * Recorre las superficies de contenido público (app/, components/,
 * lib/content/) y falla con exit code 1 si encuentra cualquier expresión
 * prohibida por las restricciones duras de copy legal.
 *
 * Alcance ampliado (limpieza 2026-08): docs/, lib/maria/, services/ y los
 * archivos raíz (README.md, CLAUDE.md, MARIA.md, AGENTS.md, DESIGN.md) se
 * escanean con las reglas de confidencialidad (`scope: 'all'`) — el
 * repositorio es público y ningún archivo debe exponer contrapartes sin
 * convenio firmado ni cifras de margen comercial.
 *
 * Exclusiones (documentadas):
 *  - app/api        — código de servidor, no copy público: exento de las
 *                     reglas de copy PÚBLICO, pero desde la orden "Blindaje
 *                     institucional de María" (2026-08) SÍ se escanea con las
 *                     reglas de confidencialidad (scope: 'all') — la exención
 *                     total de §1.3 quedó superseded para ese propósito.
 *  - app/admin      — panel interno autenticado, fuera del sitio público.
 *  - app/dashboard  — superficie interna autenticada.
 *  - app/portal     — superficie interna autenticada.
 *
 * Reglas de vigencia (Playbook CC, 2026-08 — sentencia SCO-0090-2014):
 * cuarto alcance sobre lib/, docs/, services/ y los *.md de la raíz. La Sala
 * de lo Constitucional anuló varios artículos de la Ley General de Minería;
 * ninguna superficie del repo puede citarlos como derecho vigente sin la
 * anotación [ANULADO — SCO-0090-2014] (ver checkVigencia abajo). Se excluyen
 * docs/legal/sentencia-sco-0090-2014.md y lib/legal/vigenciaLGM.ts, que
 * necesitan nombrar los artículos sin anotación inline.
 *
 * Uso: node scripts/check-copy-compliance.mjs   (o: npm run check:copy)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'lib/content']
// Alcance ampliado (limpieza 2026-08): documentación interna, prompts de María
// y servicios. En este alcance solo aplican las reglas de confidencialidad
// (`scope: 'all'`) — contrapartes sin convenio firmado y cifras de margen.
// Las reglas de copy público siguen limitadas a SCAN_DIRS: la documentación
// histórica interna (p. ej. CLAUDE.md) describe esas mismas reglas y sus
// violaciones pasadas, y no es superficie de copy.
const INTERNAL_SCAN_DIRS = ['docs', 'lib/maria', 'services']
const ROOT_FILES = ['README.md', 'CLAUDE.md', 'MARIA.md', 'MARIA_LEY_MINERIA.md', 'AGENTS.md', 'DESIGN.md']
// Tercer alcance (orden "Blindaje institucional de María" 2026-08, T2.4):
// app/api deja de estar totalmente exento — se escanea ÚNICAMENTE con las
// reglas de confidencialidad (`scope: 'all'`: contrapartes sin convenio +
// cifras de margen), no con las reglas de copy público (es código de
// servidor, no copy). La exención total de §1.3 quedó superseded por esa
// orden para este propósito.
const CONFIDENTIALITY_ALSO_DIRS = [join('app', 'api')]
const EXCLUDED = [
  join('app', 'api'),
  join('app', 'admin'),
  join('app', 'dashboard'),
  join('app', 'portal'),
]
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx', '.css', '.html']
// Marcador de excepción: una línea que documenta una regla prohibitiva (p. ej.
// la propia regla FINACOOP en CLAUDE.md) se exime añadiendo este marcador en
// un comentario HTML al final de la línea. Usarlo SOLO para documentación de
// reglas — nunca para copy real.
const ALLOW_MARKER = 'check-copy:allow'

/**
 * Cada regla: expresión regular (insensible a mayúsculas donde aplica) y
 * la razón de la prohibición. Las reglas cubren las expresiones de la
 * tabla §1.1 y sus variantes semánticas directas.
 */
const RULES = [
  // Exclusividad / venta atada (Art. 37 LGM: comercialización libre)
  { re: /mercados?\s+exclusivos?/i, label: '"mercados exclusivos" — la comercialización es libre (Art. 37 LGM)' },
  { re: /acceso\s+exclusivo/i, label: '"acceso exclusivo" — la comercialización es libre (Art. 37 LGM)' },
  { re: /exclusividad/i, label: '"exclusividad" — la comercialización es libre (Art. 37 LGM)' },
  { re: /compramos\s+todo\s+su\s+oro/i, label: '"compramos todo su oro" — venta atada' },
  { re: /venta\s+exclusiva/i, label: '"venta exclusiva" — venta atada' },

  // Aval institucional inexistente
  { re: /(validado|avalado|respaldado)\s+por\s+inhgeomin/i, label: 'aval de INHGEOMIN — no existe instrumento formal' },
  { re: /(en\s+)?alianza\s+con\s+inhgeomin/i, label: '"alianza con INHGEOMIN" — no existe instrumento formal' },

  // Precio: la cadencia real es diaria
  { re: /precios?\s+en\s+vivo/i, label: '"precio en vivo" — usar "actualizado diariamente"' },
  { re: /\ben\s+vivo\b/i, label: '"en vivo" (variante) — usar "del día" / "actualizado diariamente"' },
  // Lookbehind: la negación expresa ("no es en tiempo real", copy requerido
  // por T2.4 de la orden 2026-08 — VERIFICAR_FRESCURA_NOTA) no es violación;
  // mismo criterio que la regla de garantías.
  { re: /(?<!\bno\s+es\s+en\s)tiempo\s+real/i, label: '"tiempo real" — usar "actualizado diariamente"' },
  { re: /\blive\s+price/i, label: '"live price" — usar "daily price"' },
  { re: /real[-\s]?time\s+price/i, label: '"real-time price" — usar "daily price"' },

  // Garantías sobre potestades de la Autoridad Minera
  { re: /garantizamos\s+el\s+permiso/i, label: '"garantizamos el permiso" — la resolución es potestad de la Autoridad Minera' },
  { re: /permiso\s+asegurado/i, label: '"permiso asegurado" — la resolución es potestad de la Autoridad Minera' },
  { re: /aprobaci[óo]n\s+garantizada/i, label: '"aprobación garantizada" — la resolución es potestad de la Autoridad Minera' },
  // Lookbehind: la negación expresa ("no garantiza resultados") es copy
  // requerido por §6 del encargo y no constituye violación.
  { re: /(?<!\bno\s)(?<!\bni\s)garantiza(?:mos|n|r)?\s+(?:el\s+|la\s+)?(?:permiso|aprobaci[óo]n|resultado)/i, label: 'garantía de permiso/aprobación/resultado — prohibido' },

  // Doctrina anti-enganche: el crédito vive en la cooperativa, no en CHT
  { re: /anticipos?\s+contra\s+producci[óo]n/i, label: '"anticipos contra producción" — doctrina anti-enganche' },
  { re: /financiamiento\s+con\s+respaldo\s+en\s+oro/i, label: '"financiamiento con respaldo en oro" — doctrina anti-enganche' },
  { re: /adelantos?\s+sobre\s+(?:su\s+)?(?:pr[óo]xima\s+)?entrega/i, label: '"adelanto sobre su próxima entrega" — doctrina anti-enganche' },

  // No existe autorización tácita para operar durante el trámite
  { re: /per[íi]odo\s+preoperativo/i, label: '"período preoperativo" — no existe autorización tácita (Art. 34 Regl. MAPE)' },
  { re: /(?:puede|podr[áa])\s+(?:trabajar|operar|extraer)\s+mientras\s+se\s+tramita/i, label: '"puede trabajar mientras se tramita" — no existe autorización tácita' },

  // Organismos sin instrumento formalizado
  { re: /\bPNUD\b/, label: 'mención de PNUD — prohibida hasta instrucción expresa' },
  { re: /\bUNDP\b/, label: 'mención de UNDP — prohibida hasta instrucción expresa' },
  { re: /naciones\s+unidas/i, label: 'mención de Naciones Unidas — prohibida hasta instrucción expresa' },
  { re: /united\s+nations/i, label: 'mención de United Nations — prohibida hasta instrucción expresa' },

  // Institución financiera: no se nombra en superficies públicas ni en
  // archivos del repositorio hasta que el convenio esté firmado — usar
  // "cooperativa financiera aliada".
  { re: /finacoop/i, label: 'FINACOOP — usar "cooperativa financiera aliada" hasta convenio firmado', scope: 'all' },

  // Contrapartes y términos económicos (limpieza 2026-08): el repositorio es
  // público — ningún archivo expone contrapartes sin convenio ni márgenes.
  { re: /chiopa/i, label: '"Chiopa" — contraparte sin anexo contractual público; usar "refinería de destino"', scope: 'all' },
  { re: /8[05]\s*%\s*del\s+precio/i, label: 'cifra de margen comercial — remite a la Política de Precios versionada', scope: 'all' },
  { re: /8[05]\s*%\s*of\s+the\s+(international|reference)/i, label: 'cifra de margen comercial (variante EN) — remite a la Política de Precios versionada', scope: 'all' },

  // Entidades no constituidas / marca no registrada
  { re: /asociaci[óo]n\s+de\s+mineros\s+mape/i, label: '"Asociación de Mineros MAPE" — entidad no constituida' },
  { re: /[™®]/, label: 'símbolo ™/® — la marca no está registrada ante DGPI' },
]

/* ── Reglas de vigencia — sentencia SCO-0090-2014 (Playbook CC, 2026-08) ──
 *
 * La sentencia de la Sala de lo Constitucional (Gaceta No. 37,158,
 * 2026-06-03) anuló los Arts. 22, 39, 43, 47, 48, 67 y 68 de la Ley General
 * de Minería. Reglas:
 *  1. FALLA un Art. 22/39/43/48/67/68 en contexto de "Ley General de
 *     Minería" / "LGM" (misma línea o ±2) sin marca de anulación en la misma
 *     línea o adyacente.
 *  2. FALLA un "Art. 47" sin la palabra "Reglamento" en la misma línea
 *     (el Art. 47 vigente y frecuente es el del Reglamento Especial MAPE;
 *     el 47 de la Ley está anulado). Excepción: líneas con marca.
 *
 * Calibración contra falsos positivos (documentada):
 *  - "Reglamento" en la misma línea exime también la regla 1 — los Arts. 45
 *    y 47 del Reglamento son válidos y frecuentes, y la sección MARCO LEGAL
 *    del prompt cita artículos del Acuerdo 042-2013 por número.
 *  - La marca acepta, además de "[ANULADO" y "SCO-0090-2014", las palabras
 *    "anulado/a(s)" e "inconstitucional(es)": una línea que declara la
 *    anulación es exactamente el uso correcto, no una cita como derecho
 *    vigente.
 *  - Los transcritos de la Ley General del AMBIENTE viven en data/ (fuera de
 *    este alcance) y la regla 1 exige contexto de minería.
 */
const VIGENCIA_SCAN_DIRS = ['lib', 'docs', 'services']
const VIGENCIA_EXCLUDED_FILES = new Set([
  join('docs', 'legal', 'sentencia-sco-0090-2014.md'),
  join('lib', 'legal', 'vigenciaLGM.ts'),
])
const LGM_CONTEXT_RE = /ley\s+general\s+de\s+miner[íi]a|ley\s+de\s+miner[íi]a|\bLGM\b/i
const VIGENCIA_MARK_RE = /\[ANULADO|SCO-0090-2014|\banulad[oa]s?\b|inconstitucional/i
const ART_TOKEN = String.raw`\bart(?:s|ículos?|iculos?)?\.?\s*`
const ART_ANULADO_RE = new RegExp(ART_TOKEN + String.raw`(22|39|43|48|67|68)\b`, 'i')
const ART_47_RE = new RegExp(ART_TOKEN + String.raw`47\b`, 'i')
const VIGENCIA_CONTEXT_WINDOW = 2 // líneas ±N para detectar contexto LGM
const VIGENCIA_MARK_WINDOW = 1 // "misma línea o adyacente" para la marca

function checkVigencia(rel, lines) {
  let found = 0
  const near = (re, i, w) => {
    for (let j = Math.max(0, i - w); j <= Math.min(lines.length - 1, i + w); j++) {
      if (re.test(lines[j])) return true
    }
    return false
  }
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return
    if (/reglamento/i.test(line)) return
    const m = line.match(ART_ANULADO_RE)
    if (m && near(LGM_CONTEXT_RE, i, VIGENCIA_CONTEXT_WINDOW) && !near(VIGENCIA_MARK_RE, i, VIGENCIA_MARK_WINDOW)) {
      found++
      console.log(`${rel}:${i + 1} — «${m[0]}» → artículo anulado por SCO-0090-2014 citado en contexto de la Ley General de Minería sin marca [ANULADO]`)
    }
    const m47 = line.match(ART_47_RE)
    if (m47 && !near(VIGENCIA_MARK_RE, i, VIGENCIA_MARK_WINDOW)) {
      found++
      console.log(`${rel}:${i + 1} — «${m47[0]}» → "Art. 47" debe decir "Art. 47, literal (a), del Reglamento Especial MAPE" (el 47 de la Ley está anulado)`)
    }
  })
  return found
}

function walk(dir, out = [], applyExcluded = true) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (applyExcluded && EXCLUDED.some((ex) => rel === ex || rel.startsWith(ex + '/') || rel.startsWith(ex + '\\'))) continue
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out, applyExcluded)
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

const CONFIDENTIAL_RULES = RULES.filter((r) => r.scope === 'all')

const publicFiles = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
const internalFiles = [
  ...INTERNAL_SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))),
  ...ROOT_FILES.map((f) => join(ROOT, f)).filter((f) => {
    try {
      return statSync(f).isFile()
    } catch {
      return false
    }
  }),
]
// app/api está en EXCLUDED para el alcance público — se recorre aparte, sin
// aplicar EXCLUDED, y solo con las reglas de confidencialidad.
const confidentialityAlsoFiles = CONFIDENTIALITY_ALSO_DIRS.flatMap((d) =>
  walk(join(ROOT, d), [], false)
)
const publicSet = new Set(publicFiles)
const confidentialFiles = [...internalFiles, ...confidentialityAlsoFiles]
const targets = [
  ...publicFiles.map((f) => ({ file: f, rules: RULES })),
  ...confidentialFiles.filter((f) => !publicSet.has(f)).map((f) => ({ file: f, rules: CONFIDENTIAL_RULES })),
]
let violations = 0

for (const { file, rules } of targets) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return
    for (const rule of rules) {
      const match = line.match(rule.re)
      if (match) {
        violations++
        console.log(`${rel}:${i + 1} — «${match[0]}» → ${rule.label}`)
      }
    }
  })
}

// Pase de vigencia (SCO-0090-2014): lib/, docs/, services/ y *.md de la raíz.
const vigenciaRootMd = readdirSync(ROOT)
  .filter((f) => f.endsWith('.md'))
  .map((f) => join(ROOT, f))
const vigenciaFiles = [
  ...VIGENCIA_SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))),
  ...vigenciaRootMd,
].filter((f) => !VIGENCIA_EXCLUDED_FILES.has(relative(ROOT, f)))

for (const file of vigenciaFiles) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  violations += checkVigencia(rel, lines)
}

if (violations > 0) {
  console.error(`\ncheck:copy — ${violations} violación(es) encontrada(s).`)
  process.exit(1)
}
console.log(`check:copy — sin violaciones (${targets.length} archivos escaneados + ${vigenciaFiles.length} en el pase de vigencia).`)
