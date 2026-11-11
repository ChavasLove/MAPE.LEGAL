// /api/certificados/[id] — detalle y edición de un registro de Certificado de
// Origen (documento oficial + sello complementario, migración 042).
//
// Sin DELETE: los registros son indelebles (042 revoca DELETE/TRUNCATE para
// todos los roles). El retiro es PATCH { estado: 'revocado' | 'expirado' |
// 'suspendido' }. Los hashes solo admiten el primer llenado: un cambio sobre un
// valor existente se rechaza aquí (409) y, si llegara a la BD, lo rechaza el
// trigger trg_certificados_hash_inmutable (23514).

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { validatePatch } from '@/lib/certificados/registroValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_FIELDS = ['hash_sha256', 'escaneo_documento_oficial_hash_sha256'] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });

  const admin = getAdminClient();
  const { data: cert, error } = await admin
    .from('certificados_origen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[certificados/[id] GET] fetch failed:', error);
    return NextResponse.json({ error: 'Error al obtener el certificado' }, { status: 500 });
  }
  if (!cert) return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });

  let mina = null;
  if (cert.mina_id) {
    const { data } = await admin
      .from('minas')
      .select('id, nombre, codigo, municipio, departamento')
      .eq('id', cert.mina_id)
      .maybeSingle();
    mina = data ?? null;
  }

  return NextResponse.json({ ...cert, mina });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const v = validatePatch(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const patch = v.data as Record<string, unknown>;

  const admin = getAdminClient();

  const { data: current, error: curErr } = await admin
    .from('certificados_origen')
    .select('id, hash_sha256, escaneo_documento_oficial_hash_sha256, fecha_emision, copia_minero_estado, copia_minero_fecha')
    .eq('id', id)
    .maybeSingle();
  if (curErr) {
    if (curErr.code === '42703') {
      return NextResponse.json(
        { error: 'La migración 042 no está aplicada en la base de datos.', code: 'MIGRATION_PENDING' },
        { status: 503 },
      );
    }
    console.error('[certificados/[id] PATCH] fetch failed:', curErr);
    return NextResponse.json({ error: 'Error al obtener el certificado' }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });

  // Hashes indelebles: solo primer llenado. Un intento de sobrescribir un valor
  // existente es 409 (misma semántica que el trigger de la BD).
  for (const f of HASH_FIELDS) {
    if (f in patch && current[f] != null && patch[f] !== current[f]) {
      return NextResponse.json(
        { error: `${f} ya fue registrado y es indeleble. Registre un nuevo ejemplar en lugar de sobrescribir la huella.` },
        { status: 409 },
      );
    }
  }

  if (typeof patch.valido_hasta === 'string' && patch.valido_hasta < String(current.fecha_emision)) {
    return NextResponse.json({ error: 'valido_hasta no puede ser anterior a fecha_emision.' }, { status: 400 });
  }

  const estadoFinal = (patch.copia_minero_estado ?? current.copia_minero_estado) as string;
  const fechaFinal = 'copia_minero_fecha' in patch ? patch.copia_minero_fecha : current.copia_minero_fecha;
  if (estadoFinal !== 'pendiente' && !fechaFinal) {
    return NextResponse.json(
      { error: 'copia_minero_fecha es obligatoria cuando la copia ya fue entregada.' },
      { status: 400 },
    );
  }

  // .select() tras el update: ground truth de filas afectadas (count sin
  // select devuelve null en supabase-js v2 — lección §Auditoría 024).
  const { data, error } = await admin
    .from('certificados_origen')
    .update(patch)
    .eq('id', id)
    .select('*');

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Folio de talonario duplicado.' }, { status: 409 });
    }
    if (error.code === '23514') {
      // CHECK o trigger de indelebilidad.
      const esHash = /indeleble/i.test(error.message ?? '');
      return NextResponse.json(
        { error: esHash ? 'La huella ya registrada es indeleble.' : 'Datos fuera de los valores permitidos.' },
        { status: esHash ? 409 : 400 },
      );
    }
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Referencia inválida (expediente inexistente).' }, { status: 400 });
    }
    console.error('[certificados/[id] PATCH] update failed:', error);
    return NextResponse.json({ error: 'Error al actualizar el certificado' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });
  }

  return NextResponse.json(data[0]);
}
