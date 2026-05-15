#!/usr/bin/env node
/**
 * chunks-json-to-sql.mjs
 *
 * Convierte un archivo `<categoria>.chunks.json` (producido por un seed
 * `seed-maria-*.mjs --dry-run --json`) en un script SQL idempotente listo
 * para pegar en Supabase Studio → SQL Editor cuando el operador no tiene
 * `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` localmente.
 *
 * Vercel deploys NO ejecutan scripts/**, así que cada vez que se mergea
 * un PR que agrega chunks nuevos al RAG hay dos paths para cargarlos en
 * producción:
 *
 *   (a) `node scripts/seed-maria-<categoria>.mjs` con env vars locales.
 *   (b) Generar SQL con este helper y pegarlo en SQL Editor.
 *
 * Este helper existe para que el path (b) sea trivial y consistente,
 * sin tener que reinventar el escaping/agrupado cada vez.
 *
 * Uso:
 *   node scripts/chunks-json-to-sql.mjs <archivo.chunks.json> > <archivo.sql>
 *
 * Ejemplo:
 *   node scripts/seed-maria-honduras-ambiental.mjs --dry-run --json
 *   node scripts/chunks-json-to-sql.mjs \
 *     data/maria-knowledge/honduras-ambiental.chunks.json \
 *     > data/maria-knowledge/seed-honduras-ambiental.sql
 *
 * Idempotencia:
 *   - El SQL borra primero todas las filas con `source LIKE '<prefijo>/%'`
 *     basado en el prefijo común detectado en el campo `source` de los
 *     chunks (todos comparten un prefijo `<categoria>/`).
 *   - Luego inserta los chunks frescos en una sola transacción.
 *   - Al final, un `select` de verificación muestra los conteos por
 *     `source` para que el operador valide visualmente.
 *
 * El script NO genera embeddings. Después de cargar el SQL, hay que
 * disparar el backfill desde `/admin/maria/rag-health` ("Completar")
 * o `node scripts/embed-maria-knowledge.mjs`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node scripts/chunks-json-to-sql.mjs <archivo.chunks.json>');
  process.exit(1);
}

const inputPath = resolve(process.cwd(), args[0]);
let chunks;
try {
  chunks = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  console.error(`No pude leer/parsear ${inputPath}: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(chunks) || chunks.length === 0) {
  console.error('El JSON no contiene chunks (esperaba un array no vacío).');
  process.exit(1);
}

// Detectar el prefijo común para el DELETE idempotente.
// Asumimos que todos los chunks comparten un prefijo `<categoria>/...`.
const firstSource = chunks[0]?.source ?? '';
const slashIdx = firstSource.indexOf('/');
if (slashIdx <= 0) {
  console.error(`El primer chunk tiene un source sin prefijo "<categoria>/...": "${firstSource}"`);
  process.exit(1);
}
const sourcePrefix = firstSource.slice(0, slashIdx); // p.ej. "honduras-ambiental"

// Validar: todos los chunks deben compartir el prefijo.
const stray = chunks.find(c => typeof c.source !== 'string' || !c.source.startsWith(sourcePrefix + '/'));
if (stray) {
  console.error(`Encontré un chunk con source fuera del prefijo "${sourcePrefix}/": ${JSON.stringify(stray.source)}`);
  process.exit(1);
}

const esc = (s) => String(s).replace(/'/g, "''");

const lines = [];
lines.push(`-- Seed RAG chunks for category prefix '${sourcePrefix}/' into public.maria_knowledge`);
lines.push(`-- Generated from ${inputPath} (${chunks.length} rows)`);
lines.push(`-- Idempotent: deletes existing '${sourcePrefix}/%' rows before inserting.`);
lines.push(`-- After running, embeddings must be backfilled via /admin/maria/rag-health → Completar`);
lines.push(`-- or scripts/embed-maria-knowledge.mjs.`);
lines.push('');
lines.push('begin;');
lines.push('');
lines.push(`delete from public.maria_knowledge where source like '${esc(sourcePrefix)}/%';`);
lines.push('');
lines.push('insert into public.maria_knowledge (category, title, content, source, metadata) values');

const rows = chunks.map(c => {
  const category = esc(c.category ?? '');
  const title    = esc(c.title ?? '');
  const content  = esc(c.content ?? '');
  const source   = esc(c.source ?? '');
  const metadata = esc(JSON.stringify(c.metadata ?? {}));
  return `  ('${category}', '${title}', '${content}', '${source}', '${metadata}'::jsonb)`;
});
lines.push(rows.join(',\n') + ';');
lines.push('');
lines.push('commit;');
lines.push('');
lines.push('-- Verify');
lines.push(`select source, count(*) from public.maria_knowledge where source like '${esc(sourcePrefix)}/%' group by source order by source;`);

process.stdout.write(lines.join('\n') + '\n');
