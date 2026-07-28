import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getPriceHistory, getLatestPrices } from '@/services/pricingService';

// GET /api/broadcast/prices?days=7
// Handler-level auth (invariante PR #159/#167). El precio público del día
// vive en /api/precios/live — esta ruta es historial interno de broadcast.
export async function GET(req: NextRequest) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = req.nextUrl;
    const days = Math.min(parseInt(searchParams.get('days') ?? '7', 10), 90);

    if (searchParams.get('latest') === 'true') {
      const latest = await getLatestPrices();
      return NextResponse.json(latest);
    }

    const history = await getPriceHistory(days);
    return NextResponse.json(history);
  } catch (e) {
    console.error('[broadcast/prices] failed:', e);
    return NextResponse.json({ error: 'Error al consultar el historial de precios' }, { status: 500 });
  }
}
