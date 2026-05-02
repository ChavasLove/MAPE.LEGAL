import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';

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
  const ids = (data ?? []).map(c => c.id);
  let expedientesByCliente: Record<string, unknown[]> = {};

  if (ids.length > 0) {
    const { data: exps } = await admin
      .from('expedientes')
      .select('id, numero_expediente, tipo, estado, fase_numero, paso, total_pasos, cierre_estimado, cliente_id')
      .in('cliente_id', ids);

    (exps ?? []).forEach(exp => {
      if (!expedientesByCliente[exp.cliente_id]) expedientesByCliente[exp.cliente_id] = [];
      expedientesByCliente[exp.cliente_id].push(exp);
    });
  }

  const result = (data ?? []).map(c => ({
    ...c,
    expedientes: expedientesByCliente[c.id] ?? [],
  }));

  return NextResponse.json(result);
}
