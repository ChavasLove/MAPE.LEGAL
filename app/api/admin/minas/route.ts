import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';

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
