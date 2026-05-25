import { NextResponse } from 'next/server';
import { advancePhase } from '@/modules/expedientes';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin', 'abogado', 'tecnico_ambiental');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Derive userId from the validated auth context — never from the body.
    // The body field is ignored even if present so the audit trail in
    // logAction always records the actual user, not whatever id the client
    // claimed.
    const userId       = auth.user.id;
    const transitionId: string | undefined =
      typeof body.transition_id === 'string' ? body.transition_id : undefined;

    const updated = await advancePhase(id, userId, transitionId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[expedientes/[id]/transition POST] failed:', error);
    const message = error instanceof Error ? error.message : 'Transition failed';
    // advancePhase encodes workflow violations (missing transition, blocked
    // phase, etc.) as thrown Errors with specific messages the dashboard UI
    // surfaces. Keep the message — these are user-facing workflow strings,
    // not Supabase internals — but log the full error for diagnostics.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
