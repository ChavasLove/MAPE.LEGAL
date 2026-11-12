// /api/cadena/lotes/[id] — detalle de un lote: eventos encadenados (con la
// verificación JS de la cadena de hash), alertas y pagos según rol.
//
// `pagos` se OMITE por completo para `planta` (ni la clave aparece); `cliente`
// solo ve los pagos cuyo beneficiario es él; `auditor` los ve sin monto. Para
// `planta` el expediente del minero NO viaja aquí: vive en
// /api/cadena/lotes/[id]/expediente, gateado por consentimiento vigente.
// Un lote fuera del alcance del rol responde 404 (sin enumeración).

import { NextResponse } from 'next/server';
import { cargarLote, iniciarSesionCadena, noEncontrado, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { filtrarPagosVisibles, puedeVerLote, puedeVerPagos } from '@/lib/cadena/acceso';
import { verificarCadena, type ResultadoVerificacion } from '@/lib/cadena/hash';
import type { AlertaLote, LoteEvento, PagoLote } from '@/lib/cadena/types';
import { redactarPagoParaAuditor } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'auditor', 'comercializador', 'planta', 'cliente');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;

  const lote = await cargarLote(admin, id, '[cadena/lotes/[id] GET]');
  if (lote instanceof NextResponse) return lote;
  if (!lote || !puedeVerLote(ctx, lote)) return noEncontrado('Lote');

  const verPagos = puedeVerPagos(ctx, lote);

  const [eventosRes, alertasRes, pagosRes] = await Promise.all([
    admin.from('lote_eventos').select('*').eq('lote_id', lote.id).order('secuencia', { ascending: true }),
    admin.from('alertas_lote').select('*').eq('lote_id', lote.id).order('created_at', { ascending: false }),
    verPagos
      ? admin.from('pagos_lote').select('*').eq('lote_id', lote.id).order('fecha_pago', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (eventosRes.error) return respuestaErrorDb('[cadena/lotes/[id] GET]', eventosRes.error, { generico: 'Error al obtener eventos' });
  if (alertasRes.error) return respuestaErrorDb('[cadena/lotes/[id] GET]', alertasRes.error, { generico: 'Error al obtener alertas' });
  if (pagosRes.error) return respuestaErrorDb('[cadena/lotes/[id] GET]', pagosRes.error, { generico: 'Error al obtener pagos' });

  const eventos = (eventosRes.data ?? []) as LoteEvento[];
  const alertas = (alertasRes.data ?? []) as AlertaLote[];

  let verificacion: ResultadoVerificacion;
  try {
    verificacion = verificarCadena(eventos);
  } catch (err) {
    // Un evento con formato irrecuperable (fecha/peso corruptos) también es rotura.
    console.error('[cadena/lotes/[id] GET] verificarCadena threw:', err);
    verificacion = { ok: false, total: eventos.length, primeraRotura: null, motivo: 'evento_ilegible' };
  }

  const respuesta: Record<string, unknown> = {
    lote,
    eventos,
    alertas,
    verificacion,
    // La conciliación se ejecuta bajo demanda (POST …/conciliar) y la 043 no
    // persiste un historial de conciliaciones: siempre null en esta versión.
    conciliacion_ultima: null,
  };

  if (verPagos) {
    const visibles = filtrarPagosVisibles(ctx, (pagosRes.data ?? []) as PagoLote[]);
    respuesta.pagos = ctx.rol === 'auditor' ? visibles.map(redactarPagoParaAuditor) : visibles;
  }

  registrarAcceso({
    ctx,
    accion: 'lectura',
    recurso_tipo: 'lote',
    recurso_id: lote.id,
    detalle: { codigo: lote.codigo, eventos: eventos.length, con_pagos: verPagos },
  });
  return NextResponse.json(respuesta);
}
