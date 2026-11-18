// /api/cadena/lotes/[id]/conciliar — conciliación de pesos entre los puntos
// de la cadena (origen_mina → acopio → laboratorio → refinado).
//
// POST comercializador propio | admin → RPC `conciliar_lote(p_lote, p_actor)`
// (misma regla que conciliarPesos en lib/cadena/reglas.ts). Respuesta
// { conciliacion, lote } con el lote re-leído (el RPC puede dejarlo en
// `conciliado` o registrar alertas). Sin umbral configurado
// (configuracion_sistema.umbral_conciliacion_peso_pct = NULL) el estado es
// `umbral_no_configurado` y ningún lote se concilia — el número lo define
// Willis / LEGAL MINERO, aquí no se inventa.

import { NextResponse } from 'next/server';
import { cargarLote, iniciarSesionCadena, noEncontrado, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { puedeRegistrarPago, puedeVerLote } from '@/lib/cadena/acceso';
import type { Lote } from '@/lib/cadena/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'comercializador');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;

  const lote = await cargarLote(admin, id, '[cadena/conciliar POST]');
  if (lote instanceof NextResponse) return lote;
  if (!lote || !puedeVerLote(ctx, lote)) return noEncontrado('Lote');
  // Misma regla de escritura que los pagos: comercializador dueño o admin.
  if (!puedeRegistrarPago(ctx, lote)) {
    return NextResponse.json({ error: 'Solo el comercializador del lote (o admin) concilia.' }, { status: 403 });
  }

  const { data, error } = await admin.rpc('conciliar_lote', { p_lote: lote.id, p_actor: ctx.userId });
  if (error) return respuestaErrorDb('[cadena/conciliar POST]', error, { generico: 'Error al conciliar el lote' });

  const { data: actualizado, error: relErr } = await admin.from('lotes').select('*').eq('id', lote.id).maybeSingle();
  if (relErr) return respuestaErrorDb('[cadena/conciliar POST]', relErr, { generico: 'Conciliación ejecutada, pero no se pudo releer el lote' });

  return NextResponse.json({ conciliacion: data ?? null, lote: (actualizado as Lote | null) ?? lote });
}
