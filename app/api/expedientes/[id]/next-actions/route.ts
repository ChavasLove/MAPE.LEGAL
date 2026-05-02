import { NextResponse } from 'next/server';
import { getNextActions } from '@/modules/workflow';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getNextActions(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to evaluate next actions';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
