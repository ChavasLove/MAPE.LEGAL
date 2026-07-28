import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { CATEGORIA_LABELS, isAllowedImageUrl, type EquipoCategoria } from '@/lib/types/equipo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Extracción con IA: recibe las URLs públicas de las láminas ya subidas al
// bucket `equipos-imagenes` y devuelve un borrador de producto (campos del
// form admin) leído por Claude con vision. EL PRECIO NUNCA SE EXTRAE — es
// dato comercial que el admin ingresa a mano.
const MAX_IMAGES = 10;
const MODEL = 'claude-haiku-4-5-20251001';

const EXTRACTION_PROMPT = `Estas imágenes son láminas de especificaciones (o fotos) de UN equipo de minería en venta. Leelas todas y devolvé ÚNICAMENTE un objeto JSON válido (sin markdown, sin comentarios) con esta forma exacta:

{
  "nombre": "nombre comercial del equipo, en español, sin marca de proveedor",
  "slug": "kebab-case-del-nombre, solo [a-z0-9-]",
  "descripcion_corta": "resumen vendedor de máximo 160 caracteres, en español",
  "descripcion": "descripción completa en español (4-8 frases): qué es, para qué material/mineral, cómo funciona el circuito o el equipo, qué componentes incluye",
  "categoria": "una de: planta_lavado_oro | trommel | sluice_box | mesa_concentracion | chancadora | bomba_agua | generador | criba_vibratoria | caja_esclusa | equipo_portatil",
  "capacidad": "capacidad de proceso si aparece (ej. '100 toneladas/hora') o null",
  "potencia": "potencia si aparece o null",
  "peso": "peso si aparece o null",
  "dimensiones": "dimensiones si aparecen o null",
  "especificaciones": { "clave técnica": "valor corto", "...": "máximo 12 entradas, en español, fieles a las láminas" }
}

Reglas:
- NO inventes datos que no estén en las láminas. Si un campo no aparece, usá null.
- NUNCA incluyas precios, montos, ni monedas en ningún campo, aunque aparezcan en las láminas.
- "especificaciones" debe capturar los datos técnicos concretos (modelos, capacidades por componente, cortes de clasificación, cantidades).
- Español de Honduras, sin emojis.`;

interface ExtractedDraft {
  nombre: string;
  slug: string;
  descripcion_corta: string | null;
  descripcion: string | null;
  categoria: EquipoCategoria;
  capacidad: string | null;
  potencia: string | null;
  peso: string | null;
  dimensiones: string | null;
  especificaciones: Record<string, string>;
}

function cleanStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export async function POST(req: Request) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[admin/equipos/extraer] ANTHROPIC_API_KEY missing');
    return NextResponse.json(
      { error: 'Extracción no disponible: falta ANTHROPIC_API_KEY en el servidor.' },
      { status: 500 }
    );
  }

  let body: { imageUrls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido.' }, { status: 400 });
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u): u is string => typeof u === 'string')
    : [];
  if (imageUrls.length === 0) {
    return NextResponse.json({ error: 'imageUrls es requerido.' }, { status: 400 });
  }
  const usable = imageUrls.slice(0, MAX_IMAGES);
  // Claude descarga las imágenes por URL — deben ser https públicas de un
  // host permitido (el bucket de Storage o el CDN del proveedor).
  const bad = usable.find((u) => !u.startsWith('https://') || !isAllowedImageUrl(u));
  if (bad) {
    return NextResponse.json(
      { error: 'Las imágenes deben ser URLs https públicas del bucket de equipos o de un host permitido.' },
      { status: 400 }
    );
  }

  // Lazy import + init dentro del handler — nunca a nivel de módulo (regla
  // CLAUDE.md §Framework: el build de Next.js ejecuta módulos sin env vars).
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...usable.map((url) => ({
              type: 'image' as const,
              source: { type: 'url' as const, url },
            })),
            { type: 'text' as const, text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });
    const block = response.content.find((b) => b.type === 'text');
    raw = block && block.type === 'text' ? block.text : '';
  } catch (err) {
    console.error('[admin/equipos/extraer] Claude call failed:', err);
    return NextResponse.json(
      { error: 'La extracción con IA falló. Reintentá en unos segundos.' },
      { status: 502 }
    );
  }

  // Strip de fences markdown antes del parse (mismo patrón que la extracción
  // estructurada de María en route.js).
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error('[admin/equipos/extraer] unparseable model output:', raw.slice(0, 400));
    return NextResponse.json(
      { error: 'La IA devolvió un formato inesperado. Reintentá.' },
      { status: 502 }
    );
  }

  const categoria = typeof parsed.categoria === 'string' && parsed.categoria in CATEGORIA_LABELS
    ? (parsed.categoria as EquipoCategoria)
    : 'planta_lavado_oro';

  const rawSlug = cleanStr(parsed.slug, 80) ?? '';
  const slug = rawSlug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const especificaciones: Record<string, string> = {};
  if (parsed.especificaciones && typeof parsed.especificaciones === 'object') {
    for (const [k, v] of Object.entries(parsed.especificaciones as Record<string, unknown>)) {
      const key = k.trim().slice(0, 60);
      const value = cleanStr(v, 160);
      if (key && value && Object.keys(especificaciones).length < 12) {
        especificaciones[key] = value;
      }
    }
  }

  const draft: ExtractedDraft = {
    nombre: cleanStr(parsed.nombre, 140) ?? 'Equipo sin nombre',
    slug: slug || 'equipo-nuevo',
    descripcion_corta: cleanStr(parsed.descripcion_corta, 200),
    descripcion: cleanStr(parsed.descripcion, 2000),
    categoria,
    capacidad: cleanStr(parsed.capacidad, 80),
    potencia: cleanStr(parsed.potencia, 80),
    peso: cleanStr(parsed.peso, 80),
    dimensiones: cleanStr(parsed.dimensiones, 120),
    especificaciones,
  };

  return NextResponse.json({ draft });
}
