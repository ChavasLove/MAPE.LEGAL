import { getAdminClient } from '@/services/adminSupabase';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import {
  PROJECT_STAGE_VALUES,
  TENEMENT_STATUS_VALUES,
  type ProjectListItem,
  type ProjectStage,
  type TenementStatus,
} from '@/lib/marketplace/types';

export const dynamic = 'force-dynamic';

const PROJECT_STATUS_VALUES = ['active', 'inactive', 'archived'] as const;

interface CreateProjectPayload {
  name?: string;
  description?: string | null;
  region?: string | null;
  municipality?: string | null;
  company_name?: string | null;
  commodity?: string[] | null;
  project_stage?: ProjectStage | null;
  tenement_status?: TenementStatus | null;
  status?: string;
}

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();

  const { data, error } = await admin
    .from('projects')
    .select('id, name, region, municipality, company_name, commodity, project_stage, tenement_status, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/marketplace/projects GET] failed:', error);
    return NextResponse.json({ error: 'Error al listar proyectos' }, { status: 500 });
  }

  const projects = (data ?? []) as ProjectListItem[];

  // Tally document counts per project in one lightweight query (one column).
  const counts: Record<string, number> = {};
  if (projects.length > 0) {
    const { data: docRows, error: docErr } = await admin
      .from('project_documents')
      .select('project_id');
    if (docErr) {
      console.error('[admin/marketplace/projects GET] doc count failed:', docErr);
    } else {
      for (const r of (docRows ?? []) as { project_id: string }[]) {
        counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
      }
    }
  }

  const rows = projects.map((p) => ({ ...p, document_count: counts[p.id] ?? 0 }));
  return NextResponse.json({ projects: rows });
}

export async function POST(req: Request) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  let body: CreateProjectPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length < 3) {
    return NextResponse.json({ error: 'El nombre debe tener al menos 3 caracteres.' }, { status: 400 });
  }
  if (body.project_stage && !PROJECT_STAGE_VALUES.includes(body.project_stage)) {
    return NextResponse.json({ error: 'project_stage inválido.' }, { status: 400 });
  }
  if (body.tenement_status && !TENEMENT_STATUS_VALUES.includes(body.tenement_status)) {
    return NextResponse.json({ error: 'tenement_status inválido.' }, { status: 400 });
  }
  if (body.status && !PROJECT_STATUS_VALUES.includes(body.status as typeof PROJECT_STATUS_VALUES[number])) {
    return NextResponse.json({ error: 'status inválido.' }, { status: 400 });
  }

  const commodity = Array.isArray(body.commodity)
    ? body.commodity.map((c) => String(c).trim()).filter(Boolean)
    : null;

  const admin = getAdminClient();

  const { data, error } = await admin
    .from('projects')
    .insert({
      name,
      description:     body.description?.toString().trim() || null,
      region:         body.region?.toString().trim() || null,
      municipality:   body.municipality?.toString().trim() || null,
      company_name:   body.company_name?.toString().trim() || null,
      commodity:      commodity && commodity.length > 0 ? commodity : null,
      project_stage:  body.project_stage ?? null,
      tenement_status: body.tenement_status ?? null,
      status:         body.status ?? 'active',
      created_by:     auth.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'El proyecto ya existe.' }, { status: 409 });
    }
    console.error('[admin/marketplace/projects POST] failed:', error);
    return NextResponse.json({ error: 'Error al crear proyecto' }, { status: 500 });
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
