// GET /api/respaldo/[id] — enlace de lectura de un documento respaldado.
// El archivo no es público: la API comprueba el acceso por documento, deja la
// lectura en la bitácora y entrega un enlace de vida corta. Sin acceso o sin
// documento: 404 uniforme. Con el respaldo apagado: "en implementación".

import { NextResponse } from 'next/server';
import { errorDb, iniciarSesionRoles, noEncontrado } from '@/lib/acceso/sesionPersonal';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { isUuid } from '@/lib/cadena/validacion';
import { puedeLeerDocumento, type AclDocumento } from '@/lib/documentos/acl';
import { lectorDe } from '@/lib/documentos/servidor';
import { RESPALDO_PENDIENTE, obtenerRespaldo } from '@/lib/documentos/respaldo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEGUNDOS_ENLACE = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionRoles('admin', 'abogado', 'tecnico_ambiental', 'verificador', 'recepcion', 'cliente', 'comercializador', 'planta', 'auditor');
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isUuid(id)) return noEncontrado('Documento');
  const { data, error } = await s.admin.from('documentos_respaldo')
    .select('id, documento_id, referencia_externa, sha256, version, nivel_acceso, organizacion_id, titular_cliente_id, vigente')
    .eq('id', id).maybeSingle();
  if (error) return errorDb('[respaldo/id GET]', error, 'Error al obtener el documento');
  const doc = data as (AclDocumento & { id: string; documento_id: string; referencia_externa: string; sha256: string; version: number }) | null;
  if (!doc) return noEncontrado('Documento');
  const lector = await lectorDe(s);
  if (lector instanceof NextResponse) return lector;
  if (!puedeLeerDocumento(lector, doc)) return noEncontrado('Documento');

  // Constancia de la lectura (append-only).
  registrarAcceso({
    ctx: { rol: s.ctx.rol, userId: s.ctx.userId, email: null, organizacionId: s.ctx.organizacionId, clienteId: lector.clienteId },
    accion: 'lectura', recurso_tipo: 'documento_respaldo', recurso_id: doc.id, detalle: { documento_id: doc.documento_id, version: doc.version },
  });

  const respaldo = obtenerRespaldo();
  if (!respaldo.disponible) {
    return NextResponse.json({ documento: { id: doc.id, version: doc.version, huella: doc.sha256 }, enlace: null, estado: RESPALDO_PENDIENTE });
  }
  try {
    const enlace = await respaldo.adaptador.enlaceTemporal(doc, SEGUNDOS_ENLACE);
    return NextResponse.json({ documento: { id: doc.id, version: doc.version, huella: doc.sha256 }, enlace, estado: 'disponible' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[respaldo/id GET] almacén no disponible:', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ documento: { id: doc.id, version: doc.version, huella: doc.sha256 }, enlace: null, estado: RESPALDO_PENDIENTE });
  }
}
