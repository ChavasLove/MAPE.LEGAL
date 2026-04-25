import { NextResponse } from 'next/server';
import { transitionToNextPhase } from '@/modules/expedientes';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const userId: string | undefined =
      typeof body.user_id === 'string' ? body.user_id : undefined;
    const transitionId: string | undefined =
      typeof body.transition_id === 'string' ? body.transition_id : undefined;

    const updated = await transitionToNextPhase(id, userId, transitionId);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transition failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
