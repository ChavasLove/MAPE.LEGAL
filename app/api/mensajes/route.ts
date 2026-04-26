import { NextResponse } from 'next/server';
import { getDashMensajes } from '@/services/dashboardService';

export async function GET() {
  try {
    const mensajes = await getDashMensajes();
    return NextResponse.json(mensajes);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch mensajes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
