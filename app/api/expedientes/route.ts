import { NextResponse } from 'next/server';
import { createExpediente, getExpedientes } from '@/services/expedientesService';

export async function GET() {
  try {
    const expedientes = await getExpedientes();
    return NextResponse.json(expedientes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expedientes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const expediente = await createExpediente(body.name);
    return NextResponse.json(expediente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create expediente' }, { status: 500 });
  }
}
