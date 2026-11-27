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
 *                     reglas de confidencialidad (scope: 'all') y, desde el
 *                     hotfix 2026-11-11, con las de código (scope: 'code').
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
 * ─── DEC-2026-11-26-1 / DEC-2026-11-27-2 — modelo público vigente ──────────
 * Corporación Hondureña Tenka, S.A. (CHT) es titular, desarrolladora y
 * operadora de MAPE.LEGAL; presta servicios legales y mineros; NO compra ni
 * vende mineral, NO administra fondos y cobra tarifas fijas o por servicio,
 * nunca ligadas al valor ni al volumen del oro. NUNCA se nombra a un comprador.
 * El precio público es el precio internacional del oro en lempiras por gramo
 * de oro fino, SOLO INFORMATIVO y SIN factor (oro USD/oz × tipo de COMPRA del
 * BCH ÷ 31.1034768), SIEMPRE con el aviso literal AVISO_PRECIO_INFORMATIVO.
 * El "Precio referencial (75%)" del hotfix 11-nov-2026 quedó SUPERADO: NINGÚN
 * porcentaje de la referencia internacional (75/80/85/90 %) es publicable.
 * Reglas vigentes (resumen; el detalle está en RULES y en checkIdentidad):
 *  - Porcentajes como factor de precio ("precio referencial (75 %)", "× 0,75",
 *    "80 % del LBMA", "de la referencia") → bloqueados en público, María y
 *    código. Exentos, de forma estrecha: la ley nominal de kilates ("18k =
 *    75 % de oro fino", "kilates ÷ 24"), la recuperación de equipo claramente
 *    etiquetada (app/equipos/page.tsx) y los anchos CSS (no llevan contexto).
 *  - "precio de compra" / "compra(mos) (de) oro": la plataforma no compra; pasan
 *    las negaciones y las publicaciones de los PARTICIPANTES del marketplace
 *    ("cada participante publica… precio de compra").
 *  - "certificado/reconocido/acreditado" predicados del estándar, del sello o
 *    de OCDE/LBMA/CRAFT/INHGEOMIN → bloqueados. Exentos: Certificado de Origen /
 *    Certificación de Procedencia (acto oficial), "Verificar certificado" (nav)
 *    y las negaciones ("no implica certificación…", "no está certificado").
 *  - Exclusividad de compra (comprador exclusivo, venta/mercado exclusivo,
 *    destino único) → bloqueada; pasa la negación ("sin exclusividad de compra",
 *    "ni un destino único").
 *  - Alianzas: Finacop / planetGOLD / PNUD solo con la redacción calificada
 *    (carta de intención, MOU en proceso, en evaluación, en preparación);
 *    "convenio/alianza firmado|vigente|suscrito" con ellas → bloqueado (todo el
 *    repo). FINACOOP (grafía antigua) sigue bloqueado.
 *  - Etiquetas falsas de fuente: "LBMA oficial" / "fixing" / "BCH" / "Banco
 *    Central" junto a exchangerate-api, goldapi o Yahoo en la misma línea →
 *    bloqueado en código y público; pasan las negaciones ("nunca", "no es").
 *    "exchangerate-api" como fuente del tipo de cambio → bloqueado en código.
 *  - Identidad (checkIdentidad): lib/content/copy-legal.ts DEBE contener "no
 *    administra fondos" y "tarifas fijas o por servicio" + "nunca ligadas al
 *    valor ni al volumen del oro"; /quienes-somos, la portada y /aviso-legal
 *    DEBEN importar IDENTIDAD_FONDOS_TARIFAS o ROL_CHT.
 *  - Compradores nombrados (zekaii|chiopa|liopa|alfilo, Inversiones CKI /
 *    CKI) → bloqueados en código y público. "90 kg" → bloqueado en público.
 *  - Se mantienen: ™/®, aval de INHGEOMIN, consulta 169 "completada",
 *    "certificados emitidos por MAPE", "Registro INHGEOMIN" a secas, "MAPE.LEGAL
 *    emite", "en vivo"/"tiempo real" (la cadencia del oro es diaria) y el pase
 *    de vigencia SCO-0090-2014.
 *
 * Alcances (`scope` de cada regla):
 *  - (sin scope) → copy público: SCAN_DIRS (app/ sin api|admin|dashboard|portal,
 *    components/, lib/content/).
 *  - 'all'   → público + INTERNAL_SCAN_DIRS + ROOT_FILES + app/api (confidencialidad).
 *  - 'code'  → público + lib/ (completo) + services/ + app/api.
 *  - 'maria' → público + lib/maria.
 *
 * Una regla puede llevar `exclude`: si la línea también matchea esa expresión
 * (negación requerida), no se reporta.
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
const INTERNAL_SCAN_DIRS = ['docs', 'lib/maria', 'lib/precio', 'services']
const ROOT_FILES = ['README.md', 'CLAUDE.md', 'MARIA.md', 'MARIA_LEY_MINERIA.md', 'AGENTS.md', 'DESIGN.md']
// Tercer alcance (orden "Blindaje institucional de María" 2026-08, T2.4):
// app/api deja de estar totalmente exento — se escanea con las reglas de
// confidencialidad (`scope: 'all'`) y de código (`scope: 'code'`), no con las
// reglas de copy público (es código de servidor, no copy).
const CONFIDENTIALITY_ALSO_DIRS = [join('app', 'api')]
// Alcance 'code' (hotfix 2026-11-11): todo el código que puede terminar en una
// respuesta o superficie — lib/ completo, services/ y app/api. Excluye docs/ y
// los *.md de la raíz (decisión pendiente de Willis).
const CODE_SCAN_DIRS = ['lib', 'services', join('app', 'api')]
// Alcance 'maria' (hotfix 2026-11-11): promesas de pago — público + prompt de María.
const MARIA_SCAN_DIRS = ['lib/maria']
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

// Negación / prohibición en la misma línea: "no compra", "nunca un precio de
// compra", "nadie compra oro", "NUNCA prometas …", "no es una oferta de compra".
const NEGACION_RE = /\b(?:no|nunca|nadie|jam[aá]s|ni|tampoco|prohibid[oa]s?)\b/i

// "precio de compra" / "compra oro" exentos: negación, o atribuidos a los
// PARTICIPANTES que publican sus propios precios en el marketplace abierto.
const COMPRA_EXENTA_RE =
  /\b(?:no|nunca|nadie|jam[aá]s|ni|tampoco|prohibid[oa]s?)\b|\bparticipantes?\b|\bpublica(?:n|r|da|das|ciones?)?\b|\bcada\s+(?:participante|comprador|productor)\b|\bprecios?\s+(?:a\s+los?\s+que|al\s+que)\s+compra/i

// Porcentajes exentos: ley nominal de kilates ("18k = 75 % de oro fino",
// "kilates ÷ 24"), recuperación de equipo, CSS (opacity/width) y las líneas que
// declaran el modelo SUPERADO o prohíben el porcentaje.
const FACTOR_EXENTO_RE =
  /\b(?:1[0-9]|2[0-4])\s?k\b|kilat|ley\s+nominal|de\s+oro\s+fino\)|recuperaci[oó]n|opacity|width|superad[oa]|retirad[oa]|hist[oó]ric|\bnunca\b|\bni\b|\bno\b|\bsin\b|ning[úu]n|prohibid|bloquea|falla/i

