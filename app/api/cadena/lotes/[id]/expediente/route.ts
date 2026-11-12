// /api/cadena/lotes/[id]/expediente — expediente del minero dueño del lote.
//
// Roles: staff (CHT) · cliente dueño · planta con CONSENTIMIENTO VIGENTE del
// minero a favor de su organización con alcance `expediente` (regla
// accesoPorConsentimiento de lib/cadena/reglas.ts: un consentimiento revocado
// cierra el acceso desde revocado_en). Sin consentimiento → 403
// { error: 'sin_consentimiento' }. `documentos` solo viaja si el alcance
// `documentos` también está habilitado (staff y cliente dueño: siempre).
// comercializador y auditor NO ven el expediente del minero (403).
//
// Toda lectura queda en bitácora con recurso_tipo 'expediente_minero' — es la
// evidencia de que el acceso ocurrió bajo consentimiento.

import { NextResponse } from 'next/server';
import { cargarLote, iniciarSesionCadena, noEncontrado, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { esStaff, puedeSolicitarExpediente, puedeVerLote } from '@/lib/cadena/acceso';
import { accesoPorConsentimiento } from '@/lib/cadena/reglas';
import type { Consentimiento } from '@/lib/cadena/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Datos del minero que viajan a terceros: sin DPI, sin teléfono, sin correo.
const CLIENTE_SLIM = 'id, nombre, municipio, departamento, situacion_tierra, tipo_mineral';
const EXPEDIENTE_SLIM = 'id, numero_expediente, tipo, estado, fase_numero, paso, total_pasos, municipio, inicio, cierre_estimado, created_at';
const DOCUMENTO_SLIM = 'id, expediente_id, nombre, estado, info, created_at, updated_at';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await iniciarSesionCadena('admin', 'abogado', 'tecnico_ambiental', 'planta', 'cliente');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;
  const { id } = await params;

  const lote = await cargarLote(admin, id, '[cadena/expediente GET]');
  if (lote instanceof NextResponse) return lote;
  if (!lote || !puedeVerLote(ctx, lote)) return noEncontrado('Lote');
  if (!puedeSolicitarExpediente(ctx, lote)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  // Alcance efectivo: staff y cliente dueño ven todo; planta según consentimiento.
  let incluirDocumentos = true;
  let consentimientoId: string | null = null;
  if (ctx.rol === 'planta') {
    const orgId = ctx.organizacionId!; // puedeVerLote ya garantiza organización
    const { data, error } = await admin
      .from('consentimientos')
      .select('*')
      .eq('cliente_id', lote.cliente_id)
      .eq('otorgado_a_org_id', orgId);
    if (error) return respuestaErrorDb('[cadena/expediente GET]', error, { generico: 'Error al verificar consentimientos' });
    const cons = (data ?? []) as Consentimiento[];
    if (!accesoPorConsentimiento(cons, orgId, 'expediente')) {
      registrarAcceso({
        ctx, accion: 'lectura', recurso_tipo: 'expediente_minero', recurso_id: lote.id,
        detalle: { cliente_id: lote.cliente_id, resultado: 'denegado_sin_consentimiento' },
      });
      return NextResponse.json({ error: 'sin_consentimiento' }, { status: 403 });
    }
    incluirDocumentos = accesoPorConsentimiento(cons, orgId, 'documentos');
    consentimientoId = cons.find((c) => c.estado === 'vigente' && c.alcance?.expediente === true)?.id ?? null;
  }

  const [clienteRes, expRes] = await Promise.all([
    admin.from('clientes').select(esStaff(ctx.rol) ? `${CLIENTE_SLIM}, dpi, telefono_whatsapp` : CLIENTE_SLIM).eq('id', lote.cliente_id).maybeSingle(),
    admin.from('expedientes').select(EXPEDIENTE_SLIM).eq('cliente_id', lote.cliente_id).order('created_at', { ascending: false }),
  ]);
  if (clienteRes.error) return respuestaErrorDb('[cadena/expediente GET]', clienteRes.error, { generico: 'Error al obtener el cliente' });
  if (expRes.error) return respuestaErrorDb('[cadena/expediente GET]', expRes.error, { generico: 'Error al obtener expedientes' });

  const expedientes = (expRes.data ?? []) as Array<{ id: string }>;
  let documentos: unknown[] | undefined;
  if (incluirDocumentos && expedientes.length > 0) {
    const { data, error } = await admin
      .from('documentos')
      .select(DOCUMENTO_SLIM)
      .in('expediente_id', expedientes.map((e) => e.id))
      .order('created_at', { ascending: true });
    if (error) return respuestaErrorDb('[cadena/expediente GET]', error, { generico: 'Error al obtener documentos' });
    documentos = data ?? [];
  } else if (incluirDocumentos) {
    documentos = [];
  }

  registrarAcceso({
    ctx,
    accion: 'lectura',
    recurso_tipo: 'expediente_minero',
    recurso_id: lote.id,
    detalle: {
      cliente_id: lote.cliente_id,
      expedientes: expedientes.length,
      con_documentos: incluirDocumentos,
      consentimiento_id: consentimientoId,
    },
  });

  const respuesta: Record<string, unknown> = {
    lote_id: lote.id,
    cliente: clienteRes.data ?? null,
    expedientes,
    alcance: { expediente: true, documentos: incluirDocumentos },
  };
  if (documentos !== undefined) respuesta.documentos = documentos;
  return NextResponse.json(respuesta);
}
