import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export const dynamic = 'force-dynamic';

interface ConvoRow {
  numero_whatsapp: string;
  role:            string;
  content:         string;
  created_at:      string;
}

interface ClienteSlim {
  id:              string;
  nombre:          string | null;
  telefono_whatsapp: string | null;
  municipio:       string | null;
}

// GET /api/admin/maria/conversations?limit=200&search=
// Returns one row per phone with last-message metadata + cliente match + onboarding state.
//
// Implementation: fetches up to `limit` recent message rows, groups by phone
// in JS. For active conversations this comfortably covers the last few days
// without paginating per-phone.
export async function GET(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10) || 500, 2000);
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();

  const { data: messages, error } = await admin
    .from('conversaciones_whatsapp')
    .select('numero_whatsapp, role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by phone — first row per phone is the most recent (we ordered desc)
  const byPhone = new Map<string, {
    telefono:        string;
    last_message_at: string;
    last_role:       string;
    last_preview:    string;
    message_count:   number;
  }>();

  for (const m of (messages ?? []) as ConvoRow[]) {
    const existing = byPhone.get(m.numero_whatsapp);
    if (existing) {
      existing.message_count += 1;
    } else {
      byPhone.set(m.numero_whatsapp, {
        telefono:        m.numero_whatsapp,
        last_message_at: m.created_at,
        last_role:       m.role,
        last_preview:    m.content.slice(0, 120),
        message_count:   1,
      });
    }
  }

  const phones = Array.from(byPhone.keys());
  if (phones.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // Strip whatsapp: prefix to match clientes.telefono_whatsapp + onboarding_states.telefono
  const normalized = phones.map(p => p.replace(/^whatsapp:/i, ''));

  const [clientesRes, onboardingRes] = await Promise.all([
    admin
      .from('clientes')
      .select('id, nombre, telefono_whatsapp, municipio')
      .in('telefono_whatsapp', normalized),
    admin
      .from('onboarding_states')
      .select('telefono, estado, datos, updated_at')
      .in('telefono', normalized),
  ]);

  const clientesByPhone = new Map<string, ClienteSlim>();
  for (const c of (clientesRes.data ?? []) as ClienteSlim[]) {
    if (c.telefono_whatsapp) clientesByPhone.set(c.telefono_whatsapp, c);
  }

  const onboardingByPhone = new Map<string, { estado: string; datos: unknown; updated_at: string }>();
  for (const o of onboardingRes.data ?? []) {
    onboardingByPhone.set(o.telefono, o);
  }

  const conversations = Array.from(byPhone.values())
    .map(c => {
      const norm = c.telefono.replace(/^whatsapp:/i, '');
      const cliente = clientesByPhone.get(norm) ?? null;
      const onboarding = onboardingByPhone.get(norm) ?? null;
      return {
        ...c,
        cliente_id:        cliente?.id ?? null,
        cliente_nombre:    cliente?.nombre ?? null,
        cliente_municipio: cliente?.municipio ?? null,
        onboarding_estado: onboarding?.estado ?? null,
      };
    })
    .filter(c => {
      if (!search) return true;
      const haystack = [
        c.telefono,
        c.cliente_nombre ?? '',
        c.cliente_municipio ?? '',
        c.last_preview,
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  return NextResponse.json({ conversations });
}
