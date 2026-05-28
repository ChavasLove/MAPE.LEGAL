import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_S = 3600; // 1 hour

// GET — generate a short-lived signed download URL. Admin-only (Phase 1):
// requireRole gates it; per-investor checks are deferred with the investor
// surfaces.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { documentId } = await params;
  const admin = getAdminClient();

  const { data: doc, error: docError } = await admin
    .from('project_documents')
    .select('id, project_id, title, storage_bucket, storage_path')
    .eq('id', documentId)
    .maybeSingle();

  if (docError) {
    console.error('[admin/marketplace/download] doc fetch failed:', docError);
    return NextResponse.json({ error: 'Error al obtener el documento' }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const bucket = (doc.storage_bucket as string) || 'project-documents';
  const { data: signed, error: urlError } = await admin.storage
    .from(bucket)
    .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL_S);

  if (urlError || !signed?.signedUrl) {
    console.error('[admin/marketplace/download] sign failed:', urlError);
    return NextResponse.json({ error: 'Error al generar el enlace' }, { status: 500 });
  }

  // Audit log — non-blocking.
  await admin
    .from('document_access_log')
    .insert({
      user_id:     auth.user.id,
      document_id: documentId,
      project_id:  doc.project_id,
      action:      'download',
    })
    .then(({ error }) => {
      if (error) console.error('[admin/marketplace/download] log insert failed:', error);
    });

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    filename: doc.title,
    expiresIn: SIGNED_URL_TTL_S,
  });
}
