import { NextResponse } from 'next/server';
import { getAllConfig, updateExistingConfigs } from '@/services/configService';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await getAllConfig();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/config GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const updates = await req.json();
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'Se espera un objeto clave: valor' }, { status: 400 });
    }

    // Coerce all values to strings (configuracion_sistema.valor is text). Skip
    // entries whose value is null/undefined to avoid persisting "null" as a
    // literal string.
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v == null) continue;
      sanitized[k] = String(v);
    }

    const { updated, ignored } = await updateExistingConfigs(sanitized);

    if (ignored.length > 0) {
      console.warn('[admin/config PATCH] ignored unknown keys:', ignored);
      return NextResponse.json(
        {
          error: `Hay claves no reconocidas. Para añadir claves nuevas usa una migración.`,
          updated,
          ignored,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error('[admin/config PATCH] failed:', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
