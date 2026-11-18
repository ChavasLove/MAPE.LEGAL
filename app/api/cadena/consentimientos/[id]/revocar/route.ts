// /api/cadena/consentimientos/[id]/revocar — revocación de un consentimiento.
//
// POST admin | abogado | cliente dueño → { motivo?, constancia_path? }.
// Marca estado 'revocado' (la BD fija revocado_en). Un consentimiento ya
// revocado responde 409. Las lecturas anteriores a la revocación quedan en la
// bitácora tal cual (no se reescriben). Sin DELETE: el consentimiento es
// evidencia; la revocación es una fila nueva de estado, no un borrado.

import { NextResponse } from 'next/server';
import { iniciarSesionCadena, noEncontrado, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import type { Consentimiento } from '@/lib/cadena/types';
import { isUuid, validarBodyRevocacion } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'cliente');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Consentimiento');

  const { data: actual, error: leerErr } = await admin.from('consentimientos').select('*').eq('id', id).maybeSingle();
  if (leerErr) return respuestaErrorDb('[cadena/consentimientos revocar]', leerErr, { generico: 'Error al obtener el consentimiento' });
  const c = actual as Consentimiento | null;
  if (!c) return noEncontrado('Consentimiento');
  if (ctx.rol === 'cliente' && (!ctx.clienteId || c.cliente_id !== ctx.clienteId)) return noEncontrado('Consentimiento');
  if (c.estado === 'revocado') {
    return NextResponse.json({ error: 'El consentimiento ya está revocado.', consentimiento: c }, { status: 409 });
  }

  // Body opcional (puede venir vacío).
  let bodyRaw: unknown = {};
  const texto = await req.text();
  if (texto.trim().length > 0) {
    try {
      bodyRaw = JSON.parse(texto);
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }
  }
  const v = validarBodyRevocacion(bodyRaw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const { data, error } = await admin
    .from('consentimientos')
    .update({
      estado: 'revocado',
      revocacion_motivo: v.data.motivo,
      revocacion_constancia_path: v.data.constancia_path,
    })
    .eq('id', id)
    .eq('estado', 'vigente') // guard optimista: dos revocaciones concurrentes → la segunda ve 0 filas
    .select('*');
  if (error) return respuestaErrorDb('[cadena/consentimientos revocar]', error, { generico: 'Error al revocar el consentimiento' });
  const filas = (data ?? []) as Consentimiento[];
  if (filas.length === 0) {
    return NextResponse.json({ error: 'El consentimiento ya está revocado.' }, { status: 409 });
  }

  return NextResponse.json({ consentimiento: filas[0] });
}
