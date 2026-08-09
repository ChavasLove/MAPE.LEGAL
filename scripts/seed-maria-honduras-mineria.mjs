/**
 * seed-maria-honduras-mineria.mjs
 *
 * Carga el inventario de legislación minera y ambiental de Honduras
 * (fecha de corte: 10 de agosto de 2026) al RAG de María.
 *
 * Fuentes (transcritas desde el inventario jurídico estructurado DOCX a
 * markdown organizado por instrumento):
 *   - data/maria-knowledge/honduras-mineria/01-marco-constitucional-jurisprudencia.md
 *   - data/maria-knowledge/honduras-mineria/02-marco-institucional.md
 *   - data/maria-knowledge/honduras-mineria/03-legislacion-minera.md
 *   - data/maria-knowledge/honduras-mineria/04-legislacion-ambiental-general.md
 *   - data/maria-knowledge/honduras-mineria/05-legislacion-ambiental-sectorial.md
 *   - data/maria-knowledge/honduras-mineria/06-convenios-internacionales-balance.md
 *
 * Estrategia de chunking (mismo chunker que seed-maria-honduras-ambiental.mjs):
 *   - Cada instrumento legal vive bajo su propio heading H3, así que el
 *     chunker emite una fila por instrumento ("¿Qué es el Acuerdo
 *     088-B-2018?" → 1 hit preciso con número, fecha, contenido y estado).
 *   - Cada chunk lleva el breadcrumb completo en `title` y la categoría
 *     consistente en `category`.
 *
 * Vigencia (sentencia SCO-0090-2014): el contenido transcrito marca los
 * artículos anulados de la Ley General de Minería (22, 39, 43, 47, 48, 67,
 * 68) con la anotación [ANULADO — SCO-0090-2014] adyacente, alineado con
 * lib/legal/vigenciaLGM.ts y las reglas R1–R5 del prompt de María. Al
 * editar estos markdown, mantener SIEMPRE la marca junto a cada mención.
 *
 * Idempotencia:
 *   - Antes de insertar, borra TODAS las filas cuyo `source` empieza con
 *     `honduras-mineria/`.
 *
 * Run from project root:
 *   node scripts/seed-maria-honduras-mineria.mjs
 *
 * Flags:
 *   --dry-run   no escribe a Supabase; imprime el primer chunk de cada doc.
 *   --json      escribe `data/maria-knowledge/honduras-mineria.chunks.json`.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env.
 *
 * Operador sin env vars locales (path b — pegar SQL en Supabase Studio):
 *   node scripts/seed-maria-honduras-mineria.mjs --dry-run --json
 *   node scripts/chunks-json-to-sql.mjs \
 *     data/maria-knowledge/honduras-mineria.chunks.json \
 *     > data/maria-knowledge/seed-honduras-mineria.sql
 *   # Pegar el .sql en Supabase Studio → SQL Editor → Run.
 *
 * Después del seed correr el embed:
 *   node scripts/embed-maria-knowledge.mjs
 * o desde el admin UI: /admin/maria/rag-health → "Completar (todas las pendientes)".
 *
 * Runbook completo en README §"Runbook — Añadir conocimiento al RAG de María"
 * + MARIA.md §12. **Vercel deploys NO ejecutan este script**; los pasos
 * post-merge son obligatorios para que María pueda citar este conocimiento.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const KNOWLEDGE_DIR = resolve(__dirname, '..', 'data', 'maria-knowledge', 'honduras-mineria');
const JSON_OUT      = resolve(__dirname, '..', 'data', 'maria-knowledge', 'honduras-mineria.chunks.json');

const args = new Set(process.argv.slice(2));
const DRY_RUN  = args.has('--dry-run');
const EMIT_JSON = args.has('--json') || DRY_RUN;

// Documents to ingest. `category` is the [tag] prefix María sees on each chunk.
const DOCS = [
  {
    file:     '01-marco-constitucional-jurisprudencia.md',
    category: 'mineria_hn_constitucional',
    label:    'Marco constitucional y jurisprudencia minera (Honduras)',
  },
  {
    file:     '02-marco-institucional.md',
    category: 'mineria_hn_instituciones',
    label:    'Marco institucional minero-ambiental (Honduras)',
  },
  {
    file:     '03-legislacion-minera.md',
    category: 'mineria_hn_legislacion',
    label:    'Legislación minera de Honduras (leyes, reglamentos, moratorias)',
  },
  {
    file:     '04-legislacion-ambiental-general.md',
    category: 'ambiente_hn_general',
    label:    'Legislación ambiental general de Honduras (leyes marco, SINEIA)',
  },
  {
    file:     '05-legislacion-ambiental-sectorial.md',
    category: 'ambiente_hn_sectorial',
    label:    'Legislación ambiental sectorial de Honduras (aguas, bosques, clima)',
  },
  {
    file:     '06-convenios-internacionales-balance.md',
    category: 'mineria_hn_internacional',
    label:    'Convenios internacionales y balance legislativo (Honduras)',
  },
];

const MAX_CHUNK_CHARS = 7500;  // Defensive cap; lib/maria/embeddings.ts uses 8000.
const MIN_CHUNK_CHARS = 30;    // Drop empty/blank-only chunks.

// ─── Markdown utilities ─────────────────────────────────────────────────────

function stripFrontmatter(md) {
  const lines = md.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { frontmatter: {}, body: md };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) return { frontmatter: {}, body: md };
  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join('\n');
  const frontmatter = {};
  for (const line of fmLines) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      frontmatter[m[1]] = val;
    }
  }
  return { frontmatter, body };
}

// Detect article markers anywhere on a line ("Artículo N.-", "**Artículo N.-**").
const ARTICLE_RE = /^(?:#{1,6}\s+)?(?:\*\*)?(?:ART[ÍI]CULO|Art[íi]culo)\s+([0-9]+(?:-[A-Z])?)\s*\.?-(?:\*\*)?\s*(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/**
 * Generic chunker for legal/regulatory markdown (same walk as
 * seed-maria-honduras-ambiental.mjs): tracks H1..H4 context and emits a new
 * chunk on each H2..H4 heading or "Artículo N.-" marker. Title is the
 * breadcrumb from the heading stack.
 */
function chunkMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const chunks = [];
  const stack = { h1: '', h2: '', h3: '', h4: '' };

  const isHeadingOnly = (content) => {
    const meaningful = content
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (meaningful.length === 0) return true;
    return meaningful.every(l => /^#{1,6}\s+/.test(l) || /^-+$/.test(l));
  };

  let current = null;
  const flush = () => {
    if (!current) return;
    const trimmed = current.content.replace(/\s+$/g, '');
    if (trimmed.length >= MIN_CHUNK_CHARS && !isHeadingOnly(trimmed)) {
      chunks.push({ title: current.title, content: trimmed.slice(0, MAX_CHUNK_CHARS) });
    }
    current = null;
  };
  const start = (title, firstLine = '') => {
    flush();
    current = { title, content: firstLine ? firstLine + '\n' : '' };
  };
  const breadcrumb = (local) => {
    const parts = [stack.h1, stack.h2, stack.h3, stack.h4, local].filter(Boolean);
    return parts.join(' · ');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const hm = line.match(HEADING_RE);
    if (hm) {
      const level = hm[1].length;
      const text = hm[2].trim();
      if (level === 1) {
        if (current && /\(preámbulo\)$/.test(current.title)) {
          current.title = `${text} · Encabezado`;
        }
        stack.h1 = text; stack.h2 = ''; stack.h3 = ''; stack.h4 = '';
        start(breadcrumb('Encabezado'), line);
        continue;
      }
      if (level === 2) {
        stack.h2 = text; stack.h3 = ''; stack.h4 = '';
        start(breadcrumb(''), line);
        continue;
      }
      if (level === 3) {
        stack.h3 = text; stack.h4 = '';
        start(breadcrumb(''), line);
        continue;
      }
      if (level === 4) {
        stack.h4 = text;
        start(breadcrumb(''), line);
        continue;
      }
      if (current) current.content += line + '\n';
      else start(breadcrumb(''), line);
      continue;
    }

    const am = line.match(ARTICLE_RE);
    if (am) {
      const num = am[1];
      const tail = am[2]?.trim() ?? '';
      const local = tail ? `Artículo ${num}.- ${tail.slice(0, 80)}` : `Artículo ${num}.-`;
      start(breadcrumb(local), line);
      continue;
    }

    if (current) {
      current.content += line + '\n';
    } else {
      start(breadcrumb('(preámbulo)'), line);
    }
  }

  flush();
  return chunks;
}

