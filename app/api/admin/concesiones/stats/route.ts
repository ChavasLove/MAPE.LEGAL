import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getConcesionStats } from '@/services/concesionesService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const stats = await getConcesionStats();
  if (!stats) {
    return NextResponse.json({ error: 'No se pudieron obtener estadísticas.' }, { status: 500 });
  }
  return NextResponse.json(stats);
}
