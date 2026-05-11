/**
 * aggregate-concesiones-jsonl.mjs
 *
 * Toma los 4 JSONL producidos por los agentes de transcripción
 * (/tmp/transcripts/pdf1.jsonl, /tmp/transcripts/pdf2.jsonl,
 *  /tmp/transcripts/pdf3-part1.jsonl, /tmp/transcripts/pdf3-part2.jsonl)
 * y los consolida en `data/concesiones-mineras-registro.json` agregando los
 * campos `categoria` y `fuente_documento` que la transcripción no incluye.
 *
 * Mapeo de categoría según el documento fuente:
 *   pdf1            → explotacion_otorgada
 *   pdf2            → exploracion_otorgada
 *   pdf3-part1/2    → solicitud_pendiente
 *
 * Run:
 *   node scripts/aggregate-concesiones-jsonl.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const OUT_PATH   = resolve(__dirname, '..', 'data', 'concesiones-mineras-registro.json');

const SOURCES = [
  {
    file: '/tmp/transcripts/pdf1.jsonl',
    categoria: 'explotacion_otorgada',
    documento: 'Concesiones_Mineras_Otorgadas_para_Exploracion_1.pdf',
    // El PDF se titula "Otorgadas para EXPLOTACION" — el filename original tiene
    // el typo "Exploración" del scanner. Conservamos el filename real.
  },
  {
    file: '/tmp/transcripts/pdf2.jsonl',
    categoria: 'exploracion_otorgada',
    documento: 'Concesiones_Mineras_Otorgadas_para_Exploracion_2.pdf',
  },
  {
    file: '/tmp/transcripts/pdf3-part1.jsonl',
    categoria: 'solicitud_pendiente',
    documento: 'Concesiones_Otorgadas_para_Exploracion_3.pdf',
  },
  {
    file: '/tmp/transcripts/pdf3-part2.jsonl',
    categoria: 'solicitud_pendiente',
    documento: 'Concesiones_Otorgadas_para_Exploracion_3.pdf',
  },
];

function loadJsonl(path) {
  if (!existsSync(path)) {
    console.warn(`[aggregate] Missing source ${path} — skipping.`);
    return [];
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map((line, i) => {
      try { return JSON.parse(line); }
      catch (e) {
        console.error(`[aggregate] ${path} line ${i + 1} parse error:`, e.message);
        return null;
      }
    })
    .filter(Boolean);
}

const out = [];
let skipped = 0;

for (const src of SOURCES) {
  const rows = loadJsonl(src.file);
  for (const r of rows) {
    if (r.numero == null || r.nombre_zona == null) {
      skipped++;
      continue;
    }
    out.push({
      numero_registro:    Number(r.numero),
      codigo:             r.codigo != null ? String(r.codigo) : null,
      nombre_zona:        String(r.nombre_zona).trim(),
      fecha_solicitud:    r.fecha_solicitud || null,
      tipo_expediente:    r.tipo_expediente || 'Solicitud de Concesión Minera',
      solicitante:        r.solicitante || 'Sin información',
      estado_expediente:  r.estado_expediente || 'Sin información',
      clasificacion:      r.clasificacion || 'Metálica',
      categoria:          src.categoria,
      fuente:             'INHGEOMIN',
      fuente_documento:   src.documento,
      fuente_pagina:      r.pdf_page != null ? Number(r.pdf_page) : null,
      raw_row:            r._uncertain ? { uncertain: r._uncertain } : null,
      notas:              null,
    });
  }
}

console.log(`[aggregate] Loaded ${out.length} rows. Skipped ${skipped}.`);

// Sanity: confirm uniqueness on (categoria, numero_registro)
const seen = new Map();
for (const r of out) {
  const k = `${r.categoria}|${r.numero_registro}`;
  if (seen.has(k)) {
    console.warn(`[aggregate] Duplicate (categoria, numero): ${k} — keeping first.`);
    continue;
  }
  seen.set(k, r);
}
const deduped = Array.from(seen.values());
deduped.sort((a, b) => {
  if (a.categoria === b.categoria) return a.numero_registro - b.numero_registro;
  return a.categoria.localeCompare(b.categoria);
});

writeFileSync(OUT_PATH, JSON.stringify(deduped, null, 2) + '\n', 'utf8');
console.log(`[aggregate] Wrote ${deduped.length} rows to ${OUT_PATH}`);

// Summary by category
const byCat = {};
for (const r of deduped) byCat[r.categoria] = (byCat[r.categoria] ?? 0) + 1;
console.log('[aggregate] Distribution:');
for (const [k, v] of Object.entries(byCat)) console.log(`  ${k}: ${v}`);
