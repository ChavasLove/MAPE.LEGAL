import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const TIPO_MINERAL_VALUES   = ['oro', 'plata', 'cobre', 'zinc', 'plomo', 'otro'] as const;
const TIPO_CONCESION_VALUES = ['artesanal', 'exploracion', 'explotacion'] as const;
const ESTADO_VALUES         = ['en_tramite', 'activa', 'suspendida', 'clausurada'] as const;

const ALLOWED_PATCH_FIELDS = new Set([
  'cliente_id', 'nombre', 'codigo', 'latitud', 'longitud',
  'municipio', 'departamento', 'area_hectareas',
  'tipo_mineral', 'tipo_concesion', 'estado',
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = getAdminClient();

  const { data: mina, error: minaErr } = await admin
    .from('minas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (minaErr) return NextResponse.json({ error: minaErr.message }, { status: 500 });
  if (!mina)   return NextResponse.json({ error: 'Mina no encontrada.' }, { status: 404 });

  let cliente = null;
  if (mina.cliente_id) {
    const { data } = await admin
      .from('clientes')
      .select('id, nombre, dpi, telefono_whatsapp, municipio, departamento')
      .eq('id', mina.cliente_id)
      .maybeSingle();
    cliente = data ?? null;
  }

  const { data: indice } = await admin
    .from('indice_legalidad')
    .select('*')
    .eq('mina_id', id);

  const { data: contratos } = await admin
    .from('contratos')
    .select('id, tipo, fecha_firma, fecha_vencimiento, monto_total, moneda, estado')
    .eq('mina_id', id)
    .order('fecha_firma', { ascending: false, nullsFirst: false });

  const { data: transacciones } = await admin
    .from('transacciones_oro')
    .select('id, fecha, gramos, precio_usd_gramo, total_usd, total_hnl, estado')
    .eq('mina_id', id)
    .order('fecha', { ascending: false })
    .limit(20);

  const { count: certificadosCount } = await admin
    .from('certificados_origen')
    .select('id', { count: 'exact', head: true })
    .eq('mina_id', id);

  return NextResponse.json({
    mina,
    cliente,
    indice_legalidad: indice ?? [],
    contratos:        contratos ?? [],
    transacciones:    transacciones ?? [],
    certificados_count: certificadosCount ?? 0,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_PATCH_FIELDS.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  if (update.tipo_mineral && !TIPO_MINERAL_VALUES.includes(update.tipo_mineral as typeof TIPO_MINERAL_VALUES[number])) {
    return NextResponse.json({ error: 'tipo_mineral inválido.' }, { status: 400 });
  }
  if (update.tipo_concesion && !TIPO_CONCESION_VALUES.includes(update.tipo_concesion as typeof TIPO_CONCESION_VALUES[number])) {
    return NextResponse.json({ error: 'tipo_concesion inválido.' }, { status: 400 });
  }
  if (update.estado && !ESTADO_VALUES.includes(update.estado as typeof ESTADO_VALUES[number])) {
    return NextResponse.json({ error: 'estado inválido.' }, { status: 400 });
  }
  if (typeof update.nombre === 'string' && update.nombre.trim().length < 3) {
    return NextResponse.json({ error: 'Nombre debe tener al menos 3 caracteres.' }, { status: 400 });
  }
  if (typeof update.latitud === 'number' && (update.latitud < -90 || update.latitud > 90)) {
    return NextResponse.json({ error: 'Latitud fuera de rango.' }, { status: 400 });
  }
  if (typeof update.longitud === 'number' && (update.longitud < -180 || update.longitud > 180)) {
    return NextResponse.json({ error: 'Longitud fuera de rango.' }, { status: 400 });
  }
  if (typeof update.area_hectareas === 'number' && update.area_hectareas < 0) {
    return NextResponse.json({ error: 'Área no puede ser negativa.' }, { status: 400 });
  }

  if (typeof update.nombre === 'string') update.nombre = update.nombre.trim();
  if (typeof update.codigo === 'string') update.codigo = update.codigo.trim() || null;
  if (typeof update.municipio === 'string') update.municipio = update.municipio.trim() || null;
  if (typeof update.departamento === 'string') update.departamento = update.departamento.trim() || null;

  const admin = getAdminClient();

  if (update.cliente_id) {
    const { data: cliente } = await admin
      .from('clientes')
      .select('id')
      .eq('id', update.cliente_id as string)
      .maybeSingle();
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 400 });
    }
  }

  const { data, error } = await admin
    .from('minas')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Código duplicado.' }, { status: 409 });
    }
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Mina no encontrada.' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
