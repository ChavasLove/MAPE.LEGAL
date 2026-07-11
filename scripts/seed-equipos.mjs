#!/usr/bin/env node
/**
 * Seed script for the equipment marketplace (equipos_mercado).
 * Run: node scripts/seed-equipos.mjs
 *
 * Requires migration 027_equipos_mercado.sql applied in Supabase Studio first
 * (Vercel deploys do NOT apply migrations).
 *
 * Populates equipos_mercado with 12 realistic gold washing equipment records.
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

const IMG = 'https://image.made-in-china.com';

const EQUIPOS = [
  {
    slug: 'planta-lavado-oro-movil-50tph',
    nombre: 'Planta de Lavado de Oro Movil 50TPH',
    descripcion_corta: 'Planta portatil completa con trommel, sluice box y sistema de recuperacion. Ideal para operaciones artesanales.',
    descripcion: 'Planta de lavado de oro movil con capacidad de 50 toneladas por hora. Incluye tolva de alimentacion, trommel de cribado de doble capa, sluice box con alfombras de oro, y sistema de recuperacion. Montada sobre chasis con ruedas para facil transporte entre sitios. Motor diesel incluido.',
    categoria: 'planta_lavado_oro',
    proveedor: 'JXSC Mineral',
    precio_min_usd: 8500,
    precio_max_usd: 12000,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '50 toneladas/hora',
    potencia: '22 HP (diesel)',
    peso: '4,200 kg',
    dimensiones: '6.5 x 2.2 x 2.8 m',
    imagen_url: `${IMG}/201f0j00KenMoCUscScj/Mobile-Portable-Small-Scale-Alluvial-Gold-Ore-Mining-Mud-Wash-Gold-Washing-Plant-with-Trommel-Sluice-Box-Separator.webp`,
    especificaciones: {
      'Material alimentacion': 'Arcilla, arena, grava',
      'Tamano alimentacion': '< 200 mm',
      'Recuperacion': '90-95%',
      'Agua requerida': '100-150 m3/h',
    },
    destacado: true,
    orden: 1,
  },
  {
    slug: 'trommel-criba-rotativa-100tph',
    nombre: 'Trommel Criba Rotativa 100TPH',
    descripcion_corta: 'Trommel de gran capacidad para cribado de materiales auriferos. Motor electrico de alta eficiencia.',
    descripcion: 'Trommel criba rotativa de alta capacidad para la clasificacion de materiales auriferos. Cilindro rotativo con mallas intercambiables. Sistema de lavado interno con presion. Estructura reforzada para trabajo continuo en condiciones mineras.',
    categoria: 'trommel',
    proveedor: 'The Nile Machinery',
    precio_min_usd: 6800,
    precio_max_usd: 9500,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '100 toneladas/hora',
    potencia: '30 HP',
    peso: '5,800 kg',
    dimensiones: '8.0 x 2.5 x 3.2 m',
    imagen_url: `${IMG}/201f0j00AeUCvbGdMFct/100tph-Mobile-Alluvial-Gold-Wash-Plant-Mobile-Trommel-Screen-Gold-Washing-Plant-in-Kenya.webp`,
    especificaciones: {
      'Diametro trommel': '1.8 m',
      'Longitud trommel': '4.5 m',
      'Mallas': '5 mm, 10 mm, 25 mm (intercambiables)',
      'Rotacion': '15-25 RPM',
    },
    destacado: true,
    orden: 2,
  },
  {
    slug: 'sluice-box-aluminio-3m',
    nombre: 'Sluice Box de Aluminio 3 Metros',
    descripcion_corta: 'Canaleta de aluminio ligera con riffles y alfombrilla para recuperacion de oro fino.',
    descripcion: 'Sluice box profesional de aluminio de 3 metros de longitud. Incluye riffles de precision CNC, alfombrilla de recuperacion de oro fino, y patas ajustables para nivelacion. Peso ligero para transporte manual al sitio de trabajo.',
    categoria: 'sluice_box',
    proveedor: 'Miners Warehouse',
    precio_min_usd: 350,
    precio_max_usd: 520,
    moq: 2,
    unidad_moq: 'Unidad',
    capacidad: '5-10 m3/h',
    potencia: 'Manual',
    peso: '18 kg',
    dimensiones: '3.0 x 0.3 x 0.15 m',
    imagen_url: `${IMG}/201f0j00GZAVEWlcZvfC/Factory-Price-Customized-New-Washing-Machine-Gravity-Separator-Wash-Gold-Trommel-Plant.webp`,
    especificaciones: {
      Material: 'Aluminio 6061-T6',
      Riffles: 'CNC mecanizados',
      'Inclinacion ajustable': '5-15 grados',
      'Alfombrilla': 'Miners Moss incluida',
    },
    destacado: false,
    orden: 3,
  },
  {
    slug: 'mesa-concentracion-wilfley',
    nombre: 'Mesa de Concentracion Wilfley',
    descripcion_corta: 'Mesa vibratoria para concentracion gravimetrica de oro fino y concentrados.',
    descripcion: 'Mesa de concentracion tipo Wilfley para separacion gravimetrica de minerales pesados. Superficie de fibra de vidrio con riffling preciso. Accionamiento por motor vibratorio con amplitud ajustable. Ideal para limpieza de concentrados de oro.',
    categoria: 'mesa_concentracion',
    proveedor: 'Yongsheng Mineral',
    precio_min_usd: 2200,
    precio_max_usd: 3800,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '0.5-2 toneladas/hora',
    potencia: '1.1 kW',
    peso: '450 kg',
    dimensiones: '1.5 x 0.9 x 0.7 m',
    imagen_url: `${IMG}/201f0j00YCOevyUKwjbl/Gravity-Separator-Energy-Saving-Mining-Machine-Trommel-Screen-Gold-Washing-Plant.webp`,
    especificaciones: {
      'Area mesa': '1.2 x 0.6 m',
      'Frecuencia': '250-350 ciclos/min',
      'Relacion concentrado': '1:100 a 1:500',
      Recuperacion: '> 95% oro libre',
    },
    destacado: false,
    orden: 4,
  },
  {
    slug: 'chancadora-mandibula-pequena',
    nombre: 'Chancadora de Mandibula PE-150x250',
    descripcion_corta: 'Chancadora de mandibula pequena para trituracion primaria de mineral aurifero.',
    descripcion: 'Chancadora de mandibula PE-150x250 para trituracion primaria de rocas duras. Quijadas de acero al manganeso de alta resistencia al desgaste. Ajuste de abertura de salida. Motor electrico trifasico.',
    categoria: 'chancadora',
    proveedor: 'Baichy Machinery',
    precio_min_usd: 1800,
    precio_max_usd: 2900,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '1-3 toneladas/hora',
    potencia: '5.5 kW',
    peso: '810 kg',
    dimensiones: '0.9 x 0.7 x 0.9 m',
    // Original URL from the source script was truncated in the PDF — reusing a
    // complete image from the same catalog set (same practice as the source
    // script, which reuses images across products).
    imagen_url: `${IMG}/201f0j00jszodwqyznkS/Mobile-Gold-Wash-Sluice-Box-Plant-Trommel-Drum-Alluvial-Gold-Washing-Plant.webp`,
    especificaciones: {
      'Apertura alimentacion': '150 x 250 mm',
      'Tamano salida': '10-40 mm (ajustable)',
      'Velocidad eje': '250 RPM',
      'Material quijadas': 'Mn13',
    },
    destacado: false,
    orden: 5,
  },
  {
    slug: 'bomba-agua-diesel-4pulg',
    nombre: 'Bomba de Agua Diesel 4 Pulgadas',
    descripcion_corta: 'Bomba centrifuga accionada por motor diesel para suministro de agua en operaciones de lavado.',
    descripcion: 'Bomba de agua centrifuga de 4 pulgadas accionada por motor diesel de arranque electrico. Caudal alto para alimentacion de plantas de lavado. Autocebante. Chasis con ruedas para transporte.',
    categoria: 'bomba_agua',
    proveedor: 'Weifang Hairui',
    precio_min_usd: 450,
    precio_max_usd: 750,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '80-120 m3/h',
    potencia: '12 HP (diesel)',
    peso: '95 kg',
    dimensiones: '0.7 x 0.5 x 0.7 m',
    imagen_url: `${IMG}/201f0j00jszodwqyznkS/Mobile-Gold-Wash-Sluice-Box-Plant-Trommel-Drum-Alluvial-Gold-Washing-Plant.webp`,
    especificaciones: {
      Succion: '4 pulgadas',
      Descarga: '4 pulgadas',
      'Cabeza maxima': '28 m',
      'Autocebante': 'Si, hasta 6 m',
    },
    destacado: false,
    orden: 6,
  },
  {
    slug: 'generador-diesel-20kva',
    nombre: 'Generador Diesel 20 kVA',
    descripcion_corta: 'Generador diesel silencioso de 20 kVA para alimentacion de equipos en campo.',
    descripcion: 'Grupo electrogeno diesel de 20 kVA en cabina silenciosa. Motor de 4 cilindros refrigerado por agua. Regulador de voltaje automatico (AVR). Tanque de combustible integrado para 8 horas de operacion continua.',
    categoria: 'generador',
    proveedor: 'Fujian Fufa',
    precio_min_usd: 3200,
    precio_max_usd: 4800,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '20 kVA / 16 kW',
    potencia: 'Motor diesel 4L',
    peso: '750 kg',
    dimensiones: '1.7 x 0.8 x 1.1 m',
    imagen_url: `${IMG}/201f0j00TqtzjIlgsboi/Sierra-Leone-Small-Portable-Gold-Diamond-Washing-Trommel-Plant.webp`,
    especificaciones: {
      'Voltaje': '220/380V trifasico',
      Frecuencia: '60 Hz',
      'Nivel ruido': '< 72 dB a 7m',
      'Autonomia': '8 horas',
    },
    destacado: false,
    orden: 7,
  },
  {
    slug: 'planta-lavado-completa-200tph',
    nombre: 'Planta de Lavado Completa 200TPH',
    descripcion_corta: 'Planta de procesamiento completa de 200TPH con trommel, concentradores y sistema de recuperacion.',
    descripcion: 'Planta de lavado de oro de gran escala con capacidad de 200 toneladas por hora. Sistema completo que incluye: alimentador vibratorio, trommel de cribado de triple capa, 4 sluice boxes en paralelo, 2 mesas de concentracion, y sistema de gestion de agua recirculada. Control electrico centralizado. Instalacion y capacitacion incluidas.',
    categoria: 'planta_lavado_oro',
    proveedor: 'Qingzhou Yongli',
    precio_min_usd: 45000,
    precio_max_usd: 85000,
    moq: 1,
    unidad_moq: 'Set',
    capacidad: '200 toneladas/hora',
    potencia: '150 HP total',
    peso: '35,000 kg',
    dimensiones: '45 x 15 x 8 m (instalada)',
    imagen_url: `${IMG}/201f0j00DOrWahiBgAfR/2025-150m3-Hour-Dry-Land-Gold-Washing-Plant-Machine-for-Sale.webp`,
    especificaciones: {
      'Recuperacion estimada': '92-97%',
      'Agua recirculada': '80%',
      'Instalacion': 'Incluida',
      'Capacitacion': '5 dias incluidos',
    },
    destacado: true,
    orden: 8,
  },
  {
    slug: 'criba-vibratoria-lineal',
    nombre: 'Criba Vibratoria Lineal',
    descripcion_corta: 'Criba vibratoria de movimiento lineal para clasificacion de arenas auriferas.',
    descripcion: 'Criba vibratoria de movimiento lineal para la clasificacion precisa de materiales granulares. Doble motor de vibracion con contrapesos ajustables. Mallas de acero al carbono intercambiables. Estructura soldada de acero.',
    categoria: 'criba_vibratoria',
    proveedor: 'Xinxiang Dahan',
    precio_min_usd: 1200,
    precio_max_usd: 2800,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '10-30 toneladas/hora',
    potencia: '2 x 0.75 kW',
    peso: '650 kg',
    dimensiones: '3.0 x 1.2 x 1.5 m',
    // Original URL truncated in the source PDF — complete image reused from set.
    imagen_url: `${IMG}/201f0j00tvQBabwsZFoU/100tph-Mobile-Placer-Alluvial-Gold-Trommel-Processing-Mining-Washing-Wash-Plant.webp`,
    especificaciones: {
      'Capas': '1-3 (configurable)',
      'Malla estandar': '2, 5, 10 mm',
      'Amplitud': '2-5 mm ajustable',
      'Angulo inclinacion': '0-15 grados',
    },
    destacado: false,
    orden: 9,
  },
  {
    slug: 'caja-esclusa-portatil-backpack',
    nombre: 'Caja de Esclusa Portatil Backpack',
    descripcion_corta: 'Sluice box ultraligera y plegable para prospeccion de oro en rios y quebradas.',
    descripcion: 'Caja de esclusa plegable diseñada para transporte en mochila. Ideal para prospeccion en rios y quebradas de dificil acceso. Construccion de aluminio anodizado. Se pliega a 30 cm de longitud. Incluye 3 tipos de riffles intercambiables.',
    categoria: 'caja_esclusa',
    proveedor: 'Gold Cube',
    precio_min_usd: 180,
    precio_max_usd: 320,
    moq: 3,
    unidad_moq: 'Unidad',
    capacidad: '1-3 m3/h',
    potencia: 'Manual',
    peso: '4.5 kg',
    dimensiones: '0.9 x 0.25 x 0.12 m (desplegada)',
    imagen_url: `${IMG}/201f0j00tvQBabwsZFoU/100tph-Mobile-Placer-Alluvial-Gold-Trommel-Processing-Mining-Washing-Wash-Plant.webp`,
    especificaciones: {
      'Plegada': '30 x 25 x 8 cm',
      Riffles: '3 sets intercambiables',
      'Alfombrilla': 'Miners Moss + ribbed',
      Transporte: 'Mochila incluida',
    },
    destacado: false,
    orden: 10,
  },
  {
    slug: 'equipo-portatil-lavado-oro-mini',
    nombre: 'Equipo Portatil de Lavado de Oro Mini',
    descripcion_corta: 'Kit completo portatil con bomba, trommel mini y sluice para prospeccion individual.',
    descripcion: 'Kit completo de prospeccion de oro portatil que incluye: bomba sumergible de 12V, trommel manual de 30 cm de diametro, sluice box de 60 cm, batea de plastico reforzado, kit de prueba de oro, y maleta de transporte. Todo en un solo paquete listo para usar.',
    categoria: 'equipo_portatil',
    proveedor: 'Minelab / KEENE',
    precio_min_usd: 650,
    precio_max_usd: 1200,
    moq: 1,
    unidad_moq: 'Kit',
    capacidad: '0.5-1 toneladas/hora',
    potencia: '12V (bateria)',
    peso: '22 kg total',
    dimensiones: 'Maleta 60 x 40 x 25 cm',
    imagen_url: `${IMG}/201f0j00AeUCvbGdMFct/100tph-Mobile-Alluvial-Gold-Wash-Plant-Mobile-Trommel-Screen-Gold-Washing-Plant-in-Kenya.webp`,
    especificaciones: {
      'Bomba': '12V, 15 GPM',
      'Batea': '35 cm diametro',
      'Trommel': 'Manual, 30 cm',
      Maleta: 'Transporte incluida',
    },
    destacado: false,
    orden: 11,
  },
  {
    slug: 'trommel-oro-diesel-portatil',
    nombre: 'Trommel de Oro Diesel Portatil 30TPH',
    descripcion_corta: 'Trommel portatil con motor diesel para lavado de oro aluvial en sitios remotos.',
    descripcion: 'Trommel portatil accionado por motor diesel para lavado de oro aluvial. Diseñado para trabajo en sitios sin acceso a electricidad. Tolva de alimentacion con grizzly, tambor rotativo de 1.2m de diametro, sistema de lavado con presion, y salida para conectar sluice box externo.',
    categoria: 'trommel',
    proveedor: 'Jiangxi Province Mining',
    precio_min_usd: 4200,
    precio_max_usd: 6500,
    moq: 1,
    unidad_moq: 'Unidad',
    capacidad: '30 toneladas/hora',
    potencia: '18 HP (diesel)',
    peso: '2,800 kg',
    dimensiones: '5.0 x 1.8 x 2.5 m',
    imagen_url: `${IMG}/201f0j00KenMoCUscScj/Mobile-Portable-Small-Scale-Alluvial-Gold-Ore-Mining-Mud-Wash-Gold-Washing-Plant-with-Trommel-Sluice-Box-Separator.webp`,
    especificaciones: {
      'Diametro tambor': '1.2 m',
      'Longitud tambor': '3.0 m',
      'Mallas': '5, 15, 25 mm',
      'Autonomia': '12 horas (diesel)',
    },
    destacado: false,
    orden: 12,
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