// ─── Per-doc adapters ───────────────────────────────────────────────────────

function buildRowsForDoc(doc) {
  const path = resolve(KNOWLEDGE_DIR, doc.file);
  if (!existsSync(path)) {
    console.warn(`[seed] SKIP — file not found: ${path}`);
    return [];
  }
  const raw = readFileSync(path, 'utf8');
  const { frontmatter, body } = stripFrontmatter(raw);

  const chunks = chunkMarkdown(body);
  if (!chunks.length) {
    console.warn(`[seed] WARN — 0 chunks extracted from ${doc.file}`);
    return [];
  }

  const sourceTag = `honduras-mineria/${doc.file}`;
  return chunks.map((c, idx) => ({
    category: doc.category,
    title:    c.title.slice(0, 250),
    content:  c.content,
    source:   sourceTag,
    metadata: {
      doc_label:    doc.label,
      fuente_pdf:   frontmatter.fuente_pdf ?? null,
      decreto:      frontmatter.decreto ?? null,
      acuerdo:      frontmatter.acuerdo ?? null,
      emisor:       frontmatter.emisor ?? null,
      gaceta:       frontmatter.gaceta ?? null,
      fecha:        frontmatter.fecha_publicacion ?? null,
      subcategoria: frontmatter.subcategoria ?? null,
      chunk_index:  idx,
      chunk_total:  chunks.length,
    },
  }));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log(`[seed] Loading from ${KNOWLEDGE_DIR}`);
  const allRows = [];
  for (const doc of DOCS) {
    const rows = buildRowsForDoc(doc);
    console.log(`[seed] ${doc.file} → ${rows.length} chunks`);
    if (rows.length && DRY_RUN) {
      const first = rows[0];
      console.log(`        first chunk title: ${first.title}`);
      console.log(`        first chunk content (first 200 chars): ${first.content.slice(0, 200).replace(/\n/g, ' ⏎ ')}…`);
    }
    allRows.push(...rows);
  }

  console.log(`[seed] Total chunks across all docs: ${allRows.length}`);

  if (EMIT_JSON) {
    writeFileSync(JSON_OUT, JSON.stringify(allRows, null, 2));
    console.log(`[seed] Wrote ${JSON_OUT}`);
  }

  if (DRY_RUN) {
    console.log('[seed] --dry-run set; skipping Supabase writes.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Lazy import: dry-run works without the package installed.
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Delete previous rows for these sources, then insert fresh — idempotent.
  console.log("[seed] Deleting previous rows where source LIKE 'honduras-mineria/%'…");
  const { error: delErr, count: deleted } = await admin
    .from('maria_knowledge')
    .delete({ count: 'exact' })
    .like('source', 'honduras-mineria/%');
  if (delErr) {
    console.error('[seed] Delete failed:', delErr.message);
    process.exit(1);
  }
  console.log(`[seed] Deleted ${deleted ?? 0} previous rows.`);

  // Insert in chunks of 100 to keep payloads small.
  const CHUNK_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const slice = allRows.slice(i, i + CHUNK_SIZE);
    const { error: insErr } = await admin
      .from('maria_knowledge')
      .insert(slice);
    if (insErr) {
      console.error(`[seed] Insert batch ${i / CHUNK_SIZE + 1} failed:`, insErr.message);
      process.exit(1);
    }
    inserted += slice.length;
    console.log(`[seed] Inserted ${inserted}/${allRows.length}`);
  }

  // Verify final count.
  const { count: total } = await admin
    .from('maria_knowledge')
    .select('id', { count: 'exact', head: true })
    .like('source', 'honduras-mineria/%');
  console.log(`[seed] Done. maria_knowledge rows with source 'honduras-mineria/%': ${total ?? '?'}`);
  console.log('[seed] Next step → backfill embeddings:');
  console.log('         node scripts/embed-maria-knowledge.mjs');
  console.log('       (o desde el panel admin: /admin/maria/rag-health → Completar)');
}

run().catch(err => {
  console.error('[seed] Fatal:', err?.stack ?? err);
  process.exit(1);
});
