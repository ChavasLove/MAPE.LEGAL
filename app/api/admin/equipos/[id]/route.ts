import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { updateEquipo, deleteEquipo, type CreateEquipoInput } from '@/services/equiposService';
import { CATEGORIA_LABELS, ALLOWED_IMAGE_HOSTS, isAllowedImageUrl } from '@/lib/types/equipo';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Whitelist of PATCH-able fields — same pattern as /api/admin/minas/[id] and
// /api/admin/concesiones/[id]. id/created_at/search_vector can never change.
const PATCH_FIELDS = [
  'slug', 'nombre', 'descripcion', 'descripcion_corta', 'categoria',
  'proveedor', 'precio_min_usd', 'precio_max_usd', 'moq', 'unidad_moq',
  'capacidad', 'potencia', 'peso', 'dimensiones', 'imagen_url',
  'galeria_urls', 'especificaciones', 'destacado', 'activo', 'orden',
] as const;

// PATCH /api/admin/equipos/[id] — update equipment (whitelisted fields)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    for (const field of PATCH_FIELDS) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Sin campos válidos para actualizar' },
        { status: 400 }
      );
    }

    if ('categoria' in updates && !(String(updates.categoria) in CATEGORIA_LABELS)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    }

    if ('slug' in updates && !/^[a-z0-9-]+$/.test(String(updates.slug))) {
      return NextResponse.json(
        { error: 'El slug solo puede contener letras minúsculas, números y guiones' },
        { status: 400 }
      );
    }

    // Numeric validation mirrors POST — without it, a cleared form field
    // arrives as null (NaN → JSON null), passes the whitelist, and violates
    // NOT NULL / CHECK constraints as an opaque 500 instead of a 400.
    if ('precio_min_usd' in updates &&
        (!Number.isInteger(updates.precio_min_usd) || (updates.precio_min_usd as number) <= 0)) {
      return NextResponse.json(
        { error: 'precio_min_usd debe ser un entero mayor a 0' },
        { status: 400 }
      );
    }
    if ('precio_max_usd' in updates && updates.precio_max_usd !== null &&
        (!Number.isInteger(updates.precio_max_usd) || (updates.precio_max_usd as number) <= 0)) {
      return NextResponse.json(
        { error: 'precio_max_usd debe ser un entero mayor a 0, o null para quitar el rango' },
        { status: 400 }
      );
    }
    if (Number.isInteger(updates.precio_min_usd) && Number.isInteger(updates.precio_max_usd) &&
        (updates.precio_max_usd as number) < (updates.precio_min_usd as number)) {
      return NextResponse.json(
        { error: 'precio_max_usd debe ser mayor o igual a precio_min_usd' },
        { status: 400 }
      );
    }
    if ('moq' in updates && (!Number.isInteger(updates.moq) || (updates.moq as number) <= 0)) {
      return NextResponse.json({ error: 'moq debe ser un entero mayor a 0' }, { status: 400 });
    }
    if ('orden' in updates && !Number.isInteger(updates.orden)) {
      return NextResponse.json({ error: 'orden debe ser un entero' }, { status: 400 });
    }
    if ('activo' in updates && typeof updates.activo !== 'boolean') {
      return NextResponse.json({ error: 'activo debe ser booleano' }, { status: 400 });
    }

    const imageCandidates: unknown[] = [
      ...('imagen_url' in updates ? [updates.imagen_url] : []),
      ...('galeria_urls' in updates && Array.isArray(updates.galeria_urls) ? updates.galeria_urls : []),
    ];
    if (imageCandidates.some((u) => typeof u !== 'string' || !isAllowedImageUrl(u))) {
      return NextResponse.json(
        { error: `Las imágenes deben ser URLs https de: ${ALLOWED_IMAGE_HOSTS.join(', ')}. next/image rechaza otros hosts.` },
        { status: 400 }
      );
    }

    const equipo = await updateEquipo(id, updates as Partial<CreateEquipoInput>);
    return NextResponse.json(equipo);
  } catch (err) {
    console.error('[api/admin/equipos/:id] PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Error al actualizar equipo';
    const status = message.includes('Ya existe') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/admin/equipos/[id] — soft delete (activo = false)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    await deleteEquipo(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/equipos/:id] DELETE error:', err);
    return NextResponse.json(
      { error: 'Error al eliminar equipo' },
      { status: 500 }
    );
  }
}
