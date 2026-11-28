// lib/recepcion/cajaServidor.ts — carga de una caja con alcance por punto
// (SERVER-ONLY). 404 si no existe o el usuario no alcanza su punto.

import { NextResponse } from 'next/server';
import { errorDb, noEncontrado, type SesionPersonal } from '@/lib/acceso/sesionPersonal';
import { isUuid } from '@/lib/cadena/validacion';
import { puntoAlcanzable } from './servidor';
import type { Caja, Sobre } from './types';

export async function cargarCaja(s: SesionPersonal, id: string): Promise<{ caja: Caja; sobres: Sobre[] } | NextResponse> {
  if (!isUuid(id)) return noEncontrado('Caja');
  const { data, error } = await s.admin.from('cajas').select('*').eq('id', id).maybeSingle();
  if (error) return errorDb('[recepcion/cajas] caja', error, 'Error al obtener la caja');
  const caja = data as Caja | null;
  if (!caja) return noEncontrado('Caja');
  const punto = await puntoAlcanzable(s, caja.punto_id);
  if (punto instanceof NextResponse) return punto;
  if (!punto) return noEncontrado('Caja');
  const sobres = await s.admin.from('sobres').select('*').eq('caja_id', id).order('etiqueta');
  if (sobres.error) return errorDb('[recepcion/cajas] sobres', sobres.error, 'Error al obtener los sobres');
  return { caja, sobres: (sobres.data ?? []) as Sobre[] };
}
