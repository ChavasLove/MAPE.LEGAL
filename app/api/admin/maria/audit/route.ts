import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

// GET /api/admin/maria/audit?limit=100&command_type=...&since=ISO
// Returns admin_actions rows — the audit trail of WhatsApp admin commands
// (issued via the passphrase + intent parser flow).
export async function GET(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100, 500);
  const commandType = url.searchParams.get('command_type');
  const since = url.searchParams.get('since');

  const admin = getAdminClient();
  let q = admin
    .from('admin_actions')
    .select('id, user_phone, command_type, payload, success, error_msg, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (commandType) q = q.eq('command_type', commandType);
  if (since) q = q.gte('created_at', since);

  const { data, error } = await q;
  if (error) {
    console.error('[admin/maria/audit GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener auditoría' }, { status: 500 });
  }

  return NextResponse.json({ actions: data ?? [] });
}
