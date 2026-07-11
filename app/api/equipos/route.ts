import { NextRequest, NextResponse } from 'next/server';
import { searchEquipos } from '@/services/equiposService';
import { CATEGORIA_LABELS, type EquipoFilters, type EquipoCategoria } from '@/lib/types/equipo';

export const dynamic = 'force-dynamic';

function pickCategoria(v: string | null): EquipoCategoria | undefined {
  if (!v) return undefined;
  return v in CATEGORIA_LABELS ? (v as EquipoCategoria) : undefined;
}

function pickInt(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// GET /api/equipos?q=&categoria=&precio_min=&precio_max=&limit=&offset=
// Public search endpoint — the RPC is SECURITY DEFINER and only returns
// activo = true rows, safe for anon.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: EquipoFilters = {
      query:     searchParams.get('q') || undefined,
      categoria: pickCategoria(searchParams.get('categoria')),
      precioMin: pickInt(searchParams.get('precio_min')),
      precioMax: pickInt(searchParams.get('precio_max')),
    };

    const limit  = Math.min(pickInt(searchParams.get('limit')) ?? 50, 100);
    const offset = pickInt(searchParams.get('offset')) ?? 0;

    const { equipos, total } = await searchEquipos(filters, limit, offset);

    return NextResponse.json({ equipos, total }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[api/equipos] GET error:', err);
    return NextResponse.json(
      { error: 'Error al cargar equipos' },
      { status: 500 }
    );
  }
}
