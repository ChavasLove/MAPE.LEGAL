import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import {
  listConcesionesAdmin,
  type CategoriaConcesion,
  type ClasificacionConcesion,
} from '@/services/concesionesService';

export const dynamic = 'force-dynamic';

const CATEGORIAS = ['explotacion_otorgada', 'exploracion_otorgada', 'solicitud_pendiente'] as const;
// Suspenso is a value of estado_expediente, not clasificacion. Filtering by
// clasificacion=Suspenso silently returned 0 rows because no row carries that
// value in the clasificacion column.
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
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const categoria     = pickCategoria(url.searchParams.get('categoria'));
  const clasificacion = pickClasificacion(url.searchParams.get('clasificacion'));
  const q             = url.searchParams.get('q');
  const limit         = Number(url.searchParams.get('limit') ?? 100);
  const offset        = Number(url.searchParams.get('offset') ?? 0);

  try {
    const result = await listConcesionesAdmin({
      categoria,
      clasificacion,
      q,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/concesiones GET] failed:', error);
    return NextResponse.json({ error: 'Error al listar concesiones' }, { status: 500 });
  }
}
