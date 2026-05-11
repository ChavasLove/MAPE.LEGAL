import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = [
  'codigo',
  'nombre_zona',
  'fecha_solicitud',
  'tipo_expediente',
  'solicitante',
  'estado_expediente',
  'clasificacion',
  'categoria',
  'notas',
] as const;

type UpdatePayload = Partial<Record<typeof ALLOWED_FIELDS[number], string | null>>;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('concesiones_mineras_registro')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'No encontrado.' },   { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;

  let body: UpdatePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in body) patch[k] = body[k] ?? null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('concesiones_mineras_registro')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Conflicto de unicidad (categoría + número).' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json(data);
}
