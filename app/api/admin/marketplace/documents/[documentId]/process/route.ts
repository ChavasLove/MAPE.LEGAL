import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { processDocument } from '@/services/marketplace/processing';

export const dynamic = 'force-dynamic';
// OCR + chunk + embed can run long. Vercel caps this at the plan limit
// (Hobby 60s); very large PDFs may need a follow-up script.
export const maxDuration = 300;

// POST — run OCR + chunk + embed for one document. Triggered by the client
// after upload, and by the manual "Reprocesar" button. Idempotent: the service
// clears prior chunks before re-inserting.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { documentId } = await params;

  try {
    const result = await processDocument(documentId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    // processDocument throws user-safe Spanish messages (no DB internals) and
    // has already marked the row 'failed'.
    const message = e instanceof Error ? e.message : 'Error procesando el documento';
    console.error('[admin/marketplace/process] failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
