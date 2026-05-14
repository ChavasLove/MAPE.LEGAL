/**
 * seed-maria-honduras-ambiental.mjs
 *
 * Carga la base de conocimiento ambiental hondureña al RAG de María.
 *
 * Fuentes (transcritas manualmente desde PDFs oficiales a markdown verbatim):
 *   - data/maria-knowledge/honduras-ambiental/01-reforma-arts-28A-29C.md
 *   - data/maria-knowledge/honduras-ambiental/02-honduras-ley-general-ambiente.md
 *   - data/maria-knowledge/honduras-ambiental/03-slas-nuevos-requisitos.md
 *
 * Estrategia de chunking:
 *   - Cada artículo legal ("Artículo N.-") se emite como una fila independiente
 *     para retrieval granular ("¿Qué dice el Artículo 28-A?" → 1 hit preciso).
 *   - Cada Requisito SLAS (1–16) se emite como una fila aparte.
 *   - Secciones administrativas (Considerandos, Por tanto, Plazos, Pagos,
 *     Observaciones) se emiten como filas separadas con el contexto del
 *     documento padre.
 *   - Cada chunk lleva el breadcrumb completo en `title` y la categoría
 *     consistente en `category` para que el bloque inyectado a María
 *     (`[category] title: content`) sea autoexplicativo.
 *
 * Idempotencia:
 *   - Antes de insertar, borra TODAS las filas cuyo `source` empieza con
 *     `honduras-ambiental/`. Esto cubre re-corridas tras corregir el
 *     transcript de cualquier MD sin dejar filas huérfanas.
 *
 * Run from project root:
 *   node scripts/seed-maria-honduras-ambiental.mjs
 *
 * Flags:
 *   --dry-run   no escribe a Supabase; imprime el primer chunk de cada doc.
 *   --json      escribe `data/maria-knowledge/honduras-ambiental.chunks.json`
 *               con todos los chunks (útil para inspección antes del seed).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env.
 *
 * Después del seed correr el embed:
 *   node scripts/embed-maria-knowledge.mjs
 * o desde el admin UI: /admin/maria/rag-health → "Completar (todas las pendientes)".
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const KNOWLEDGE_DIR = resolve(__dirname, '..', 'data', 'maria-knowledge', 'honduras-ambiental');
const JSON_OUT      = resolve(__dirname, '..', 'data', 'maria-knowledge', 'honduras-ambiental.chunks.json');

const args = new Set(process.argv.slice(2));
const DRY_RUN  = args.has('--dry-run');
const EMIT_JSON = args.has('--json') || DRY_RUN;

// Documents to ingest. `category` is the [tag] prefix María sees on each chunk.
const DOCS = [
  {
    file:     '01-reforma-arts-28A-29C.md',
    category: 'reforma_ley_ambiente_hn',
    label:    'Reforma Ley General del Ambiente (Honduras)',
  },
  {
    file:     '02-honduras-ley-general-ambiente.md',
    category: 'ley_ambiente_hn',
    label:    'Ley General del Ambiente (Honduras, Decreto 104-93)',
  },
  {
    file:     '03-slas-nuevos-requisitos.md',
    category: 'slas_hn',
    label:    'Sistema de Licenciamiento Ambiental Simplificado SLAS-2 (Honduras)',
  },
];

const MAX_CHUNK_CHARS = 7500;  // Defensive cap; lib/maria/embeddings.ts uses 8000.
const MIN_CHUNK_CHARS = 30;    // Drop empty/blank-only chunks. Short legal items
                                //   (e.g. "1. Reporte oficial…") are valuable
                                //   for retrieval, so the bar is low.

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

// Detect article markers anywhere on a line. Honduran legal style uses
// "Artículo N.-", "ARTÍCULO N.-", "Artículo N-A.-", and also bolded inline
// "**Artículo N.-**". We accept all variants.
const ARTICLE_RE = /^(?:#{1,6}\s+)?(?:\*\*)?(?:ART[ÍI]CULO|Art[íi]culo)\s+([0-9]+(?:-[A-Z])?)\s*\.?-(?:\*\*)?\s*(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const REQUISITO_RE = /^\s*(\d{1,2})\.\s+(.+)$/;  // "1. Reporte Oficial..."

/**
 * Generic chunker for legal/regulatory markdown.
 *
 * Walks lines, tracks H1/H2/H3 context, and emits a new chunk every time it
 * hits one of:
 *   - A heading (H2..H4) that opens a new section
 *   - An article marker ("Artículo N.-")
 *   - For SLAS-style numbered lists where each item is a top-level
 *     requirement, a "Requisito N." line under the relevant section
 *
 * Each chunk is `{ title, content }`. Title is a breadcrumb derived from
 * the H1/H2/H3 stack plus the local item label. Content is the slice of
 * body text under that boundary, capped at MAX_CHUNK_CHARS.
 */