// Alianzas: la redacción calificada pasa; también las líneas que la describen
// o la prohíben (reglas, comentarios de la fuente única).
const ALIANZA_CALIFICADA_RE =
  /carta\s+de\s+intenci[oó]n|\bMOU\b|memorando\s+de\s+entendimiento|en\s+evaluaci[oó]n|en\s+preparaci[oó]n|letter\s+of\s+intent|ALIANZAS_|redacci[oó]n\s+calificada|\bno\b|\bnunca\b|\bsin\b/i

// Certificación exenta: Certificado de Origen / Certificación de Procedencia
// (acto oficial), "Verificar certificado", y las negaciones ("no implica
// certificación", "no está certificado", "NUNCA afirmés…").
const CERT_EXENTA_RE =
  /certificad[oa]\s+de\s+origen|certificaci[oó]n\s+de\s+procedencia|verificar\s+(?:un\s+)?certificado|\bno\b|\bnunca\b|\bni\b|\bsin\b|no\s+implica|tampoco/i

// Fuente negada: "nunca 'LBMA oficial'", "no es el fixing", "ya no alimenta".
const FUENTE_NEGADA_RE = /\b(?:nunca|never|no|not|ni|jam[aá]s|tampoco|dej[oó]\s+de|ya\s+no|antes|hist[oó]ric|anterior|legacy|retir)\b/i

