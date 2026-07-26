import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import {
  listCombustiblesAdmin,
  upsertCombustible,
  type UpsertCombustibleInput,
} from '@/services/combustiblesService';
import { isTipoCombustible } from '@/lib/types/combustible';

export const dynamic = 'force-dynamic';

// GET /api/admin/precios/combustibles — list every fuel row for the editor.
export async function GET() {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const combustibles = await listCombustiblesAdmin();
    return NextResponse.json({ combustibles });
  } catch (err) {
    console.error('[api/admin/precios/combustibles] GET error:', err);
    return NextResponse.json(
      { error: 'Error al listar los precios de combustibles' },
      { status: 500 },
    );
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// PATCH /api/admin/precios/combustibles — upsert one fuel by its unique key.
export async function PATCH(request: NextRequest) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!isTipoCombustible(body.combustible)) {
      return NextResponse.json({ error: 'Tipo de combustible inválido' }, { status: 400 });
    }
    const precio = Number(body.precio_hnl);
    if (!Number.isFinite(precio) || precio <= 0) {
      return NextResponse.json(
        { error: 'El precio debe ser un número mayor a 0' },
        { status: 400 },
      );
    }
    if (body.vigente_desde !== undefined && !ISO_DATE.test(String(body.vigente_desde))) {
      return NextResponse.json(
        { error: 'La fecha de vigencia debe tener formato AAAA-MM-DD' },
        { status: 400 },
      );
    }
    if (body.activo !== undefined && typeof body.activo !== 'boolean') {
      return NextResponse.json({ error: 'activo debe ser booleano' }, { status: 400 });
    }

    const input: UpsertCombustibleInput = {
      combustible: body.combustible,
      precio_hnl: precio,
      updated_by: auth.user.email ?? auth.user.id,
    };
    if (typeof body.unidad === 'string') input.unidad = body.unidad.slice(0, 40);
    if (typeof body.zona === 'string') input.zona = body.zona.slice(0, 80);
    if (typeof body.vigente_desde === 'string') input.vigente_desde = body.vigente_desde;
    if (typeof body.fuente === 'string') input.fuente = body.fuente.slice(0, 120);
    if (typeof body.notas === 'string') input.notas = body.notas.slice(0, 500);
    if (body.notas === null) input.notas = null;
    if (typeof body.activo === 'boolean') input.activo = body.activo;

    const combustible = await upsertCombustible(input);
    return NextResponse.json({ combustible });
  } catch (err) {
    console.error('[api/admin/precios/combustibles] PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Error al guardar el precio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
