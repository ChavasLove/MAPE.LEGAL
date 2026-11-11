// /api/certificados — registro interno de Certificados de Origen (dashboard).
//
// La plataforma MAPE.LEGAL NO emite el Certificado de Origen oficial: lo emite
// el titular del derecho minero y lo autentica la Autoridad Minera o Municipal
// (Art. 35 Regl. Especial MAPE; art. 43.e Regl. 042-2013). Esta ruta REGISTRA
// y digitaliza ese documento y asienta el sello complementario MAPE.LEGAL
// (número de sello, folio, QR, hash) — migración 042.
//
// Auth: requireRole DENTRO del handler (defensa en profundidad; proxy.ts debe
// además listar /api/certificados — ver reporte). Escritura: admin | abogado.
// Lectura: admin | abogado | tecnico_ambiental. Cliente service-role instanciado
// dentro del handler (regla §Framework). Sin DELETE: los registros son
// indelebles (042 revoca DELETE/TRUNCATE); el retiro es PATCH { estado }.
//
// Subida de archivos: NO existe en este PR. Los campos *_path se registran como
// texto (ruta relativa validada) — ver docs/certificado-oficial-y-sello.md.

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { buildQrUrl } from '@/lib/certificados/sello';
import { buildHashVerificacion, validateCreate } from '@/lib/certificados/registroValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MinaSlim = { id: string; nombre: string | null; codigo: string | null; municipio: string | null };

// PG 42703 = undefined_column → la 042 no está aplicada en este ambiente.
const MIGRACION_PENDIENTE_MSG =
  'La migración 042 (documento oficial + sello) no está aplicada en la base de datos.';

export async function GET() {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();

  // La sonda de la 042 y la lista corren en paralelo (RTT independientes).
  const [probe, list] = await Promise.all([
    admin.from('certificados_origen').select('numero_sello').limit(1),
    admin.from('certificados_origen').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  const migracion_aplicada = !probe.error || probe.error.code !== '42703';

  if (list.error) {
    console.error('[certificados GET] list failed:', list.error);
    return NextResponse.json({ error: 'Error al obtener certificados' }, { status: 500 });
  }

  const rows = (list.data ?? []) as Array<Record<string, unknown> & { mina_id: string | null }>;
  const minaIds = Array.from(new Set(rows.map(r => r.mina_id).filter((v): v is string => !!v)));

  const minasById: Record<string, MinaSlim> = {};
  if (minaIds.length > 0) {
    const { data: minas, error: minasErr } = await admin
      .from('minas')
      .select('id, nombre, codigo, municipio')
      .in('id', minaIds);
    if (minasErr) console.error('[certificados GET] minas lookup failed (non-fatal):', minasErr);
    (minas ?? []).forEach((m: MinaSlim) => { minasById[m.id] = m; });
  }

  return NextResponse.json({
    migracion_aplicada,
    rows: rows.map(r => ({ ...r, mina: r.mina_id ? minasById[r.mina_id] ?? null : null })),
  });
}

export async function POST(req: Request) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const v = validateCreate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.data;

  const admin = getAdminClient();

  // La mina debe existir (FK on delete restrict; mejor 400 claro que 23503 opaco).
  const { data: mina, error: minaErr } = await admin
    .from('minas')
    .select('id')
    .eq('id', d.mina_id)
    .maybeSingle();
  if (minaErr) {
    console.error('[certificados POST] mina lookup failed:', minaErr);
    return NextResponse.json({ error: 'Error al validar la mina' }, { status: 500 });
  }
  if (!mina) return NextResponse.json({ error: 'Mina no encontrada.' }, { status: 400 });

  const insertRow = {
    ...d,
    // Siempre server-side: quién asentó el registro (NO el emisor del documento)
    // y la URL del QR que enlaza el papel con el asiento digital.
    registrado_por: auth.user.id,
    qr_url: buildQrUrl(d.numero_sello, process.env.NEXT_PUBLIC_SITE_URL),
    hash_verificacion: buildHashVerificacion(d),
    // emitido_por (020) es LEGACY — la plataforma no emite. Se deja NULL.
  };

  const { data, error } = await admin
    .from('certificados_origen')
    .insert(insertRow)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un registro con ese número de certificado, número de sello o folio.' },
        { status: 409 },
      );
    }
    if (error.code === '42703') {
      console.error('[certificados POST] migración 042 pendiente:', error.message);
      return NextResponse.json({ error: MIGRACION_PENDIENTE_MSG, code: 'MIGRATION_PENDING' }, { status: 503 });
    }
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Referencia inválida (mina o expediente inexistente).' }, { status: 400 });
    }
    if (error.code === '23514') {
      return NextResponse.json({ error: 'Datos fuera de los valores permitidos.' }, { status: 400 });
    }
    console.error('[certificados POST] insert failed:', error);
    return NextResponse.json({ error: 'Error al registrar el certificado' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
