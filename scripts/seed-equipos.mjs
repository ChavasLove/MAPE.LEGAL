#!/usr/bin/env node
/**
 * Seed script for the equipment marketplace (equipos_mercado).
 * Run: node scripts/seed-equipos.mjs
 *
 * Requires migration 027_equipos_mercado.sql applied in Supabase Studio first
 * (Vercel deploys do NOT apply migrations).
 *
 * Populates equipos_mercado with the real catalog (demo records removed 2026-07-27).
 * Idempotent — upsert on slug with ignoreDuplicates (existing rows untouched).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// First-party images live under public/images/equipos/<slug>/ — site-relative
// paths need no next.config.ts remotePatterns entry and pass isAllowedImageUrl.
const IMG_LOCAL = '/images/equipos';

const EQUIPOS = [
  {
    slug: 'planta-lavado-oro-aluvial-100tph',
    nombre: 'Planta de Lavado de Oro Aluvial 100 TPH',
    descripcion_corta: 'Planta completa de recuperacion gravimetrica para gravas auriferas con arcilla pegajosa. Del mineral aluvial al lingote dore. Precio CIF Honduras.',
    descripcion: 'Planta de lavado de oro aluvial con capacidad de 100 toneladas por hora, disenada para material con contenido de arcilla pegajosa: el trommel lavador rompe la arcilla y libera el oro antes de la clasificacion, seguido de concentracion gravimetrica en dos etapas. Circuito completo: tolva grizzly de 25 m3 (retira bolones > 300 mm), alimentador vibratorio de rejilla (clasifica a ~70 mm), trommel lavador modelo 1500 (sobretamano 3-70 mm sale por cinta; bajotamano 0-3 mm pasa como pulpa a concentracion), concentrador centrifugo STLB80 para recuperacion primaria, dos mesas vibradoras 6S-4500 para limpieza final del concentrado, dos esclusas con tapa sobre las colas del centrifugo que capturan el oro residual, y horno de fundicion que convierte el concentrado final en lingotes dore listos para despacho. Precio de venta CIF Honduras (flete y seguro incluidos hasta puerto hondureno).',
    categoria: 'planta_lavado_oro',
    proveedor: 'MAPE LEGAL — Importacion directa',
    precio_min_usd: 118000,
    precio_max_usd: null,
    moq: 1,
    unidad_moq: 'Set',
    capacidad: '100 toneladas/hora',
    potencia: null,
    peso: null,
    dimensiones: null,
    imagen_url: `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/01.jpeg`,
    galeria_urls: [
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/02.jpeg`,
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/03.jpeg`,
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/04.jpeg`,
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/05.jpeg`,
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/06.jpeg`,
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/07.jpeg`,
      `${IMG_LOCAL}/planta-lavado-oro-aluvial-100tph/08.jpeg`,
    ],
    especificaciones: {
      'Mineral': 'Oro aluvial con arcilla pegajosa',
      'Recuperacion de oro objetivo': '>= 80%',
      'Tolva grizzly': '25 m3 · retira bolones > 300 mm',
      'Alimentador vibratorio': 'Clasifica a ~70 mm',
      'Trommel lavador': 'Modelo 1500 · 70-100 TPH',
      'Concentrador centrifugo': 'STLB80 x 1 · 10-20 TPH',
      'Mesas vibradoras': '6S-4500 x 2',
      'Esclusas con tapa': '2 x 30 TPH · 1 m x 6 m x 0.3 m (colas del centrifugo)',
      'Horno de fundicion': 'Concentrado final a lingote dore',
      'Incoterm': 'CIF Honduras',
    },
    destacado: true,
    orden: 0,
  },
];

async function seed() {
  console.log(`[seed-equipos] Inserting ${EQUIPOS.length} equipment records...`);

  let inserted = 0;
  let skipped = 0;

  for (const equipo of EQUIPOS) {
    const { error } = await adminSupabase
      .from('equipos_mercado')
      .upsert(equipo, { onConflict: 'slug', ignoreDuplicates: true });

    if (error) {
      console.error(`[seed-equipos] Error inserting ${equipo.slug}:`, error.message);
      continue;
    }

    // Check if it was inserted or skipped (created within the last minute)
    const { data } = await adminSupabase
      .from('equipos_mercado')
      .select('created_at')
      .eq('slug', equipo.slug)
      .maybeSingle();

    const isNew = data && new Date(data.created_at).getTime() > Date.now() - 60000;

    if (isNew) {
      inserted++;
      console.log(`[seed-equipos] Inserted: ${equipo.slug}`);
    } else {
      skipped++;
      console.log(`[seed-equipos] Skipped (exists): ${equipo.slug}`);
    }
  }

  console.log(`\n[seed-equipos] Done: ${inserted} inserted, ${skipped} skipped (already existed).`);
}

seed().catch((err) => {
  console.error('[seed-equipos] Fatal error:', err);
  process.exit(1);
});
