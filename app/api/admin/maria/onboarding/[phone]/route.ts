import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { normalizePhone } from '@/lib/maria/normalizePhone';

export const dynamic = 'force-dynamic';

const VALID_STATES = ['ASK_NAME', 'ASK_ID', 'ASK_LOCATION', 'ASK_ROLE', 'COMPLETE'] as const;
type OnboardingState = typeof VALID_STATES[number];

// PATCH  /api/admin/maria/onboarding/[phone]   { estado?: state, datos?: object }
// DELETE /api/admin/maria/onboarding/[phone]   — drops the row (forces a fresh
//                                                onboarding flow on next message)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { phone } = await params;
  const telefono = normalizePhone(decodeURIComponent(phone));

  const body = await req.json().catch(() => ({})) as {
    estado?: string;
    datos?:  Record<string, unknown>;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.estado !== undefined) {
    if (!(VALID_STATES as readonly string[]).includes(body.estado)) {
      return NextResponse.json(
        { error: `estado inválido. Use uno de: ${VALID_STATES.join(', ')}` },
        { status: 400 }
      );
    }
    patch.estado = body.estado as OnboardingState;
  }
  if (body.datos !== undefined) patch.datos = body.datos;

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const admin = getAdminClient();

  // Atomic upsert: if the row doesn't exist, insert; if it does, update. Both
  // paths require `estado` to satisfy the not-null constraint on insert, so
  // we still require it when the row is absent. Using the DB's onConflict
  // path avoids the classic SELECT-then-INSERT/UPDATE TOCTOU race when two
  // admins (or an admin and an auto-onboarding flow) edit the same phone
  // concurrently.
  if (body.estado === undefined) {
    const { data: existing } = await admin
      .from('onboarding_states')
      .select('telefono')
      .eq('telefono', telefono)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { error: 'No hay onboarding para ese teléfono. Incluye `estado` para crear el registro.' },
        { status: 404 }
      );
    }
  }

  const upsertRow: Record<string, unknown> = {
    telefono,
    updated_at: patch.updated_at,
  };
  if (body.estado !== undefined) upsertRow.estado = body.estado;
  if (body.datos  !== undefined) upsertRow.datos  = body.datos;

  const { data, error } = await admin
    .from('onboarding_states')
    .upsert(upsertRow, { onConflict: 'telefono' })
    .select()
    .single();

  if (error) {
    console.error('[admin/maria/onboarding PATCH] upsert failed:', error);
    return NextResponse.json({ error: 'Error al actualizar el onboarding' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, onboarding: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { phone } = await params;
  const telefono = normalizePhone(decodeURIComponent(phone));

  const admin = getAdminClient();
  const { error } = await admin
    .from('onboarding_states')
    .delete()
    .eq('telefono', telefono);

  if (error) {
    console.error('[admin/maria/onboarding DELETE] failed:', error);
    return NextResponse.json({ error: 'Error al borrar el onboarding' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
