#!/usr/bin/env node
/**
 * check-neutralidad-politica.mjs — gate de neutralidad política y de
 * "sin compradores nombrados" para TODO lo que alimenta a María
 * (hotfix/neutralidad-politica, 11-nov-2026).
 *
 * Alcance (SCAN_PATHS): lib/maria/**, docs/rag-maria/**, data/maria-knowledge/**,
 * app/api/maria/**, app/api/whatsapp/**, components/landing/MariaWidget.tsx.
 *
 * Falla (exit 1) si una línea contiene:
 *  1. Un comprador nombrado: zekaii | chiopa | liopa | alfilo (sin distinguir
 *     mayúsculas). Sin excepciones — María nunca nombra compradores.
 *  2. Un término político partidario hondureño: partidos (Partido Nacional,
 *     Partido Liberal, Libre / Libertad y Refundación, PSH, PINU, Democracia
 *     Cristiana), "candidato/a … presidencial|del partido|a diputado|a alcalde",
 *     "elecciones generales|presidenciales|primarias|internas|de AAAA", "proceso
 *     electoral", "campaña electoral", "partido político". ("candidato" a secas
 *     NO: CRAFT usa "grupo candidato" como estatus técnico y el código usa
 *     "candidates" en inglés.)
 *  3. Un político hondureño por nombre completo: Xiomara Castro, Nasry Asfura,
 *     Salvador Nasralla, Juan Orlando Hernández, (José) Manuel Zelaya Rosales,
 *     Rixi Moncada, Luis Zelaya. Nunca el apellido suelto ("Zelaya" también es
 *     apellido de datos demo del repo)... SALVO precedido de un cargo o
 *     referencia de gobierno (regla 3b, 2026-11-11): "presidente/a Zelaya",
 *     "administración Castro", "gobierno (de) Asfura", "mandatario Hernández",
 *     "gestión Lobo", etc. — apellidos de la lista APELLIDOS_GOBERNANTES.
 *
 * Exenciones calibradas (documentadas, revisables):
 *  - La PROPIA regla de neutralidad: una línea que dice "no opina", "no trata",
 *    "nunca opinés", "no habla(r) de política", "neutralidad" o "sin opinar" —
 *    o la línea inmediatamente adyacente a una de esas (la regla del prompt
 *    ocupa dos renglones) — está describiendo la prohibición, no violándola
 *    (prompt de María y secciones «Lo que María NO debe decir» de las fichas).
 *  - Atribución factual de un instrumento legal (solo para la regla 3): el
 *    nombre de un presidente como FIRMANTE o ADMINISTRACIÓN EMISORA de un
 *    decreto transcrito (bloque de firma "PRESIDENTE DE LA REPÚBLICA" en la
 *    línea o en la adyacente; "presidente_constitucional:", "Administración:",
 *    "emisor:", "poder_ejecutivo"). Es un dato del documento, no opinión. El
 *    SQL hotfix_rag_neutralidad_y_fichas_v2.sql redacta igualmente esos nombres en
 *    producción; aquí no se borran los transcritos de data/.
 *
 * Las listas son EXTENSIBLES: agregar entradas a PARTIDOS / POLITICOS /
 * COMPRADORES abajo (una por línea, con comentario de fecha).
 *
 * Uso: node scripts/check-neutralidad-politica.mjs   (o: npm run check:neutralidad)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_PATHS = [
  'lib/maria',
  'docs/rag-maria',
  'data/maria-knowledge',
  join('app', 'api', 'maria'),
  join('app', 'api', 'whatsapp'),
  join('components', 'landing', 'MariaWidget.tsx'),
]
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx', '.sql', '.json', '.txt']

// ── Listas extensibles ──────────────────────────────────────────────────────
// Compradores (2026-11-11): ningún comprador se nombra en el cerebro de María.
const COMPRADORES = /\b(zekaii|chiopa|liopa|alfilo)\b/i

// Partidos / términos partidarios hondureños (2026-11-11).
const PARTIDOS = [
  /partido\s+nacional/i,
  /partido\s+liberal/i,
  /partido\s+libre\b/i,
  /libertad\s+y\s+refundaci[oó]n/i,
  /\(libre\)/i,
  /partido\s+salvador\s+de\s+honduras/i,
  /\bPSH\b/,
  /\bPINU\b/,
  /democracia\s+cristiana/i,
  // "candidato/a" solo en contexto electoral: CRAFT usa "grupo candidato" como
  // estatus técnico y el código usa "candidates"/"candidateHost" (inglés).
  /candidat(?:o|a|os|as|ura|uras)\s+(?:presidencial|a\s+la\s+presidencia|del\s+partido|a\s+diputad|a\s+alcald|pol[ií]tic)/i,
  /\belecciones\s+(?:generales|presidenciales|primarias|internas|de\s+\d{4})\b|\bprocesos?\s+electoral(?:es)?\b|\bcampa[ñn]a\s+electoral\b/i,
  /partidos?\s+pol[ií]ticos?/i,
]

// Políticos hondureños — SIEMPRE nombre completo (2026-11-11).
const POLITICOS = [
  /xiomara\s+castro/i,
  /nasry\s+asfura/i,
  /salvador\s+nasralla/i,
  /juan\s+orlando\s+hern[aá]ndez/i,
  /(jos[eé]\s+)?manuel\s+zelaya\s+rosales/i,
  /rixi\s+moncada/i,
  /luis\s+zelaya/i,
]

// 3b (2026-11-11): cargo o referencia de gobierno + apellido de un gobernante
// hondureño. "presidente Zelaya", "administración Castro", "gobierno de Asfura".
// Lista extensible (apellidos de presidentes desde 1982).
const APELLIDOS_GOBERNANTES =
  'Zelaya|Castro|Asfura|Hern[aá]ndez|Nasralla|Lobo|Micheletti|Maduro|Flores|Callejas|Reina|Azcona|Suazo|Moncada'
const CARGO_APELLIDO_RE = new RegExp(
  String.raw`\b(president[ea]|administraci[oó]n|gobierno|mandatari[oa]|gesti[oó]n|r[eé]gimen|era)\s+(?:de\s+|del\s+)?(?:${APELLIDOS_GOBERNANTES})\b`,
  'i',
)

// Una línea que ENUNCIA la regla de neutralidad no la viola.
const NEUTRALIDAD_RULE_RE =
  /\b(no|nunca|ni|jam[aá]s)\b[^.;]{0,60}\b(opin|trat[aáe]|habl|coment|califiqu|repit|amplifiqu)|no\s+habla(r)?\s+de\s+pol[ií]tica|neutralidad|sin\s+opinar/i

// Atribución factual (solo regla 3): firmante / administración emisora de un
// instrumento legal transcrito, en la línea o en la adyacente.
const ATTRIBUTION_RE =
  /presidente_constitucional|presidente_congreso|poder_ejecutivo|president[ea]\s+(constitucional|de\s+la\s+rep[uú]blica)|\badministraci[oó]n:|\bemisor"?\s*:|\*\*emisor|\bsancion[oó]\b|\bfirma(do|n)?\b/i

function walk(p, out = []) {
  let st
  try {
    st = statSync(p)
  } catch {
    return out
  }
  if (st.isFile()) {
    if (EXTENSIONS.some((e) => p.endsWith(e))) out.push(p)
    return out
  }
  for (const entry of readdirSync(p)) walk(join(p, entry), out)
  return out
}

const files = SCAN_PATHS.flatMap((p) => walk(join(ROOT, p)))
let violations = 0

for (const file of files) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  const near = (re, i) =>
    [i - 1, i, i + 1].some((j) => j >= 0 && j < lines.length && re.test(lines[j]))
  lines.forEach((line, i) => {
    const m1 = line.match(COMPRADORES)
    if (m1) {
      violations++
      console.log(`${rel}:${i + 1} — «${m1[0]}» → comprador nombrado — prohibido en el prompt, el RAG y las respuestas de María`)
    }
    const rule = near(NEUTRALIDAD_RULE_RE, i)
    for (const re of PARTIDOS) {
      const m = line.match(re)
      if (m && !rule) {
        violations++
        console.log(`${rel}:${i + 1} — «${m[0]}» → término político partidario — María no trata temas políticos`)
      }
    }
    for (const re of POLITICOS) {
      const m = line.match(re)
      if (m && !rule && !near(ATTRIBUTION_RE, i)) {
        violations++
        console.log(`${rel}:${i + 1} — «${m[0]}» → político nombrado fuera de una atribución legal factual — María no trata temas políticos`)
      }
    }
    const m3b = line.match(CARGO_APELLIDO_RE)
    if (m3b && !rule && !near(ATTRIBUTION_RE, i)) {
      violations++
      console.log(`${rel}:${i + 1} — «${m3b[0]}» → gobernante referido por cargo + apellido — usar el período o el órgano (p. ej. "el Poder Ejecutivo en 2006", "la administración 2022–2026")`)
    }
  })
}

if (violations > 0) {
  console.error(`\ncheck:neutralidad — ${violations} violación(es) en ${files.length} archivos.`)
  process.exit(1)
}
console.log(`check:neutralidad — sin violaciones (${files.length} archivos escaneados).`)
