// /api/cadena/lotes/[id]/eventos — eventos de la cadena de custodia de un lote.
//
// GET  cualquier rol que vea el lote → { eventos } (orden por secuencia).
// POST comercializador propio: origen_mina | acopio | transporte | correccion | nota
//      planta propia:          recepcion_planta | laboratorio | fundicion | refinado | nota
//      admin:                  cualquier tipo.
//      (matriz en lib/cadena/validacion.ts:tiposEventoPermitidos — el
//      comercializador no llega ni al trigger con una fundición.)
//
// Fundición: se pre-valida con validarEventoFundicion (titular de beneficio
// identificado; nunca realizada por un comercializador). Si falla, 422
// { error: 'fundicion_no_permitida', motivo } y se asienta una alerta
// `fundicion_rechazada` en el lote. El trigger de la 043 aplica la misma regla
// (errcode 23514, mensaje que empieza por `fundicion_no_permitida`) → 422.
//
// secuencia / hash_previo / hash los calcula el trigger BEFORE INSERT; aquí
// solo se manda `detalle_canonico = canonicalJson(detalle)` para que el hash
// SQL y el JS (lib/cadena/hash.ts) coincidan byte a byte.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarLote, iniciarSesionCadena, leerJson, noEncontrado, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { puedeEscribirLote, puedeVerLote } from '@/lib/cadena/acceso';
import { canonicalJson } from '@/lib/cadena/hash';
import { validarEventoFundicion } from '@/lib/cadena/reglas';
import type { LoteEvento } from '@/lib/cadena/types';
import { validarBodyEvento } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'auditor', 'comercializador', 'planta', 'cliente');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;

  const lote = await cargarLote(admin, id, '[cadena/eventos GET]');
  if (lote instanceof NextResponse) return lote;
  if (!lote || !puedeVerLote(ctx, lote)) return noEncontrado('Lote');

  const { data, error } = await admin
    .from('lote_eventos')
    .select('*')
    .eq('lote_id', lote.id)
    .order('secuencia', { ascending: true });
  if (error) return respuestaErrorDb('[cadena/eventos GET]', error, { generico: 'Error al obtener eventos' });

  const eventos = (data ?? []) as LoteEvento[];
  registrarAcceso({ ctx, accion: 'lectura', recurso_tipo: 'lote_eventos', recurso_id: lote.id, detalle: { total: eventos.length } });
  return NextResponse.json({ eventos });
}

async function registrarAlertaFundicion(admin: SupabaseClient, loteId: string, detalle: Record<string, unknown>): Promise<void> {
  const { error } = await admin.from('alertas_lote').insert({ lote_id: loteId, tipo: 'fundicion_rechazada', detalle });
  if (error) console.error('[cadena/eventos POST] alerta fundicion_rechazada insert failed (non-fatal):', error);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'comercializador', 'planta');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;

  const lote = await cargarLote(admin, id, '[cadena/eventos POST]');
  if (lote instanceof NextResponse) return lote;
  if (!lote || !puedeVerLote(ctx, lote)) return noEncontrado('Lote');
  if (!puedeEscribirLote(ctx, lote)) {
    return NextResponse.json({ error: 'Permisos insuficientes sobre este lote.' }, { status: 403 });
  }
  if (lote.estado === 'cerrado') {
    return NextResponse.json({ error: 'El lote está cerrado; no admite eventos nuevos.' }, { status: 409 });
  }

  const body = await leerJson(req);
  if (body instanceof NextResponse) return body;
  const v = validarBodyEvento(body, ctx.rol);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
  const d = v.data;

  if (d.tipo === 'fundicion') {
    const f = validarEventoFundicion({ actor_rol: ctx.rol, detalle: d.detalle });
    if (!f.ok) {
      await registrarAlertaFundicion(admin, lote.id, { motivo: f.motivo, actor_rol: ctx.rol, actor_user_id: ctx.userId, origen: 'api' });
      return NextResponse.json({ error: 'fundicion_no_permitida', motivo: f.motivo }, { status: 422 });
    }
  }

  const fila = {
    lote_id: lote.id,
    tipo: d.tipo,
    actor_user_id: ctx.userId,
    actor_rol: ctx.rol,
    actor_nombre: ctx.email,
    fecha: d.fecha,
    lugar: d.lugar,
    peso_g: d.peso_g,
    ley_fino: d.ley_fino,
    detalle: d.detalle,
    detalle_canonico: canonicalJson(d.detalle),
  };

  const { data, error } = await admin.from('lote_eventos').insert(fila).select('*').single();
  if (error) {
    if (error.code === '23514' && (error.message ?? '').startsWith('fundicion_no_permitida')) {
      const motivo = (error.message ?? '').split(':')[1]?.trim() || 'rechazada_por_bd';
      await registrarAlertaFundicion(admin, lote.id, { motivo, actor_rol: ctx.rol, actor_user_id: ctx.userId, origen: 'trigger' });
      return NextResponse.json({ error: 'fundicion_no_permitida', motivo }, { status: 422 });
    }
    return respuestaErrorDb('[cadena/eventos POST]', error, {
      conflicto: 'Conflicto de secuencia en la cadena; reintente.',
      generico: 'Error al registrar el evento',
    });
  }

  return NextResponse.json({ evento: data as LoteEvento }, { status: 201 });
}
