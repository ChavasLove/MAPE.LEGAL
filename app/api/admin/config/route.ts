import { NextResponse } from 'next/server';
import { getAllConfig, setConfigs } from '@/services/configService';
import { requireRole } from '@/lib/serverAuth';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await getAllConfig();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al obtener configuración';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const updates = await req.json();
    if (typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'Se espera un objeto clave: valor' }, { status: 400 });
    }
    await setConfigs(updates as Record<string, string>);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al guardar configuración';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
