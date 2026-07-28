import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

// Sube láminas/fotos de un equipo al bucket público `equipos-imagenes`
// (migración 029). Server-mediated: el browser manda multipart aquí y el
// cliente service-role escribe en Storage — nunca escritura directa.
const BUCKET = 'equipos-imagenes';
const MAX_FILES = 12;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB (el bucket capea a 10 MB)
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
  const auth = await requireRole('admin', 'abogado');
  if (auth instanceof NextResponse) return auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo inválido (se espera multipart/form-data).' },
      { status: 400 }
    );
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'Al menos una imagen es requerida.' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${MAX_FILES} imágenes por lote.` }, { status: 400 });
  }
  for (const f of files) {
    if (!ALLOWED_TYPES[f.type]) {
      return NextResponse.json(
        { error: `Formato no soportado (${f.type || 'desconocido'}). Solo JPEG, PNG o WebP.` },
        { status: 400 }
      );
    }
    if (f.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `"${f.name}" supera 8 MB.` },
        { status: 400 }
      );
    }
  }

  const admin = getAdminClient();
  const batchId = crypto.randomUUID();
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = ALLOWED_TYPES[file.type];
    const path = `${batchId}/${String(i + 1).padStart(2, '0')}.${ext}`;

    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('[admin/equipos/upload-imagenes] storage upload failed:', error);
      const missing = /bucket/i.test(error.message ?? '');
      return NextResponse.json(
        {
          error: missing
            ? 'Bucket de Storage no encontrado — ¿está aplicada la migración 029 en Supabase Studio?'
            : `Error al subir "${file.name}".`,
        },
        { status: 500 }
      );
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return NextResponse.json({ urls, batchId }, { status: 201 });
}
