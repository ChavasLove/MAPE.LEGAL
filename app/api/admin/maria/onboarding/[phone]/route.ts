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

  // Upsert: if the phone has no onboarding row yet, create one when `estado`
  // is provided (admins can pin a stuck conversation to a specific state
  // without forcing the user to restart the flow). Without `estado`, we
  // can't safely insert a row — surface a 404 with guidance.
  const { data: existing } = await admin
    .from('onboarding_states')
    .select('telefono')
    .eq('telefono', telefono)
    .maybeSingle();

  if (!existing) {
    if (body.estado === undefined) {
      return NextResponse.json(
        { error: 'No hay onboarding para ese teléfono. Incluye `estado` para crear el registro.' },
        { status: 404 }
      );
    }
    const { data, error } = await admin
      .from('onboarding_states')
      .insert({
        telefono,
        estado: body.estado as OnboardingState,
        datos:  body.datos ?? {},
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, onboarding: data, created: true }, { status: 201 });
  }

  const { data, error } = await admin
    .from('onboarding_states')
    .update(patch)
    .eq('telefono', telefono)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
