import { NextRequest, NextResponse } from 'next/server';
import { searchEquipos } from '@/services/equiposService';
import { CATEGORIA_LABELS, type EquipoFilters, type EquipoCategoria } from '@/lib/types/equipo';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Anon endpoint whose unique-q requests miss the CDN cache and hit the DB —
// throttle per IP like the other public surfaces (/api/maria/chat is 20/5min;
// search gets a laxer budget because filter browsing is legitimate traffic).
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60_000;

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
    const ip = clientIpFrom(request);
    const rl = checkRateLimit(`equipos-search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { searchParams } = new URL(request.url);

    const filters: EquipoFilters = {
      query:     searchParams.get('q')?.slice(0, 100) || undefined,
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
