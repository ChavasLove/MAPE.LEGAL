// ─── Document chunking ───────────────────────────────────────────────────────
// Splits OCR markdown into overlapping chunks for embedding. Pure + sync so it
// can be unit-tested and reused by both the processing service and any script.
//
// Page estimation is best-effort: Mistral OCR joins pages with a `\n\n---\n\n`
// separator (see services/marketplace/processing.ts), so a horizontal-rule line
// bumps the running page counter. Tables are detected by leading `|`.

export interface DocChunk {
  index: number;
  text: string;
  estimatedPage: number;
  isTable: boolean;
}

export interface ChunkOptions {
  maxSize?: number;   // soft cap on chunk length in chars
  overlap?: number;   // approx chars of trailing context carried into the next chunk
}

const DEFAULT_MAX_SIZE = 2000;
const DEFAULT_OVERLAP = 200;
// Average chars per line — used to translate the char-based overlap into a
// count of trailing lines to repeat at the head of the next chunk.
const AVG_LINE_CHARS = 50;

export function chunkText(text: string, opts: ChunkOptions = {}): DocChunk[] {
  const maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  const overlapLineCount = Math.max(0, Math.floor(overlap / AVG_LINE_CHARS));

  const source = String(text ?? '');
  if (!source.trim()) return [];

  const lines = source.split('\n');
  const chunks: DocChunk[] = [];

  let current: string[] = [];
  let currentSize = 0;
  let pageEstimate = 1;
  let isTable = false;

  const flush = () => {
    const body = current.join('\n').trim();
    if (!body) return;
    chunks.push({
      index: chunks.length,
      text: body,
      estimatedPage: Math.max(1, pageEstimate),
      isTable,
    });
  };

  for (const line of lines) {
    // Page-break heuristic: a horizontal rule (the page separator from OCR).
    if (/^\s*-{3,}\s*$/.test(line)) {
      pageEstimate++;
    }
    if (line.trimStart().startsWith('|')) {
      isTable = true;
    }

    const lineSize = line.length + 1;

    if (currentSize + lineSize > maxSize && current.length > 0) {
      flush();
      // Carry a tail of the previous chunk for context continuity.
      const tail = overlapLineCount > 0 ? current.slice(-overlapLineCount) : [];
      current = [...tail, line];
      currentSize = current.reduce((n, l) => n + l.length + 1, 0);
      isTable = line.trimStart().startsWith('|');
    } else {
      current.push(line);
      currentSize += lineSize;
    }
  }

  flush();
  return chunks;
}

// Strips markdown noise for the `content_clean` column (lighter for previews/FTS
// weighting; the embedding still uses the raw markdown via buildCanonicalText).
export function cleanChunkText(text: string): string {
  return String(text ?? '')
    .replace(/[#*|>`_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