function chunkMarkdown(md, opts = {}) {
  const { splitNumberedRequisitos = false } = opts;
  const lines = md.split(/\r?\n/);
  const chunks = [];
  const stack = { h1: '', h2: '', h3: '', h4: '' };

  // A chunk whose body is only heading lines (e.g. "## TÍTULO II — …" with no
  // article or paragraph beneath it) carries no retrievable content; the
  // breadcrumb is already inherited by sibling chunks via the stack. Drop it.
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

    // Heading?
    const hm = line.match(HEADING_RE);
    if (hm) {
      const level = hm[1].length;
      const text = hm[2].trim();
      if (level === 1) {
        // First H1 retroactively re-titles a pre-H1 preamble chunk so it
        // doesn't get stranded as "(preámbulo)".
        if (current && /\(preámbulo\)$/.test(current.title)) {
          current.title = `${text} · Encabezado`;
        }
        stack.h1 = text; stack.h2 = ''; stack.h3 = ''; stack.h4 = '';
        // H1 itself opens a header chunk that captures bold-key/value lines
        // and other pre-H2 metadata. The H2 below will close it.
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
      // H5/H6 stays inside current chunk.
      if (current) current.content += line + '\n';
      else start(breadcrumb(''), line);
      continue;
    }

    // Article marker — opens a new chunk regardless of heading stack.
    const am = line.match(ARTICLE_RE);
    if (am) {
      const num = am[1];
      const tail = am[2]?.trim() ?? '';
      const local = tail ? `Artículo ${num}.- ${tail.slice(0, 80)}` : `Artículo ${num}.-`;
      start(breadcrumb(local), line);
      continue;
    }

    // SLAS-style numbered requirement (only when explicitly enabled).
    if (splitNumberedRequisitos) {
      const rm = line.match(REQUISITO_RE);
      if (rm && stack.h2) {
        const num = rm[1];
        const tail = rm[2]?.trim() ?? '';
        const local = `Requisito ${num}: ${tail.slice(0, 80)}`;
        start(breadcrumb(local), line);
        continue;
      }
    }

    // Body line — accumulate into current chunk.
    if (current) {
      current.content += line + '\n';
    } else {
      // Pre-heading preamble: start a chunk under H1 if we have one.
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

  // SLAS uses numbered-list requirements as top-level units; legal decrees use
  // "Artículo N.-" markers.
  const splitNumberedRequisitos = /slas/i.test(doc.file);

  const chunks = chunkMarkdown(body, { splitNumberedRequisitos });
  if (!chunks.length) {
    console.warn(`[seed] WARN — 0 chunks extracted from ${doc.file}`);
    return [];
  }

  const sourceTag = `honduras-ambiental/${doc.file}`;
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

  // Lazy import: dry-run works without the package installed (useful in CI
  // and in sandboxes that ship only Node's stdlib).
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Delete previous rows for these sources, then insert fresh — idempotent.
  console.log("[seed] Deleting previous rows where source LIKE 'honduras-ambiental/%'…");
  const { error: delErr, count: deleted } = await admin
    .from('maria_knowledge')
    .delete({ count: 'exact' })
    .like('source', 'honduras-ambiental/%');
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
    .like('source', 'honduras-ambiental/%');
  console.log(`[seed] Done. maria_knowledge rows with source 'honduras-ambiental/%': ${total ?? '?'}`);
  console.log('[seed] Next step → backfill embeddings:');
  console.log('         node scripts/embed-maria-knowledge.mjs');
  console.log('       (o desde el panel admin: /admin/maria/rag-health → Completar)');
}

run().catch(err => {
  console.error('[seed] Fatal:', err?.stack ?? err);
  process.exit(1);
});
