import { NextResponse } from 'next/server';
import { getCategoriaStats } from '@/services/equiposService';

export const dynamic = 'force-dynamic';

// GET /api/equipos/categorias — public category counts for the catalog sidebar
export async function GET() {
  try {
    const categorias = await getCategoriaStats();
    return NextResponse.json({ categorias }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[api/equipos/categorias] error:', err);
    return NextResponse.json(
      { error: 'Error al cargar categorías' },
      { status: 500 }
    );
  }
}
