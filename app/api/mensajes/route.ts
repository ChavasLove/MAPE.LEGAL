import { NextResponse } from 'next/server';
import { getDashMensajes } from '@/services/dashboardService';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  // proxy.ts only checks cookie presence (edge first-line filter). Defense in
  // depth: re-validate the JWT + role here, matching every other dashboard route.
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const mensajes = await getDashMensajes();
    return NextResponse.json(mensajes);
  } catch (error) {
    console.error('[mensajes] GET failed:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los mensajes' }, { status: 500 });
  }
}
