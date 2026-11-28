// GET /api/portal/expediente — expediente del titular autenticado, en SOLO
// LECTURA: perfil, minas con sus licencias, trámites y documentos. No existe
// POST/PATCH/DELETE en esta ruta: el titular no carga ni edita nada.
//
// La forma pública la fija lib/expediente/vista.ts (lista cerrada de campos y
// filtro por titular: nunca se mezclan expedientes de titulares distintos).

import { NextResponse } from 'next/server';
import { errorDb, esMigracionPendiente, iniciarSesionRoles } from '@/lib/acceso/sesionPersonal';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { armarVistaExpediente, type FilaDocumento, type FilaExpediente, type FilaLicencia, type FilaMina, type FilaPerfil, type FilaRespaldo } from '@/lib/expediente/vista';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Res<T> = { data: T[] | null; error: { code?: string; message?: string } | null };
/** Una tabla de una migración aún no aplicada se lee como vacía. */
function filas<T>(r: Res<T>): T[] | { code?: string; message?: string } {
  if (r.error) return esMigracionPendiente(r.error) ? [] : r.error;
  return r.data ?? [];
}

export async function GET() {
  const s = await iniciarSesionRoles('cliente');
  if (s instanceof NextResponse) return s;
  const { admin, ctx } = s;

  const cli = await admin.from('clientes').select('id').eq('user_id', ctx.userId).maybeSingle();
  if (cli.error) return errorDb('[portal/expediente]', cli.error, 'Error al obtener el expediente');
  const titularId = (cli.data as { id?: string } | null)?.id ?? null;
  if (!titularId) return NextResponse.json({ expediente: null, motivo: 'sin_titular' });

  const [perfilR, minasR, expR] = await Promise.all([
    admin.from('perfiles').select('id, cliente_id, estado, version, updated_at').eq('cliente_id', titularId).maybeSingle(),
    admin.from('minas').select('id, cliente_id, nombre, codigo, municipio, departamento, tipo_mineral, estado').eq('cliente_id', titularId),
    admin.from('expedientes').select('id, cliente_id, numero_expediente, tipo, estado, fase_numero, paso, inicio, cierre_estimado').eq('cliente_id', titularId),
  ]);
  if (perfilR.error && !esMigracionPendiente(perfilR.error)) return errorDb('[portal/expediente]', perfilR.error);
  const minas = filas<FilaMina>(minasR as Res<FilaMina>);
  const expedientes = filas<FilaExpediente>(expR as Res<FilaExpediente>);
  if (!Array.isArray(minas)) return errorDb('[portal/expediente]', minas);
  if (!Array.isArray(expedientes)) return errorDb('[portal/expediente]', expedientes);

  const minaIds = minas.map((m) => m.id);
  const expIds = expedientes.map((e) => e.id);
  const [licR, docR] = await Promise.all([
    minaIds.length
      ? admin.from('licencias_mina').select('id, mina_id, tipo, numero, estado, vigente_desde, vigente_hasta').in('mina_id', minaIds)
      : Promise.resolve({ data: [], error: null }),
    expIds.length
      ? admin.from('documentos').select('id, expediente_id, nombre, tipo, estado, created_at').in('expediente_id', expIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const licencias = filas<FilaLicencia>(licR as Res<FilaLicencia>);
  const documentos = filas<FilaDocumento>(docR as Res<FilaDocumento>);
  if (!Array.isArray(licencias)) return errorDb('[portal/expediente]', licencias);
  if (!Array.isArray(documentos)) return errorDb('[portal/expediente]', documentos);

  const docIds = documentos.map((d) => d.id);
  const respR = docIds.length
    ? await admin.from('documentos_respaldo').select('documento_id, version, sha256, vigente').in('documento_id', docIds)
    : { data: [], error: null };
  const respaldos = filas<FilaRespaldo>(respR as Res<FilaRespaldo>);
  if (!Array.isArray(respaldos)) return errorDb('[portal/expediente]', respaldos);

  const vista = armarVistaExpediente({
    titularId,
    perfil: (perfilR.data as FilaPerfil | null) ?? null,
    minas, licencias, expedientes, documentos, respaldos,
  });
  if (vista.descartados > 0) console.error('[portal/expediente] filas ajenas descartadas:', vista.descartados);

  registrarAcceso({
    ctx: { rol: ctx.rol, userId: ctx.userId, email: null, organizacionId: null, clienteId: titularId },
    accion: 'lectura', recurso_tipo: 'expediente_propio', recurso_id: titularId,
  });
  return NextResponse.json({ expediente: vista });
}