/**
 * Cada regla: expresión regular (insensible a mayúsculas donde aplica) y
 * la razón de la prohibición. Las reglas cubren las expresiones de la
 * tabla §1.1 y sus variantes semánticas directas.
 */
const RULES = [
  // Exclusividad / venta atada (Art. 37 LGM: comercialización libre)
  { re: /mercados?\s+exclusivos?/i, label: '"mercados exclusivos" — la comercialización es libre (Art. 37 LGM)' },
  { re: /acceso\s+exclusivo/i, label: '"acceso exclusivo" — la comercialización es libre (Art. 37 LGM)' },
  // DEC-2026-11-27-2: la negación ("sin exclusividad de compra", "no otorga
  // exclusividad") es copy requerido del marketplace abierto y pasa.
  { re: /exclusividad/i, exclude: /\b(?:sin|no\s+(?:otorga|hay|existe)|ninguna)\s+exclusividad/i, label: '"exclusividad" — la comercialización es libre (Art. 37 LGM); solo pasa la negación ("sin exclusividad de compra")' },
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

  // Alianzas (DEC-2026-11-26-1 / DEC-2026-11-27-2). Redacción calificada
  // PERMITIDA: "carta de intención enviada", "MOU en proceso", "en evaluación",
  // "carta de intención en preparación". Cualquier otra mención de Finacop,
  // planetGOLD o PNUD, y toda formulación "firmada/vigente/suscrita", falla.
  { re: /\b(?:convenio|alianza|acuerdo|contrato)s?\s+(?:firmad|vigente|suscrit|formalizad)[oa]?s?\b[^.\n]{0,80}\b(?:finacop|planet\s?gold|pnud|undp)\b/i, label: 'alianza descrita como firmada/vigente con Finacop, planetGOLD o PNUD — solo se publica la redacción calificada (carta de intención, MOU en proceso, en evaluación)', scope: 'all' },
  { re: /\b(?:finacop|planet\s?gold|pnud|undp)\b[^.\n]{0,80}\b(?:convenio|alianza|acuerdo|contrato)s?\s+(?:firmad|vigente|suscrit|formalizad)/i, label: 'alianza descrita como firmada/vigente con Finacop, planetGOLD o PNUD — solo se publica la redacción calificada', scope: 'all' },
  { re: /\b(?:finacop|planet\s?gold|pnud|undp)\b/i, exclude: ALIANZA_CALIFICADA_RE, label: 'mención de Finacop / planetGOLD / PNUD fuera de la redacción calificada (carta de intención, MOU en proceso, en evaluación, en preparación)' },
  { re: /naciones\s+unidas/i, label: 'mención de Naciones Unidas — usar "planetGOLD (PNUD)" solo en la redacción calificada' },
  { re: /united\s+nations/i, label: 'mención de United Nations — prohibida' },

  // Grafía antigua de la institución financiera: sigue sin nombrarse en todo
  // el repositorio — usar "cooperativa financiera aliada" o la redacción
  // calificada de alianzas (Finacop).
  { re: /finacoop/i, label: 'FINACOOP — usar "cooperativa financiera aliada" o la redacción calificada de alianzas', scope: 'all' },

  // Compradores nombrados: prohibidos en código y en superficies públicas —
  // María y el sitio no nombran a ningún comprador. docs/ y los *.md de la
  // raíz quedan fuera (decisión pendiente de Willis).
  { re: /\b(zekaii|chiopa|liopa|alfilo)\b/i, label: 'comprador nombrado — prohibido en código y superficies públicas', scope: 'code' },
  // Inversiones CKI (DEC-2026-11-26-1): no se menciona. "CKI" en mayúsculas y
  // con límites de palabra para evitar falsos positivos dentro de otras palabras.
  { re: /\bInversiones\s+CKI\b|\bCKI\b/, label: 'Inversiones CKI / CKI — no se menciona en código ni superficies públicas', scope: 'code' },
  // Modelo descartado (venta directa del productor a la refinería) — sigue
  // prohibido en todo el repo, docs incluidos.
  { re: /chiopa\s+compra\s+(directo|directamente)/i, label: '"… compra directo" — modelo descartado; la plataforma no intermedia ventas', scope: 'all' },

  // Cifras de margen comercial (confidencialidad, todo el repo).
  { re: /8[05]\s*%\s*del\s+precio/i, label: 'cifra de margen comercial — remite a la Política de publicación versionada', scope: 'all' },
  { re: /8[05]\s*%\s*of\s+the\s+(international|reference)/i, label: 'cifra de margen comercial (variante EN) — remite a la Política de publicación versionada', scope: 'all' },

  // Porcentajes como FACTOR DE PRECIO (DEC-2026-11-26-1): ningún 75/80/85/90 %
  // del LBMA / de la referencia internacional / del precio es publicable, ni
  // "precio referencial (NN %)", ni "× 0,75". Exenciones estrechas (exclude):
  // ley nominal de kilates, recuperación de equipo, CSS. Público + María + código.
  { re: /\b(?:7[05]|8[05]|90)\s*%\s*(?:del?\s+(?:precio|valor|LBMA|oro)|de\s+la\s+(?:referencia|LBMA|cotizaci[oó]n)|LBMA|de\s+la\s+referencia\s+internacional)/i, exclude: FACTOR_EXENTO_RE, label: 'porcentaje de la referencia internacional como factor de precio — el precio público es solo informativo y sin factor', scope: 'code' },
  { re: /precio\s+referencial\s*\(\s*\d{2}\s*%?\s*\)/i, exclude: FACTOR_EXENTO_RE, label: '"precio referencial (NN %)" — modelo superado (DEC-2026-11-26-1); usar el precio informativo sin factor', scope: 'code' },
  { re: /[×x]\s*0[.,](?:75|8|80|85|9|90)\b/i, exclude: FACTOR_EXENTO_RE, label: '"× 0,75 / 0,80 / 0,90" — factor de compra en una fórmula pública; la fórmula vigente no lleva factor', scope: 'code' },
  { re: /\bfactor\s+(?:de\s+)?(?:compra|referenci(?:a|al)|comercializaci[oó]n)\b/i, exclude: FACTOR_EXENTO_RE, label: '"factor de compra/referencial" en copy público — el precio informativo no lleva factor' },

  // Volumen comprometido (DEC-2026-11-26-1): la cifra de 90 kg/mes no se publica.
  { re: /\b90\s*kg\b/i, label: '"90 kg" — cifra de volumen no publicable' },

  // La plataforma no compra: "precio de compra" / "compra(mos) oro" solo en
  // negación o referidos a las PUBLICACIONES DE LOS PARTICIPANTES del marketplace
  // (DEC-2026-11-27-2: cada participante publica sus precios de compra y venta).
  { re: /precio\s+de\s+compra/i, exclude: COMPRA_EXENTA_RE, label: '"precio de compra" — la plataforma no compra: usar el precio informativo (o atribuirlo al participante que publica)' },
  { re: /\bcompra(?:mos)?\s+(?:de\s+)?oro\b/i, exclude: COMPRA_EXENTA_RE, label: '"compra(mos) (de) oro" — la plataforma no compra: usar el precio informativo' },

  // Certificación / reconocimiento / acreditación del estándar o por OCDE,
  // LBMA, CRAFT o INHGEOMIN (DEC-2026-11-26-1): solo "alineado con". Exentos:
  // el Certificado de Origen / Certificación de Procedencia (acto oficial),
  // "Verificar certificado" y las negaciones.
  { re: /\b(?:certificad|reconocid|acreditad|avalad)[oa]s?\s+(?:por|ante)\s+(?:la\s+|el\s+)?(?:OCDE|LBMA|CRAFT|INHGEOMIN|ARM|OECD)\b/i, exclude: CERT_EXENTA_RE, label: '"certificado/reconocido/acreditado por OCDE/LBMA/CRAFT/INHGEOMIN" — el estándar está ALINEADO con esas guías; no está certificado ni acreditado', scope: 'maria' },
  { re: /\b(?:est[áa]ndar|sello|plataforma|MAPE\.?\s?LEGAL)\s+(?:est[áa]\s+|es\s+|queda\s+)?(?:certificad|reconocid|acreditad)[oa]s?\b/i, exclude: CERT_EXENTA_RE, label: '"estándar/sello/plataforma certificado|reconocido|acreditado" — usar "alineado con OCDE/LBMA"', scope: 'maria' },
  { re: /\bcertificaci[oó]n\s+(?:OCDE|LBMA|CRAFT|INHGEOMIN|internacional)\b/i, exclude: CERT_EXENTA_RE, label: '"certificación OCDE/LBMA/CRAFT/INHGEOMIN" — el estándar está alineado, no certificado', scope: 'maria' },

  // Exclusividad de compra / destino único (DEC-2026-11-27-2): el marketplace
  // es abierto. Pasa la negación ("sin destino único", "ni un destino único").
  // Sin \b delante de "único": en JS \b es ASCII y no reconoce la vocal acentuada.
  { re: /\bcomprador\s+exclusivo\b|(?<![\wáéíóúñ])(?:[úu]nico\s+destino|destino\s+[úu]nico)\b|\bmercado\s+exclusivo\b/i, exclude: /\b(?:sin|ni\s+(?:un\s+)?|no\s+(?:hay|existe|otorga|es)\s+(?:un\s+)?|ning[úu]n)\s*(?:comprador\s+exclusivo|[úu]nico\s+destino|destino\s+[úu]nico|mercado\s+exclusivo)/i, label: 'comprador exclusivo / destino único — el marketplace es abierto, sin exclusividad de compra' },

  // Etiquetas falsas de fuente (DEC-2026-11-26-1): no llamar "LBMA oficial" o
  // "fixing" al feed (goldapi / Yahoo) ni "BCH" a un tipo de cambio que no
  // venga del BCH (exchangerate-api). Pasan las negaciones ("nunca", "no es").
  // Atribución directa: "BCH (exchangerate-api.com)", "LBMA oficial (goldapi.io)",
  // "goldapi… como LBMA oficial". Una lista de upstreams ("GoldAPI / Yahoo / BCH")
  // no es una atribución y no dispara.
  { re: /(?:\bBCH\b|banco\s+central|LBMA\s+oficial|fixing\s+(?:de\s+la\s+)?LBMA|LBMA\s+fix)[^.\n(]{0,30}\([^)]*(?:exchangerate|goldapi|yahoo)/i, exclude: FUENTE_NEGADA_RE, label: 'etiqueta "BCH" / "LBMA oficial" junto a exchangerate-api / goldapi / Yahoo — la fuente real no es esa; etiquetar con honestidad', scope: 'code' },
  { re: /(?:exchangerate|goldapi|yahoo)[^.\n]{0,40}\b(?:como|=|es\s+(?:el|la)|equivale\s+a)\s+(?:el\s+|la\s+)?(?:\bBCH\b|banco\s+central|LBMA\s+oficial|fixing)/i, exclude: FUENTE_NEGADA_RE, label: 'exchangerate-api / goldapi / Yahoo presentado como "BCH" o "LBMA oficial" — etiquetar con la fuente real', scope: 'code' },
  { re: /tipo\s+de\s+cambio[^.\n]{0,60}exchangerate|exchangerate[^.\n]{0,60}tipo\s+de\s+cambio/i, exclude: FUENTE_NEGADA_RE, label: 'exchangerate-api como fuente del tipo de cambio — lo público usa únicamente el tipo de compra del BCH (o "dato no disponible")', scope: 'code' },

  // Promesas de pago (hotfix 2026-11-11): la plataforma no paga ni cobra el oro.
  // Pasa cuando la línea lo prohíbe ("NUNCA prometas 'pago el mismo día'").
  { re: /pago\s+(?:el\s+)?mismo\s+d[ií]a|dep[óo]sito\s+(?:el\s+)?mismo\s+d[ií]a/i, exclude: /\b(?:nunca|no|ni|jam[aá]s)\b[^.]{0,40}\b(?:promet|afirm|dig[aá]s|garantic|ofrezc)/i, label: '"pago/depósito el mismo día" — promesa de pago prohibida; la plataforma no paga ni cobra el oro', scope: 'maria' },

  // Quién es quién (hotfix 2026-11-11): CHT es titular y operadora, pero no
  // compra mineral; el sello es complementario; el Registro de
  // Comercializadores es del comprador.
  { re: /certificados?\s+emitid[oa]s?\s+por\s+MAPE/i, label: '"certificado emitido por MAPE…" — la plataforma registra y digitaliza; el certificado lo emite el titular y lo autentica la autoridad' },
  { re: /precio\s+de\s+referencia\s+oficial|precio\s+referencial\s+oficial/i, label: '"precio referencial oficial" — el precio referencial es informativo, no oficial' },
  { re: /precio\s+oficial\s+de\s+(?:mape|cht|la\s+plataforma)/i, label: '"precio oficial de …" — el precio referencial es informativo, no oficial' },
  // Solo la forma exacta "Registro INHGEOMIN" (sin "de"): "Registro de
  // Comercializadores de INHGEOMIN" y "Registro Minero y Catastral de
  // INHGEOMIN" son correctas y pasan.
  { re: /\bregistro\s+inhgeomin\b/i, label: '"Registro INHGEOMIN" a secas — nombrar el registro concreto ("Registro de Comercializadores de INHGEOMIN", "Registro Minero y Catastral de INHGEOMIN")' },
  { re: /\bCHT\s+compra/i, exclude: NEGACION_RE, label: '"CHT compra" — CHT no compra ni vende mineral' },
  { re: /vender\s+(?:mineral\s+)?a\s+CHT\b/i, exclude: NEGACION_RE, label: '"vender (mineral) a CHT" — CHT no compra ni vende mineral' },
  { re: /a\s+nombre\s+del\s+vendedor/i, label: '"a nombre del vendedor" — el Registro de Comercializador es del comprador, no se exige al minero titular que vende su producción' },
  // Aval institucional (variantes). "no existe" / "no consta" en la misma
  // línea es la negación requerida y pasa.
  { re: /(?:adoptad|aprobad|reconocid|certificad|avalad)[oa]s?\s+por\s+INHGEOMIN/i, exclude: /no\s+(?:existe|consta|es|debe)/i, label: 'aval/adopción/reconocimiento de INHGEOMIN — no existe instrumento formal' },
  { re: /acuerdo\s+(?:de\s+)?inhgeomin/i, exclude: /no\s+(?:existe|consta)/i, label: '"Acuerdo (de) INHGEOMIN" — no existe Acuerdo en La Gaceta que respalde el sello' },
  { re: /consulta\s+(?:previa\s+)?(?:del\s+convenio\s+169\s+)?(?:completada|cumplida|realizada)/i, label: 'consulta previa "completada/cumplida/realizada" — es un derecho vigente (Convenio 169 OIT; SCO-0090-2014), no un trámite cumplido; solo consta con acta' },
  { re: /\bMAPE\s*\.?\s*LEGAL\s+emite/i, label: '"MAPE LEGAL emite" — la plataforma registra y digitaliza; no emite certificados' },

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
const CODE_RULES = RULES.filter((r) => r.scope === 'code')
const MARIA_RULES = RULES.filter((r) => r.scope === 'maria')

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
// aplicar EXCLUDED, y solo con las reglas de confidencialidad y de código.
const confidentialityAlsoFiles = CONFIDENTIALITY_ALSO_DIRS.flatMap((d) =>
  walk(join(ROOT, d), [], false)
)
const codeFiles = CODE_SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [], false))
const mariaFiles = MARIA_SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))

