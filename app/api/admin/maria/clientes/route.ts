import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { normalizePhone } from '@/lib/maria/normalizePhone';

export const dynamic = 'force-dynamic';

const PROFILE_FIELDS = [
  'nombre', 'dpi', 'municipio', 'situacion_tierra', 'tipo_mineral',
] as const;

interface ClienteRow {
  id:                string;
  nombre:            string | null;
  dpi:               string | null;
  municipio:         string | null;
  situacion_tierra:  string | null;
  tipo_mineral:      string | null;
  telefono_whatsapp: string | null;
  created_at:        string;
  updated_at:        string;
}

interface OnboardingRow {
  telefono:   string;
  estado:     string;
  datos:      Record<string, unknown> | null;
  updated_at: string;
}

interface ConvoMeta {
  numero_whatsapp: string;
  created_at:      string;
}

// GET /api/admin/maria/clientes
//
// Returns the union of:
//   - registered clientes (clientes table) — full profile
//   - phones with onboarding_states rows still in progress (leads)
//   - phones with conversaciones_whatsapp activity that aren't yet in clientes
//
// Each row carries a completeness score (out of PROFILE_FIELDS.length) and the
// most recent message timestamp. Used by /admin/maria/clientes for the "live
// data María is gathering" view.
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();

  const [clientesRes, onboardingRes, convoMetaRes] = await Promise.all([
    admin
      .from('clientes')
      .select('id, nombre, dpi, municipio, situacion_tierra, tipo_mineral, telefono_whatsapp, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('onboarding_states')
      .select('telefono, estado, datos, updated_at'),
    admin
      .from('conversaciones_whatsapp')
      .select('numero_whatsapp, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  if (clientesRes.error) {
    return NextResponse.json({ error: clientesRes.error.message }, { status: 500 });
  }

  // Build last-message-by-phone map. All phones are funneled through
  // normalizePhone to dedup `whatsapp:+504…` and `+504…` rows for the same
  // human.
  const lastMessageByPhone = new Map<string, string>();
  for (const m of (convoMetaRes.data ?? []) as ConvoMeta[]) {
    const norm = normalizePhone(m.numero_whatsapp);
    if (norm && !lastMessageByPhone.has(norm)) {
      lastMessageByPhone.set(norm, m.created_at);
    }
  }

  // Build onboarding map (also normalized — onboarding_states.telefono should
  // be stripped already, but normalize defensively in case stale rows exist).
  const onboardingByPhone = new Map<string, OnboardingRow>();
  for (const o of (onboardingRes.data ?? []) as OnboardingRow[]) {
    const k = normalizePhone(o.telefono);
    if (k) onboardingByPhone.set(k, o);
  }

  // Funnel
  const funnel: Record<string, number> = {
    ASK_NAME: 0, ASK_ID: 0, ASK_LOCATION: 0, ASK_ROLE: 0, COMPLETE: 0,
  };
  for (const o of onboardingRes.data ?? []) {
    if (funnel[o.estado] !== undefined) funnel[o.estado] += 1;
  }

  // Compose unified rows. Track which phones we've already emitted.
  const seen = new Set<string>();
  const rows: Array<{
    source:            'cliente' | 'lead' | 'visitor';
    cliente_id:        string | null;
    telefono:          string;
    nombre:            string | null;
    dpi:               string | null;
    municipio:         string | null;
    situacion_tierra:  string | null;
    tipo_mineral:      string | null;
    completeness:      number;
    completeness_max:  number;
    onboarding_estado: string | null;
    last_message_at:   string | null;
    created_at:        string | null;
    updated_at:        string | null;
  }> = [];

  // 1. Registered clientes
  for (const c of (clientesRes.data ?? []) as ClienteRow[]) {
    const phone = normalizePhone(c.telefono_whatsapp ?? '');
    if (phone) seen.add(phone); // skip empty-phone clientes from dedup set
    const completeness = PROFILE_FIELDS.reduce(
      (n, f) => n + (c[f] ? 1 : 0), 0
    );
    rows.push({
      source:            'cliente',
      cliente_id:        c.id,
      telefono:          phone,
      nombre:            c.nombre,
      dpi:               c.dpi,
      municipio:         c.municipio,
      situacion_tierra:  c.situacion_tierra,
      tipo_mineral:      c.tipo_mineral,
      completeness,
      completeness_max:  PROFILE_FIELDS.length,
      onboarding_estado: phone ? onboardingByPhone.get(phone)?.estado ?? null : null,
      last_message_at:   phone ? lastMessageByPhone.get(phone) ?? null : null,
      created_at:        c.created_at,
      updated_at:        c.updated_at,
    });
  }

  // 2. Onboarding leads not in clientes
  for (const o of (onboardingRes.data ?? []) as OnboardingRow[]) {
    const phone = normalizePhone(o.telefono);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    const datos = o.datos ?? {};
    // Datos shape varies by extraction — read defensively.
    const get = (k: string) => {
      const v = (datos as Record<string, unknown>)[k];
      return typeof v === 'string' ? v : null;
    };
    const partial = {
      nombre:           get('nombre'),
      dpi:              get('dpi'),
      municipio:        get('municipio'),
      situacion_tierra: get('situacion_tierra'),
      tipo_mineral:     get('tipo_mineral'),
    };
    const completeness =
      (partial.nombre ? 1 : 0) +
      (partial.dpi ? 1 : 0) +
      (partial.municipio ? 1 : 0) +
      (partial.situacion_tierra ? 1 : 0) +
      (partial.tipo_mineral ? 1 : 0);
    rows.push({
      source:            'lead',
      cliente_id:        null,
      telefono:          phone,
      ...partial,
      completeness,
      completeness_max:  PROFILE_FIELDS.length,
      onboarding_estado: o.estado,
      last_message_at:   lastMessageByPhone.get(phone) ?? null,
      created_at:        null,
      updated_at:        o.updated_at,
    });
  }

  // 3. Visitors (have conversation but no cliente + no onboarding). The keys
  // in lastMessageByPhone are already normalized.
  for (const [phone, lastAt] of lastMessageByPhone.entries()) {
    if (seen.has(phone)) continue;
    rows.push({
      source:            'visitor',
      cliente_id:        null,
      telefono:          phone,
      nombre:            null,
      dpi:               null,
      municipio:         null,
      situacion_tierra:  null,
      tipo_mineral:      null,
      completeness:      0,
      completeness_max:  PROFILE_FIELDS.length,
      onboarding_estado: null,
      last_message_at:   lastAt,
      created_at:        null,
      updated_at:        null,
    });
  }

  // Sort: most recent activity first, then most recent created
  rows.sort((a, b) => {
    const aTs = a.last_message_at ?? a.updated_at ?? a.created_at ?? '';
    const bTs = b.last_message_at ?? b.updated_at ?? b.created_at ?? '';
    return bTs.localeCompare(aTs);
  });

  return NextResponse.json({
    rows,
    funnel,
    counts: {
      total:    rows.length,
      cliente:  rows.filter(r => r.source === 'cliente').length,
      lead:     rows.filter(r => r.source === 'lead').length,
      visitor:  rows.filter(r => r.source === 'visitor').length,
    },
  });
}
