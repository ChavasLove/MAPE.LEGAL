import { NextResponse } from 'next/server';
import { getCmsContent, upsertCmsField, deleteCmsField } from '@/services/cmsService';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const VALID_TIPOS = ['texto', 'html', 'numero', 'url', 'secreto', 'imagen'] as const;
const MAX_LENGTH = { seccion: 80, campo: 80, valor: 20_000 };

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await getCmsContent();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/cms GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener contenido' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { seccion, campo, valor, tipo } = await req.json();
    if (!seccion || !campo) {
      return NextResponse.json({ error: 'seccion y campo son requeridos' }, { status: 400 });
    }
    if (typeof seccion !== 'string' || seccion.length > MAX_LENGTH.seccion) {
      return NextResponse.json({ error: `seccion debe ser texto ≤ ${MAX_LENGTH.seccion} chars` }, { status: 400 });
    }
    if (typeof campo !== 'string' || campo.length > MAX_LENGTH.campo) {
      return NextResponse.json({ error: `campo debe ser texto ≤ ${MAX_LENGTH.campo} chars` }, { status: 400 });
    }
    if (valor != null && (typeof valor !== 'string' || valor.length > MAX_LENGTH.valor)) {
      return NextResponse.json({ error: `valor debe ser texto ≤ ${MAX_LENGTH.valor} chars` }, { status: 400 });
    }
    const tipoResolved = tipo ?? 'texto';
    if (!(VALID_TIPOS as readonly string[]).includes(tipoResolved)) {
      return NextResponse.json(
        { error: `tipo inválido — use uno de: ${VALID_TIPOS.join(', ')}` },
        { status: 400 }
      );
    }
    await upsertCmsField(seccion, campo, valor ?? '', tipoResolved);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/cms POST] failed:', error);
    return NextResponse.json({ error: 'Error al guardar campo' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { seccion, campo } = await req.json();
    if (!seccion || !campo) {
      return NextResponse.json({ error: 'seccion y campo son requeridos' }, { status: 400 });
    }
    await deleteCmsField(seccion, campo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/cms DELETE] failed:', error);
    return NextResponse.json({ error: 'Error al eliminar campo' }, { status: 500 });
  }
}
