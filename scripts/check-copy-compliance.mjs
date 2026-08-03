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
 *  - app/api        — código de servidor, no copy público; incluye
 *                     app/api/whatsapp, intocable por restricción §1.3.
 *  - app/admin      — panel interno autenticado, fuera del sitio público.
 *  - app/dashboard  — superficie interna autenticada.
 *  - app/portal     — superficie interna autenticada.
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
const ROOT_FILES = ['README.md', 'CLAUDE.md', 'MARIA.md', 'AGENTS.md', 'DESIGN.md']
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

  // Entidades no constituidas / marca no registrada
  { re: /asociaci[óo]n\s+de\s+mineros\s+mape/i, label: '"Asociación de Mineros MAPE" — entidad no constituida' },
  { re: /[™®]/, label: 'símbolo ™/® — la marca no está registrada ante DGPI' },
]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (EXCLUDED.some((ex) => rel === ex || rel.startsWith(ex + '/') || rel.startsWith(ex + '\\'))) continue
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
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
const publicSet = new Set(publicFiles)
const targets = [
  ...publicFiles.map((f) => ({ file: f, rules: RULES })),
  ...internalFiles.filter((f) => !publicSet.has(f)).map((f) => ({ file: f, rules: CONFIDENTIAL_RULES })),
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

if (violations > 0) {
  console.error(`\ncheck:copy — ${violations} violación(es) encontrada(s).`)
  process.exit(1)
}
console.log(`check:copy — sin violaciones (${targets.length} archivos escaneados).`)
