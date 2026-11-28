// lib/documentos/servidor.ts — arma el LECTOR (rol, organización, titular y,
// para `recepcion`, los titulares de su punto) del usuario autenticado.
// SERVER-ONLY.

import { NextResponse } from 'next/server';
import { errorDb, type SesionPersonal } from '@/lib/acceso/sesionPersonal';
import type { LectorDocumentos } from './acl';

export async function lectorDe(s: SesionPersonal): Promise<LectorDocumentos | NextResponse> {
  const base: LectorDocumentos = { rol: s.ctx.rol, userId: s.ctx.userId, organizacionId: s.ctx.organizacionId, clienteId: null };
  if (s.ctx.rol === 'cliente') {
    const { data, error } = await s.admin.from('clientes').select('id').eq('user_id', s.ctx.userId).maybeSingle();
    if (error) return errorDb('[documentos] lector', error);
    return { ...base, clienteId: (data as { id?: string } | null)?.id ?? null };
  }
  if (s.ctx.rol === 'recepcion') {
    if (!s.ctx.organizacionId) return { ...base, titularesDelPunto: new Set() };
    const puntos = await s.admin.from('puntos_recepcion').select('id').eq('organizacion_id', s.ctx.organizacionId);
    if (puntos.error) return errorDb('[documentos] lector', puntos.error);
    const ids = ((puntos.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (ids.length === 0) return { ...base, titularesDelPunto: new Set() };
    const rec = await s.admin.from('recepciones').select('titular_cliente_id').in('punto_id', ids);
    if (rec.error) return errorDb('[documentos] lector', rec.error);
    return { ...base, titularesDelPunto: new Set(((rec.data ?? []) as Array<{ titular_cliente_id: string }>).map((r) => r.titular_cliente_id)) };
  }
  return base;
}
