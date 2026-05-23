import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const COMPONENTES = ['tierra', 'inhgeomin', 'ambiental', 'municipal', 'registro'] as const;
const ESTADOS_COMPONENTE = ['pendiente', 'en_proceso', 'cumplido', 'alerta', 'incumplido'] as const;

type Componente = typeof COMPONENTES[number];
type EstadoComponente = typeof ESTADOS_COMPONENTE[number];

interface UpsertPayload {
  componente: Componente;
  estado?:    EstadoComponente;
  puntaje?:   number;
  notas?:     string | null;
}

interface IndiceRow {
  id: string | null;
  mina_id: string;
  expediente_id: string | null;
  componente: string;
  estado: string;
  puntaje: number;
  notas: string | null;
  verificado_por: string | null;
  verificado_en: string | null;
  created_at: string | null;
  updated_at: string | null;
  _persisted?: boolean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mina_id: string }> }
) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const { mina_id } = await params;
  const admin = getAdminClient();

  const { data: rows, error } = await admin
    .from('indice_legalidad')
    .select('*')
    .eq('mina_id', mina_id);

  if (error) {
    console.error('[admin/indice-legalidad GET] failed:', error);
    return NextResponse.json({ error: 'Error al cargar el índice de legalidad' }, { status: 500 });
  }

  const byComponente = new Map<string, IndiceRow>();
  ((rows ?? []) as IndiceRow[]).forEach(r => {
    byComponente.set(r.componente, { ...r, _persisted: true });
  });

  const result: IndiceRow[] = COMPONENTES.map(componente => byComponente.get(componente) ?? {
    id: null,
    mina_id,
    expediente_id: null,
    componente,
    estado: 'pendiente',
    puntaje: 0,
    notas: null,
    verificado_por: null,
    verificado_en: null,
    created_at: null,
    updated_at: null,
    _persisted: false,
  });

  const total = result.reduce((sum, r) => sum + (r.puntaje ?? 0), 0);

  return NextResponse.json({ componentes: result, total });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ mina_id: string }> }
) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const { mina_id } = await params;

  let body: UpsertPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!COMPONENTES.includes(body.componente)) {
    return NextResponse.json({ error: 'componente inválido.' }, { status: 400 });
  }
  if (body.estado && !ESTADOS_COMPONENTE.includes(body.estado)) {
    return NextResponse.json({ error: 'estado inválido.' }, { status: 400 });
  }
  if (body.puntaje != null && (!Number.isFinite(body.puntaje) || body.puntaje < 0 || body.puntaje > 20)) {
    return NextResponse.json({ error: 'puntaje debe ser un número entre 0 y 20.' }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: mina } = await admin.from('minas').select('id').eq('id', mina_id).maybeSingle();
  if (!mina) return NextResponse.json({ error: 'Mina no encontrada.' }, { status: 404 });

  const upsertRow = {
    mina_id,
    componente:     body.componente,
    estado:         body.estado  ?? 'pendiente',
    puntaje:        body.puntaje ?? 0,
    notas:          body.notas   ?? null,
    verificado_por: auth.user.id,
    verificado_en:  new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('indice_legalidad')
    .upsert(upsertRow, { onConflict: 'mina_id,componente' })
    .select()
    .single();

  if (error) {
    console.error('[admin/indice-legalidad PATCH] upsert failed:', error);
    return NextResponse.json({ error: 'Error al guardar el componente' }, { status: 500 });
  }
  return NextResponse.json(data);
}
