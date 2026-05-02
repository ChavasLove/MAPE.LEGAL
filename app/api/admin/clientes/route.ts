import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ClienteRow = {
  id: string;
  nombre: string | null;
  dpi: string | null;
  municipio: string | null;
  tipo_mineral: string | null;
  situacion_tierra: string | null;
  telefono_whatsapp: string | null;
  created_at: string;
};

type ExpedienteRow = {
  id: string;
  numero_expediente: string | null;
  tipo: string | null;
  estado: string | null;
  fase_numero: number | null;
  paso: number | null;
  total_pasos: number | null;
  cierre_estimado: string | null;
  cliente_id: string;
};

export async function GET() {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('clientes')
    .select(`
      id, nombre, dpi, municipio, tipo_mineral, situacion_tierra,
      telefono_whatsapp, created_at
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch expedientes linked to each client via cliente_id FK
  const clientes = (data ?? []) as ClienteRow[];
  const ids = clientes.map((c: ClienteRow) => c.id);
  const expedientesByCliente: Record<string, ExpedienteRow[]> = {};

  if (ids.length > 0) {
    const { data: exps } = await admin
      .from('expedientes')
      .select('id, numero_expediente, tipo, estado, fase_numero, paso, total_pasos, cierre_estimado, cliente_id')
      .in('cliente_id', ids);

    (exps ?? [] as ExpedienteRow[]).forEach((exp: ExpedienteRow) => {
      if (!expedientesByCliente[exp.cliente_id]) expedientesByCliente[exp.cliente_id] = [];
      expedientesByCliente[exp.cliente_id].push(exp);
    });
  }

  const result = clientes.map((c: ClienteRow) => ({
    ...c,
    expedientes: expedientesByCliente[c.id] ?? [],
  }));

  return NextResponse.json(result);
}
