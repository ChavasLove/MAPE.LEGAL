// /api/cadena/lotes — lotes de la cadena de custodia.
//
// GET  cualquiera de los 7 roles, filtrado por alcance (lib/cadena/acceso.ts):
//      staff/auditor todos · comercializador su organización · planta los que
//      la nombran como planta_org_id · cliente los suyos. ?estado= opcional.
// POST comercializador (fuente de su organización) | admin. Genera `codigo`
//      LOTE-YYYY-NNNN si no viene. El trigger BEFORE INSERT de la 043 deja el
//      lote `bloqueado` (+ bloqueo_motivo) si la fuente no es elegible — se
//      devuelve tal cual, con la evaluación JS como `elegibilidad`.

import { NextResponse } from 'next/server';
import { iniciarSesionCadena, leerJson, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { alcanceLista, filtroLotes } from '@/lib/cadena/acceso';
import { evaluarElegibilidadFuente } from '@/lib/cadena/reglas';
import { ESTADOS_LOTE, type FuenteComercializador, type Lote } from '@/lib/cadena/types';
import { generarCodigoLote, parseLimit, validarBodyLote } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'auditor', 'comercializador', 'planta', 'cliente');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  if (estado !== null && !(ESTADOS_LOTE as ReadonlyArray<string>).includes(estado)) {
    return NextResponse.json({ error: `estado inválido. Permitidos: ${ESTADOS_LOTE.join(', ')}` }, { status: 400 });
  }
  const limit = parseLimit(url.searchParams.get('limit'), 200, 1000);

  const alcance = alcanceLista(ctx);
  if (alcance.tipo === 'nada') return NextResponse.json({ lotes: [] });

  let query = admin.from('lotes').select('*').order('created_at', { ascending: false }).limit(limit);
  const filtro = filtroLotes(alcance);
  if (filtro) query = query.eq(filtro.columna, filtro.valor);
  if (estado) query = query.eq('estado', estado);

  const { data, error } = await query;
  if (error) return respuestaErrorDb('[cadena/lotes GET]', error, { generico: 'Error al obtener lotes' });

  const lotes = (data ?? []) as Lote[];
  registrarAcceso({ ctx, accion: 'lectura', recurso_tipo: 'lotes', detalle: { total: lotes.length, estado, alcance: alcance.tipo } });
  return NextResponse.json({ lotes });
}

export async function POST(req: Request) {
  const s = await iniciarSesionCadena('admin', 'comercializador');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const body = await leerJson(req);
  if (body instanceof NextResponse) return body;
  const v = validarBodyLote(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.data;

  const { data: fuenteRow, error: fuenteErr } = await admin
    .from('fuentes_comercializador')
    .select('*')
    .eq('id', d.fuente_id)
    .maybeSingle();
  if (fuenteErr) return respuestaErrorDb('[cadena/lotes POST]', fuenteErr, { generico: 'Error al validar la fuente' });
  const fuente = fuenteRow as FuenteComercializador | null;
  if (!fuente) return NextResponse.json({ error: 'Fuente no encontrada.' }, { status: 400 });

  // El comercializador solo abre lotes sobre fuentes de SU organización.
  if (ctx.rol === 'comercializador' && (!ctx.organizacionId || fuente.organizacion_id !== ctx.organizacionId)) {
    return NextResponse.json({ error: 'La fuente no pertenece a su organización.' }, { status: 403 });
  }

  if (d.planta_org_id) {
    const { data: planta, error: plantaErr } = await admin
      .from('organizaciones')
      .select('id, tipo, activo')
      .eq('id', d.planta_org_id)
      .maybeSingle();
    if (plantaErr) return respuestaErrorDb('[cadena/lotes POST]', plantaErr, { generico: 'Error al validar la planta' });
    const p = planta as { tipo: string; activo: boolean } | null;
    if (!p || !p.activo || p.tipo !== 'planta') {
      return NextResponse.json({ error: 'planta_org_id no corresponde a una planta activa.' }, { status: 400 });
    }
  }

  let codigo = d.codigo;
  if (!codigo) {
    const year = new Date().getFullYear();
    const { data: existentes, error: codErr } = await admin
      .from('lotes')
      .select('codigo')
      .like('codigo', `LOTE-${year}-%`);
    if (codErr) return respuestaErrorDb('[cadena/lotes POST]', codErr, { generico: 'Error al generar el código del lote' });
    codigo = generarCodigoLote(((existentes ?? []) as Array<{ codigo: string | null }>).map((r) => r.codigo), year);
  }

  const fila = {
    codigo,
    fuente_id: fuente.id,
    cliente_id: fuente.cliente_id,
    comercializador_org_id: fuente.organizacion_id,
    planta_org_id: d.planta_org_id,
    estado: 'abierto',
    created_by: ctx.userId,
  };

  const { data, error } = await admin.from('lotes').insert(fila).select('*').single();
  if (error) {
    return respuestaErrorDb('[cadena/lotes POST]', error, {
      conflicto: 'Ya existe un lote con ese código.',
      generico: 'Error al crear el lote',
    });
  }

  return NextResponse.json({ lote: data as Lote, elegibilidad: evaluarElegibilidadFuente(fuente) }, { status: 201 });
}
