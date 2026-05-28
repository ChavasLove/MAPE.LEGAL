#!/usr/bin/env node
/**
 * seed-marketplace-sample.mjs
 *
 * Crea un proyecto minero de ejemplo + 5 registros de documentos (placeholders,
 * sin archivos reales en Storage) para verificar la UI de /admin/mercado.
 *
 * Run from project root:
 *   node scripts/seed-marketplace-sample.mjs
 *
 * Idempotente — si ya existe el proyecto de ejemplo (mismo nombre) lo reutiliza
 * y no duplica documentos (upsert por (project_id, storage_path)).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env.
 *
 * NOTA: los documentos sembrados NO tienen archivo real en Storage, así que
 * "Descargar" y "Reprocesar OCR" fallarán sobre ellos. Existen sólo para ver el
 * layout. Una subida real (botón "Subir documento") ejercita el pipeline completo.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[seed] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROJECT_NAME = 'Proyecto Aurífero San José';

async function seed() {
  console.log('[seed] Buscando proyecto de ejemplo…');

  // Idempotencia: reutilizar el proyecto si ya existe.
  let { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('name', PROJECT_NAME)
    .maybeSingle();

  if (!project) {
    const { data, error } = await admin
      .from('projects')
      .insert({
        name: PROJECT_NAME,
        description: 'Proyecto de exploración aurífera en Olancho, Honduras. Etapa de perforación diamantina.',
        country: 'Honduras',
        region: 'Olancho',
        municipality: 'Juticalpa',
        commodity: ['gold', 'silver'],
        project_stage: 'exploration',
        tenement_status: 'granted',
        company_name: 'Minera San José S.A.',
        status: 'active',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[seed] Error creando proyecto:', error.message);
      process.exit(1);
    }
    project = data;
    console.log(`[seed] Proyecto creado: ${project.id}`);
  } else {
    console.log(`[seed] Reutilizando proyecto existente: ${project.id}`);
  }

  const sampleDocs = [
    { title: 'Reporte Técnico NI 43-101 — Proyecto San José', document_type: 'technical_report_43101', original_filename: 'san_jose_43-101_2024.pdf', storage_path: `${project.id}/placeholder-1.pdf`, access_tier: 'registered', page_count: 152, file_size_bytes: 15240000, report_date: '2024-03-15' },
    { title: 'Permiso de Exploración INHGEOMIN — San José',     document_type: 'permit_license',          document_subtype: 'INHGEOMIN_permit', original_filename: 'inhgeomin_permiso_sanjose.pdf', storage_path: `${project.id}/placeholder-2.pdf`, access_tier: 'public', page_count: 24, file_size_bytes: 2400000, permit_number: 'EXP-2024-1847', report_date: '2024-01-20' },
    { title: 'Resultados de Sondaje — Campaña 2024',            document_type: 'exploration_geological',  original_filename: 'sondajes_campania_2024.pdf', storage_path: `${project.id}/placeholder-3.pdf`, access_tier: 'registered', page_count: 86, file_size_bytes: 8600000, report_date: '2024-06-30' },
    { title: 'Licencia Ambiental SERNA — Categoría 2',          document_type: 'environmental_social',    original_filename: 'serna_licencia_sanjose.pdf', storage_path: `${project.id}/placeholder-4.pdf`, access_tier: 'public', page_count: 45, file_size_bytes: 4500000, report_date: '2023-11-10' },
    { title: 'Mapa Geológico — Escala 1:5,000',                 document_type: 'maps_spatial',            original_filename: 'mapa_geologico_sanjose.pdf', storage_path: `${project.id}/placeholder-5.pdf`, access_tier: 'public', page_count: 2, file_size_bytes: 8900000, report_date: '2024-02-15' },
  ].map((d) => ({ ...d, project_id: project.id, ocr_status: 'pending', version: '1.0', language: 'es' }));

  const { data: docs, error: docsErr } = await admin
    .from('project_documents')
    .upsert(sampleDocs, { onConflict: 'project_id,storage_path', ignoreDuplicates: true })
    .select('id');

  if (docsErr) {
    console.error('[seed] Error creando documentos:', docsErr.message);
    process.exit(1);
  }

  console.log(`[seed] Documentos de ejemplo asegurados (${docs?.length ?? 0} nuevos).`);
  console.log(`[seed] Project ID: ${project.id}`);
  console.log(`[seed] URL: /admin/mercado/${project.id}`);
}

seed().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});
