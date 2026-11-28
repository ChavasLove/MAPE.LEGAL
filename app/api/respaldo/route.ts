// /api/respaldo — respaldo digital de documentos.
// GET  ?expediente_id= → respaldos vigentes que el usuario puede leer.
// POST personal con `documento:subir` → sube un documento al almacén externo y
//      registra su referencia y su huella. Mientras el adaptador esté apagado
//      (valor por defecto) responde 503 "en implementación": no se finge una
//      subida ni se guarda nada.
//
// El titular solo ve: no existe subida para usuarios externos.

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionPersonal, iniciarSesionRoles, leerCuerpo, registrarAccion } from '@/lib/acceso/sesionPersonal';
import { isObj, isUuid } from '@/lib/cadena/validacion';
import { puedeLeerDocumento, type AclDocumento } from '@/lib/documentos/acl';
import { lectorDe } from '@/lib/documentos/servidor';
import { NIVELES_ACCESO, RESPALDO_PENDIENTE, obtenerRespaldo, type NivelAcceso } from '@/lib/documentos/respaldo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;

export async function GET(req: Request) {
  const s = await iniciarSesionRoles('admin', 'abogado', 'tecnico_ambiental', 'verificador', 'recepcion', 'cliente', 'comercializador', 'planta', 'auditor');
  if (s instanceof NextResponse) return s;
  const expediente = new URL(req.url).searchParams.get('expediente_id');
  if (!isUuid(expediente)) return NextResponse.json({ error: 'expediente_id inválido.' }, { status: 400 });
  const { data, error } = await s.admin.from('documentos_respaldo')
    .select('id, documento_id, expediente_id, mina_id, titular_cliente_id, organizacion_id, nivel_acceso, version, vigente, sha256, created_at')
    .eq('expediente_id', expediente).eq('vigente', true);
  if (error) return errorDb('[respaldo GET]', error, 'Error al obtener los respaldos');
  const lector = await lectorDe(s);
  if (lector instanceof NextResponse) return lector;
  const visibles = ((data ?? []) as Array<AclDocumento & { id: string; documento_id: string; version: number; sha256: string; created_at: string }>)
    .filter((d) => puedeLeerDocumento(lector, d))
    .map((d) => ({ id: d.id, documento_id: d.documento_id, version: d.version, huella: d.sha256, fecha: d.created_at }));
  return NextResponse.json({ respaldos: visibles, estado_respaldo: obtenerRespaldo().disponible ? 'conectado' : RESPALDO_PENDIENTE });
}

export async function POST(req: Request) {
  const s = await iniciarSesionPersonal('documento:subir');
  if (s instanceof NextResponse) return s;
  const respaldo = obtenerRespaldo();
  if (!respaldo.disponible) {
    return NextResponse.json({ error: 'El respaldo digital de documentos está en implementación.', code: 'RESPALDO_EN_IMPLEMENTACION' }, { status: 503 });
  }
  const body = await leerCuerpo(req);
  if (body instanceof NextResponse) return body;
  if (!isObj(body)) return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  const { documento_id, nivel_acceso, organizacion_id, nombre, tipo_mime, contenido_base64 } = body;
  if (!isUuid(documento_id)) return NextResponse.json({ error: 'documento_id inválido.' }, { status: 400 });
  if (typeof nivel_acceso !== 'string' || !(NIVELES_ACCESO as ReadonlyArray<string>).includes(nivel_acceso)) {
    return NextResponse.json({ error: `nivel_acceso inválido. Permitidos: ${NIVELES_ACCESO.join(', ')}.` }, { status: 400 });
  }
  if (nivel_acceso === 'organizacion' && !isUuid(organizacion_id)) return NextResponse.json({ error: 'El nivel "organizacion" exige organizacion_id.' }, { status: 400 });
  if (typeof contenido_base64 !== 'string' || typeof nombre !== 'string' || typeof tipo_mime !== 'string') {
    return NextResponse.json({ error: 'nombre, tipo_mime y contenido_base64 son obligatorios.' }, { status: 400 });
  }
  const contenido = new Uint8Array(Buffer.from(contenido_base64, 'base64'));
  if (contenido.byteLength === 0 || contenido.byteLength > MAX_BYTES) return NextResponse.json({ error: 'El archivo está vacío o supera 20 MB.' }, { status: 400 });

  const doc = await s.admin.from('documentos').select('id, expediente_id').eq('id', documento_id).maybeSingle();
  if (doc.error) return errorDb('[respaldo POST]', doc.error, 'Error al obtener el documento');
  const d = doc.data as { id: string; expediente_id: string | null } | null;
  if (!d?.expediente_id) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });

  try {
    const ref = await respaldo.adaptador.subir({
      documento_id: d.id, expediente_id: d.expediente_id, mina_id: null, nivel_acceso: nivel_acceso as NivelAcceso,
      organizacion_id: (organizacion_id as string | undefined) ?? null, subido_por: s.ctx.userId, nombre: nombre.slice(0, 200), tipo_mime, contenido,
    });
    const { data, error } = await s.admin.from('documentos_respaldo').insert({
      documento_id: d.id, expediente_id: d.expediente_id, organizacion_id: ref.organizacion_id, almacen: ref.almacen,
      referencia_externa: ref.referencia_externa, sha256: ref.sha256, tamano_bytes: ref.tamano_bytes, nivel_acceso: ref.nivel_acceso, subido_por: s.ctx.userId,
    }).select('id, version, sha256').single();
    if (error) return errorDb('[respaldo POST]', error, 'Error al registrar el respaldo');
    const fila = data as { id: string; version: number; sha256: string };
    await registrarAccion(s, { accion: 'documento_respaldado', recurso_tipo: 'documento_respaldo', recurso_id: fila.id, resumen: `Documento respaldado (versión ${fila.version})`, detalle: { documento_id: d.id } });
    return NextResponse.json({ respaldo: { id: fila.id, version: fila.version, huella: fila.sha256 } }, { status: 201 });
  } catch (err) {
    console.error('[respaldo POST] almacén no disponible:', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ error: 'El respaldo digital de documentos está en implementación.', code: 'RESPALDO_EN_IMPLEMENTACION' }, { status: 503 });
  }
}
