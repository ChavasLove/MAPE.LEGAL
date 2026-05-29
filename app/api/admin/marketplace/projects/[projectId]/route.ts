import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    console.error('[admin/marketplace/projects/[id] GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ project: data });
}
