import { NextResponse } from 'next/server';
import { getCmsContent, upsertCmsField, deleteCmsField } from '@/services/cmsService';
import { requireRole } from '@/lib/serverAuth';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await getCmsContent();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al obtener contenido';
    return NextResponse.json({ error: msg }, { status: 500 });
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
    await upsertCmsField(seccion, campo, valor ?? '', tipo ?? 'texto');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al guardar campo';
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const msg = error instanceof Error ? error.message : 'Error al eliminar campo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
