import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import {
  DOCUMENT_TYPE_VALUES,
  ACCESS_TIER_VALUES,
  type DocumentListItem,
  type DocumentType,
  type AccessTier,
} from '@/lib/marketplace/types';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const STORAGE_BUCKET = 'project-documents';

const LIST_COLUMNS =
  'id, title, description, document_type, document_subtype, ocr_status, page_count, access_tier, version, report_date, effective_date, created_at, file_size_bytes';

// GET — list documents for a project, plus a grouping by document_type for the
// category sidebar.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('project_documents')
    .select(LIST_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/marketplace/documents GET] failed:', error);
    return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
  }

  const documents = (data ?? []) as DocumentListItem[];
  const grouped = documents.reduce((acc, doc) => {
    (acc[doc.document_type] ??= []).push(doc);
    return acc;
  }, {} as Record<string, DocumentListItem[]>);

  return NextResponse.json({ documents, grouped });
}

// POST — multipart upload. Stores the PDF in Storage + inserts a row with
// ocr_status='pending'. Processing is triggered by the client afterwards
// (POST .../documents/[id]/process) so it runs as its own invocation.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido (se espera multipart/form-data).' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido.' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Solo se aceptan PDFs.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo supera 100 MB.' }, { status: 400 });
  }

  const documentType = String(formData.get('documentType') ?? '');
  if (!DOCUMENT_TYPE_VALUES.includes(documentType as DocumentType)) {
    return NextResponse.json({ error: 'documentType inválido.' }, { status: 400 });
  }
  const accessTierRaw = String(formData.get('accessTier') ?? 'registered');
  const accessTier: AccessTier = ACCESS_TIER_VALUES.includes(accessTierRaw as AccessTier)
    ? (accessTierRaw as AccessTier)
    : 'registered';

  const title = (String(formData.get('title') ?? '').trim()) || file.name;
  const description = String(formData.get('description') ?? '').trim() || null;
  const documentSubtype = String(formData.get('documentSubtype') ?? '').trim() || null;
  const reportDate = String(formData.get('reportDate') ?? '').trim() || null;
  const effectiveDate = String(formData.get('effectiveDate') ?? '').trim() || null;
  const version = String(formData.get('version') ?? '').trim() || '1.0';
  const versionNotes = String(formData.get('versionNotes') ?? '').trim() || null;

  // Verify the project exists (FK would catch it, but a clean 404 is friendlier).
  const admin = getAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 120);
  const storagePath = `${projectId}/${Date.now()}-${safeName}`;

  // Read into an ArrayBuffer — reliable across runtimes for the storage upload.
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    console.error('[admin/marketplace/documents POST] storage upload failed:', uploadError);
    return NextResponse.json({ error: 'Error al subir el archivo.' }, { status: 500 });
  }

  const { data: doc, error: docError } = await admin
    .from('project_documents')
    .insert({
      project_id:        projectId,
      title,
      description,
      document_type:     documentType,
      document_subtype:  documentSubtype,
      original_filename: file.name,
      file_size_bytes:   file.size,
      storage_bucket:    STORAGE_BUCKET,
      storage_path:      storagePath,
      language:          'es',
      ocr_status:        'pending',
      access_tier:       accessTier,
      report_date:       reportDate,
      effective_date:    effectiveDate,
      version,
      version_notes:     versionNotes,
      uploaded_by:       auth.user.id,
    })
    .select(LIST_COLUMNS)
    .single();

  if (docError) {
    // Roll back the orphaned object so a retry can re-use the path.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
    if (docError.code === '23505') {
      return NextResponse.json({ error: 'Documento duplicado.' }, { status: 409 });
    }
    console.error('[admin/marketplace/documents POST] insert failed:', docError);
    return NextResponse.json({ error: 'Error al registrar el documento.' }, { status: 500 });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
