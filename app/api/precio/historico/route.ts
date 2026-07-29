// /api/precio/historico — histórico público del Precio de Referencia.
// Evidencia de auditoría: registros 'vigente' ordenados por fecha
// descendente, máximo 365. Parámetros opcionales desde/hasta (ISO date).

import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { getHistorialVigente } from '@/lib/precio/consulta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60_000;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFrom(request);
    const rl = checkRateLimit(`precio-ref-hist:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intente de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const { searchParams } = request.nextUrl;
    const desde = searchParams.get('desde') ?? undefined;
    const hasta = searchParams.get('hasta') ?? undefined;
    for (const [nombre, valor] of [['desde', desde], ['hasta', hasta]] as const) {
      if (valor !== undefined && !FECHA_RE.test(valor)) {
        return NextResponse.json(
          { error: `${nombre} debe tener formato YYYY-MM-DD` },
          { status: 400 },
        );
      }
    }

    const registros = await getHistorialVigente(desde, hasta);

    return NextResponse.json(
      {
        desde: desde ?? null,
        hasta: hasta ?? null,
        total: registros.length,
        registros: registros.map((r) => ({
          fecha: r.fecha,
          hora_fijacion: r.hora_fijacion,
          precio_lempiras_gramo_fino: r.precio_lempiras_gramo_fino,
          referencia_lbma_usd_oz: r.referencia_lbma_usd_oz,
          tipo_cambio_bch: r.tipo_cambio_bch,
          factor_comercializacion: r.factor_comercializacion,
          version_politica: r.version_politica,
        })),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
    );
  } catch (err) {
    console.error('[api/precio/historico] GET error:', err);
    return NextResponse.json({ error: 'Error al consultar el histórico' }, { status: 500 });
  }
}
