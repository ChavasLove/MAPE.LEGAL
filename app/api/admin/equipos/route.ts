import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { listEquiposAdmin, createEquipo, type CreateEquipoInput } from '@/services/equiposService';
import { CATEGORIA_LABELS, ALLOWED_IMAGE_HOSTS, isAllowedImageUrl } from '@/lib/types/equipo';

export const dynamic = 'force-dynamic';

// GET /api/admin/equipos — list all equipment (incl. inactive)
export async function GET(request: NextRequest) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const page     = Math.max(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') ?? '50', 10) || 50, 1), 200);

    const { equipos, total } = await listEquiposAdmin(page, pageSize);
    return NextResponse.json({ equipos, total });
  } catch (err) {
    console.error('[api/admin/equipos] GET error:', err);
    return NextResponse.json(
      { error: 'Error al listar equipos' },
      { status: 500 }
    );
  }
}

// POST /api/admin/equipos — create new equipment
export async function POST(request: NextRequest) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    if (!body.slug || !body.nombre || !body.categoria || !body.proveedor || !body.imagen_url) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: slug, nombre, categoria, proveedor, imagen_url' },
        { status: 400 }
      );
    }

    if (!(body.categoria in CATEGORIA_LABELS)) {
      return NextResponse.json(
        { error: 'Categoría inválida' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(body.precio_min_usd) || body.precio_min_usd <= 0) {
      return NextResponse.json(
        { error: 'precio_min_usd debe ser un entero mayor a 0' },
        { status: 400 }
      );
    }

    // Validate the range here → friendly 400 instead of DB CHECK 23514 → 500
    if (
      body.precio_max_usd != null &&
      (!Number.isInteger(body.precio_max_usd) || body.precio_max_usd < body.precio_min_usd)
    ) {
      return NextResponse.json(
        { error: 'precio_max_usd debe ser un entero mayor o igual a precio_min_usd' },
        { status: 400 }
      );
    }

    const galeria: unknown[] = Array.isArray(body.galeria_urls) ? body.galeria_urls : [];
    const badImage = [body.imagen_url, ...galeria].find(
      (u) => typeof u !== 'string' || !isAllowedImageUrl(u)
    );
    if (badImage !== undefined) {
      return NextResponse.json(
        { error: `Las imágenes deben ser URLs https de: ${ALLOWED_IMAGE_HOSTS.join(', ')}. next/image rechaza otros hosts.` },
        { status: 400 }
      );
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(body.slug)) {
      return NextResponse.json(
        { error: 'El slug solo puede contener letras minúsculas, números y guiones' },
        { status: 400 }
      );
    }

    const input: CreateEquipoInput = {
      slug: body.slug,
      nombre: body.nombre,
      descripcion: body.descripcion,
      descripcion_corta: body.descripcion_corta,
      categoria: body.categoria,
      proveedor: body.proveedor,
      precio_min_usd: body.precio_min_usd,
      precio_max_usd: body.precio_max_usd,
      moq: body.moq,
      unidad_moq: body.unidad_moq,
      capacidad: body.capacidad,
      potencia: body.potencia,
      peso: body.peso,
      dimensiones: body.dimensiones,
      imagen_url: body.imagen_url,
      galeria_urls: body.galeria_urls,
      especificaciones: body.especificaciones,
      destacado: body.destacado,
      orden: body.orden,
    };

    const equipo = await createEquipo(input);
    return NextResponse.json(equipo, { status: 201 });
  } catch (err) {
    console.error('[api/admin/equipos] POST error:', err);
    // Service throws our own Spanish messages — safe to surface. 23505 → 409.
    const message = err instanceof Error ? err.message : 'Error al crear equipo';
    const status = message.includes('Ya existe') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
