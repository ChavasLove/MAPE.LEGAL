import { NextResponse } from 'next/server';
import {
  getDashExpedientes,
  createDashExpediente,
  type CreateExpedienteInput,
} from '@/services/dashboardService';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const expedientes = await getDashExpedientes();
    return NextResponse.json(expedientes);
  } catch (error) {
    console.error('[expedientes GET] failed:', error);
    return NextResponse.json({ error: 'Error al cargar expedientes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();

    const required: (keyof CreateExpedienteInput)[] = [
      'cliente', 'tipo', 'municipio',
      'abogado_nombre', 'abogado_iniciales',
      'psa_nombre', 'psa_iniciales',
    ];
    for (const field of required) {
      if (!body[field] || typeof body[field] !== 'string') {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    const expediente = await createDashExpediente(body as CreateExpedienteInput);
    return NextResponse.json(expediente, { status: 201 });
  } catch (error) {
    console.error('[expedientes POST] failed:', error);
    return NextResponse.json({ error: 'Error al crear expediente' }, { status: 500 });
  }
}
