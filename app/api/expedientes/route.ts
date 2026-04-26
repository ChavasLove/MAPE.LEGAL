import { NextResponse } from 'next/server';
import {
  getDashExpedientes,
  createDashExpediente,
  type CreateExpedienteInput,
} from '@/services/dashboardService';

export async function GET() {
  try {
    const expedientes = await getDashExpedientes();
    return NextResponse.json(expedientes);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch expedientes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    const msg = error instanceof Error ? error.message : 'Failed to create expediente';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
