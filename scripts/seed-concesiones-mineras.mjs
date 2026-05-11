/**
 * seed-concesiones-mineras.mjs
 *
 * Lee `data/concesiones-mineras-registro.json` y hace upsert en
 * `public.concesiones_mineras_registro` por `(categoria, numero_registro)`.
 *
 * Run from project root:
 *   node scripts/seed-concesiones-mineras.mjs
 *
 * Idempotente — re-ejecutable sin duplicar filas. Reescribe cualquier campo
 * cuyo valor haya cambiado desde la última corrida (útil cuando se corrige el
 * transcript de un row).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env.
 *
 * Fuente: 3 PDFs INHGEOMIN transcritos en `data/concesiones-mineras-registro.json`.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DATA_PATH  = resolve(__dirname, '..', 'data', 'concesiones-mineras-registro.json');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CHUNK_SIZE = 200;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function run() {
  let raw;
  try {
    raw = readFileSync(DATA_PATH, 'utf8');
  } catch (e) {
    console.error(`[seed] Cannot read ${DATA_PATH}: ${e.message}`);
    process.exit(1);
  }

  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) {
    console.error('[seed] JSON must be an array of rows');
    process.exit(1);
  }

  console.log(`[seed] Loaded ${rows.length} rows from disk.`);

  // Sanity check + normalization
  const normalized = rows.map((r, idx) => {
    const required = ['numero_registro', 'nombre_zona', 'tipo_expediente', 'solicitante', 'estado_expediente', 'clasificacion', 'categoria'];
    for (const f of required) {
      if (r[f] === undefined || r[f] === null || r[f] === '') {
        throw new Error(`[seed] Row ${idx} missing required field "${f}": ${JSON.stringify(r)}`);
      }
    }
    return {
      numero_registro:    Number(r.numero_registro),
      codigo:             r.codigo == null ? null : String(r.codigo),
      nombre_zona:        String(r.nombre_zona).trim(),
      fecha_solicitud:    r.fecha_solicitud || null,
      tipo_expediente:    String(r.tipo_expediente).trim(),
      solicitante:        String(r.solicitante).trim(),
      estado_expediente:  String(r.estado_expediente).trim(),
      clasificacion:      String(r.clasificacion).trim(),
      categoria:          String(r.categoria).trim(),
      fuente:             r.fuente || 'INHGEOMIN',
      fuente_documento:   r.fuente_documento || null,
      fuente_pagina:      r.fuente_pagina == null ? null : Number(r.fuente_pagina),
      raw_row:            r.raw_row || null,
      notas:              r.notas || null,
    };
  });

  const chunks = chunk(normalized, CHUNK_SIZE);
  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const { error } = await admin
      .from('concesiones_mineras_registro')
      .upsert(c, { onConflict: 'categoria,numero_registro', ignoreDuplicates: false });
    if (error) {
      console.error(`[seed] Chunk ${i + 1}/${chunks.length} failed:`, error.message);
      process.exit(1);
    }
    total += c.length;
    console.log(`[seed] Upserted chunk ${i + 1}/${chunks.length} (${c.length} rows, total ${total})`);
  }

  const { count: rowCount } = await admin
    .from('concesiones_mineras_registro')
    .select('id', { count: 'exact', head: true });

  console.log(`[seed] Done — table now contains ${rowCount} rows total.`);
}

run().catch(err => {
  console.error('[seed] Fatal:', err?.message ?? err);
  process.exit(1);
});