// Un conjunto de reglas por archivo: el público recibe TODAS; el resto, la
// unión de los alcances que lo cubren.
const ruleSets = new Map()
const addRules = (file, rules) => {
  const set = ruleSets.get(file) ?? new Set()
  for (const r of rules) set.add(r)
  ruleSets.set(file, set)
}
for (const f of publicFiles) addRules(f, RULES)
for (const f of [...internalFiles, ...confidentialityAlsoFiles]) addRules(f, CONFIDENTIAL_RULES)
for (const f of codeFiles) addRules(f, CODE_RULES)
for (const f of mariaFiles) addRules(f, MARIA_RULES)
const targets = [...ruleSets.entries()].map(([file, set]) => ({ file, rules: [...set] }))
let violations = 0

for (const { file, rules } of targets) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return
    for (const rule of rules) {
      const match = line.match(rule.re)
      if (match && rule.exclude && rule.exclude.test(line)) continue
      if (match) {
        violations++
        console.log(`${rel}:${i + 1} — «${match[0]}» → ${rule.label}`)
      }
    }
  })
}

// ── Identidad obligatoria (DEC-2026-11-26-1) ───────────────────────────────
// La fuente única de copy debe declarar que CHT / MAPE.LEGAL no administra
// fondos y cobra tarifas fijas o por servicio, nunca ligadas al valor ni al
// volumen del oro; y las superficies de identidad deben importar esas
// constantes (no reescribirlas a mano).
const IDENTIDAD_FUENTE = join('lib', 'content', 'copy-legal.ts')
const IDENTIDAD_FRASES = [
  /no\s+administran?\s+fondos/i,
  /tarifas\s+fijas\s+o\s+por\s+servicio/i,
  /nunca\s+ligadas\s+al\s+valor\s+ni\s+al\s+volumen\s+del\s+oro/i,
]
const IDENTIDAD_SUPERFICIES = [
  join('app', 'quienes-somos', 'page.tsx'),
  join('app', 'page.tsx'),
  join('app', 'aviso-legal', 'page.tsx'),
]
const IDENTIDAD_IMPORT_RE = /\b(?:IDENTIDAD_FONDOS_TARIFAS|ROL_CHT)\b/

function checkIdentidad() {
  let found = 0
  let fuente = ''
  try {
    fuente = readFileSync(join(ROOT, IDENTIDAD_FUENTE), 'utf8')
  } catch {
    console.log(`${IDENTIDAD_FUENTE} — falta la fuente única de copy legal`)
    return 1
  }
  for (const re of IDENTIDAD_FRASES) {
    if (!re.test(fuente)) {
      found++
      console.log(`${IDENTIDAD_FUENTE} — falta la frase de identidad obligatoria ${re} (no administra fondos / tarifas fijas o por servicio, nunca ligadas al valor ni al volumen del oro)`)
    }
  }
  for (const rel of IDENTIDAD_SUPERFICIES) {
    let src = ''
    try {
      src = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue // superficie inexistente en este árbol: no es violación
    }
    if (!IDENTIDAD_IMPORT_RE.test(src)) {
      found++
      console.log(`${rel} — superficie de identidad sin IDENTIDAD_FONDOS_TARIFAS ni ROL_CHT (importar desde lib/content/copy-legal.ts)`)
    }
  }
  return found
}

violations += checkIdentidad()

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
