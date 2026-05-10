import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

type MinaRow = {
  id: string;
  cliente_id: string | null;
  nombre: string;
  codigo: string | null;
  latitud: number | null;
  longitud: number | null;
  municipio: string | null;
  departamento: string | null;
  area_hectareas: number | null;
  tipo_mineral: string;
  tipo_concesion: string;
  estado: string;
  created_at: string;
};

type ClienteSlim = { id: string; nombre: string | null; telefono_whatsapp: string | null };

export async function GET() {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();

  const { data, error } = await admin
    .from('minas')
    .select(`
      id, cliente_id, nombre, codigo, latitud, longitud,
      municipio, departamento, area_hectareas,
      tipo_mineral, tipo_concesion, estado, created_at
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const minas = (data ?? []) as MinaRow[];
  const clienteIds = Array.from(new Set(minas.map(m => m.cliente_id).filter((v): v is string => !!v)));

  const clientesById: Record<string, ClienteSlim> = {};
  if (clienteIds.length > 0) {
    const { data: clientes } = await admin
      .from('clientes')
      .select('id, nombre, telefono_whatsapp')
      .in('id', clienteIds);
    (clientes ?? []).forEach((c: ClienteSlim) => { clientesById[c.id] = c; });
  }

  const result = minas.map(m => ({
    ...m,
    cliente: m.cliente_id ? clientesById[m.cliente_id] ?? null : null,
  }));

  return NextResponse.json(result);
}

const TIPO_MINERAL_VALUES   = ['oro', 'plata', 'cobre', 'zinc', 'plomo', 'otro'] as const;
const TIPO_CONCESION_VALUES = ['artesanal', 'exploracion', 'explotacion'] as const;
const ESTADO_VALUES         = ['en_tramite', 'activa', 'suspendida', 'clausurada'] as const;

type TipoMineral   = typeof TIPO_MINERAL_VALUES[number];
type TipoConcesion = typeof TIPO_CONCESION_VALUES[number];
type EstadoMina    = typeof ESTADO_VALUES[number];

interface CreateMinaPayload {
  cliente_id?:     string | null;
  nombre:          string;
  codigo?:         string | null;
  latitud?:        number | null;
  longitud?:       number | null;
  municipio?:      string | null;
  departamento?:   string | null;
  area_hectareas?: number | null;
  tipo_mineral?:   TipoMineral;
  tipo_concesion?: TipoConcesion;
  estado?:         EstadoMina;
}

function validateMina(p: Partial<CreateMinaPayload>): string | null {
  if (!p.nombre || typeof p.nombre !== 'string' || p.nombre.trim().length < 3) {
    return 'El nombre debe tener al menos 3 caracteres.';
  }
  if (p.tipo_mineral && !TIPO_MINERAL_VALUES.includes(p.tipo_mineral)) {
    return 'tipo_mineral inválido.';
  }
  if (p.tipo_concesion && !TIPO_CONCESION_VALUES.includes(p.tipo_concesion)) {
    return 'tipo_concesion inválido.';
  }
  if (p.estado && !ESTADO_VALUES.includes(p.estado)) {
    return 'estado inválido.';
  }
  if (p.latitud != null && (p.latitud < -90 || p.latitud > 90)) return 'Latitud fuera de rango.';
  if (p.longitud != null && (p.longitud < -180 || p.longitud > 180)) return 'Longitud fuera de rango.';
  if (p.area_hectareas != null && p.area_hectareas < 0) return 'Área no puede ser negativa.';
  return null;
}

export async function POST(req: Request) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  let body: CreateMinaPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const err = validateMina(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const admin = getAdminClient();

  if (body.codigo) {
    const { data: existing } = await admin
      .from('minas')
      .select('id')
      .eq('codigo', body.codigo)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una mina con código ${body.codigo}.` },
        { status: 409 }
      );
    }
  }

  if (body.cliente_id) {
    const { data: cliente } = await admin
      .from('clientes')
      .select('id')
      .eq('id', body.cliente_id)
      .maybeSingle();
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 400 });
    }
  }

  const { data, error } = await admin
    .from('minas')
    .insert({
      cliente_id:     body.cliente_id ?? null,
      nombre:         body.nombre.trim(),
      codigo:         body.codigo?.trim() || null,
      latitud:        body.latitud ?? null,
      longitud:       body.longitud ?? null,
      municipio:      body.municipio?.trim() || null,
      departamento:   body.departamento?.trim() || null,
      area_hectareas: body.area_hectareas ?? null,
      tipo_mineral:   body.tipo_mineral   ?? 'oro',
      tipo_concesion: body.tipo_concesion ?? 'artesanal',
      estado:         body.estado         ?? 'en_tramite',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Código duplicado.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
