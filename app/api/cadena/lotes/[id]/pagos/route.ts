// /api/cadena/lotes/[id]/pagos — pago bancario e identificable al minero.
//
// POST comercializador propio | admin. Body { medio, referencia_bancaria,
// monto_lps, banco?, fecha_pago }. La regla "efectivo prohibido / referencia
// obligatoria" vive en validarPago (lib/cadena/reglas.ts) y en el RPC
// `registrar_pago_lote` de la 043. El RPC se llama SIEMPRE — también cuando la
// pre-validación JS falla — porque es el que BLOQUEA el lote en BD ante un
// intento inválido (y asienta la alerta `pago_invalido`). No existe bypass.
//   RPC {ok:false, motivo, lote_bloqueado:true}  → 422 { error:'pago_invalido', motivo, lote_bloqueado }
//   RPC {ok:false, motivo:'lote_bloqueado'|'lote_cerrado'} → 409 { error:'lote_no_admite_pagos', motivo, lote_bloqueado }
//   RPC {ok:false, motivo:'monto_invalido'}      → 422 { error:'pago_invalido', motivo, lote_bloqueado:false }
//   RPC {ok:true, pago_id}                       → 201 { pago }
// `planta` jamás llega aquí (ni lectura ni escritura de pagos).

import { NextResponse } from 'next/server';
import { cargarLote, iniciarSesionCadena, leerJson, noEncontrado, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { puedeRegistrarPago, puedeVerLote } from '@/lib/cadena/acceso';
import { validarPago } from '@/lib/cadena/reglas';
import type { PagoLote } from '@/lib/cadena/types';
import { validarBodyPago } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RpcPagoResult {
  ok: boolean;
  motivo?: string;
  lote_bloqueado?: boolean;
  pago_id?: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'comercializador');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;

  const lote = await cargarLote(admin, id, '[cadena/pagos POST]');
  if (lote instanceof NextResponse) return lote;
  if (!lote || !puedeVerLote(ctx, lote)) return noEncontrado('Lote');
  if (!puedeRegistrarPago(ctx, lote)) {
    return NextResponse.json({ error: 'Solo el comercializador del lote (o admin) registra pagos.' }, { status: 403 });
  }

  const body = await leerJson(req);
  if (body instanceof NextResponse) return body;
  const v = validarBodyPago(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.data;

  // Pre-validación de negocio (solo informativa para el log): el RPC es la
  // autoridad y recibe el intento tal cual para bloquear el lote si procede.
  const pre = validarPago({ medio: d.medio, referencia_bancaria: d.referencia_bancaria });
  if (!pre.ok) {
    console.warn('[cadena/pagos POST] intento de pago inválido → RPC bloqueará el lote:', { lote: lote.id, motivo: pre.motivo, rol: ctx.rol });
  }

  const { data, error } = await admin.rpc('registrar_pago_lote', {
    p_lote: lote.id,
    p_medio: d.medio,
    p_referencia: d.referencia_bancaria,
    p_monto: d.monto_lps,
    p_banco: d.banco,
    p_fecha_pago: d.fecha_pago,
    p_registrado_por: ctx.userId,
  });
  if (error) return respuestaErrorDb('[cadena/pagos POST]', error, { generico: 'Error al registrar el pago' });

  const r = (data ?? {}) as RpcPagoResult;
  if (!r.ok) {
    const motivo = r.motivo ?? (pre.ok ? 'rechazado_por_bd' : pre.motivo);
    // El RPC distingue: el lote ya no admite pagos (bloqueado/cerrado antes de
    // este intento) → 409; intento inválido (efectivo, sin referencia, medio
    // no admitido) → 422 y el RPC acaba de bloquear el lote.
    if (motivo === 'lote_bloqueado' || motivo === 'lote_cerrado' || motivo === 'lote_no_existe') {
      return NextResponse.json({ error: 'lote_no_admite_pagos', motivo, lote_bloqueado: r.lote_bloqueado ?? false }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'pago_invalido', motivo, lote_bloqueado: r.lote_bloqueado ?? true },
      { status: 422 },
    );
  }
  if (!r.pago_id) {
    console.error('[cadena/pagos POST] RPC ok sin pago_id:', data);
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 });
  }

  const { data: pago, error: pagoErr } = await admin.from('pagos_lote').select('*').eq('id', r.pago_id).maybeSingle();
  if (pagoErr) return respuestaErrorDb('[cadena/pagos POST]', pagoErr, { generico: 'Pago registrado, pero no se pudo leer' });

  return NextResponse.json({ pago: (pago as PagoLote | null) ?? { id: r.pago_id, lote_id: lote.id } }, { status: 201 });
}
