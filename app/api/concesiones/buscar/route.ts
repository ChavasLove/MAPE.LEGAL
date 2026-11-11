/**
 * GET /api/concesiones/buscar?q=texto&categoria=...&clasificacion=...
 *
 * Endpoint público read-only para búsqueda en los listados de concesiones
 * publicados por INHGEOMIN. Detrás del flag NEXT_PUBLIC_REGISTRO_PUBLICO
 * (lib/registroPublico.ts): apagado por defecto → 404, igual que /registro.
 * Llama el RPC `search_concesion_minera` (SECURITY DEFINER) con la anon-key
 * de Supabase. Caché HTTP de 60s + SWR 5min.
 */
import { NextResponse } from 'next/server';
import {
  searchConcesion,
  type CategoriaConcesion,
  type ClasificacionConcesion,
} from '@/services/concesionesService';
import { registroPublicoHabilitado } from '@/lib/registroPublico';

export const dynamic = 'force-dynamic';

const CATEGORIAS = ['explotacion_otorgada', 'exploracion_otorgada', 'solicitud_pendiente'] as const;
// Suspenso is an estado_expediente value, not a clasificacion. Removed.
const CLASIFS    = ['Metálica', 'No Metálica', 'Pequeña Minería Metálica'] as const;

function pickCategoria(v: string | null): CategoriaConcesion | null {
  if (!v) return null;
  return (CATEGORIAS as readonly string[]).includes(v) ? (v as CategoriaConcesion) : null;
}

function pickClasificacion(v: string | null): ClasificacionConcesion | null {
  if (!v) return null;
  return (CLASIFS as readonly string[]).includes(v) ? (v as ClasificacionConcesion) : null;
}

export async function GET(req: Request) {
  if (!registroPublicoHabilitado()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const url = new URL(req.url);
  const q     = (url.searchParams.get('q') ?? '').trim();
  const limit = Number(url.searchParams.get('limit') ?? 10);

  if (!q) {
    return NextResponse.json({ error: 'Falta parámetro q.' }, { status: 400 });
  }
  if (q.length > 120) {
    return NextResponse.json({ error: 'q demasiado largo (max 120).' }, { status: 400 });
  }

  const rows = await searchConcesion({
    query:          q,
    categoria:      pickCategoria(url.searchParams.get('categoria')),
    clasificacion:  pickClasificacion(url.searchParams.get('clasificacion')),
    limit:          Number.isFinite(limit) ? limit : 10,
  });

  return NextResponse.json(
    { count: rows.length, results: rows },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
