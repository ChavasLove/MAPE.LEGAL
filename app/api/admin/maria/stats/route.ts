import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { checkWhatsAppTokenHealth } from '@/services/whatsappService';

export const dynamic = 'force-dynamic';

// GET /api/admin/maria/stats
// Aggregates the KPI tiles for the María Master Control Panel landing.
// All counts are admin-gated and use the service-role client.
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const admin = getAdminClient();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  const [
    convoCount,
    convoTodayPhones,
    onboardingFunnel,
    pendingTx,
    lastBroadcastRes,
    lastAdminCmdRes,
    subscribersRes,
    clientesCountRes,
    pricesTodayRes,
    health,
  ] = await Promise.all([
    admin
      .from('conversaciones_whatsapp')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso),
    admin
      .from('conversaciones_whatsapp')
      .select('numero_whatsapp')
      .gte('created_at', startIso),
    admin
      .from('onboarding_states')
      .select('estado'),
    admin
      .from('transacciones_pendientes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente_confirmacion'),
    admin
      .from('broadcast_log')
      .select('fecha, total_enviados, total_errores, aborted_reason, error_msg, triggered_by, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('admin_actions')
      .select('user_phone, command_type, success, error_msg, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('usuarios_broadcast')
      .select('rol, activo, suscrito'),
    admin
      .from('clientes')
      .select('id', { count: 'exact', head: true }),
    admin
      .from('precios_diarios')
      .select('fecha, oro, plata, usd_hnl, fetched_at')
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle(),
    checkWhatsAppTokenHealth().catch(err => ({
      ok: false,
      isAuthError: false,
      error: err instanceof Error ? err.message : String(err),
    })),
  ]);

  // Build subscribers breakdown by role
  const subs = subscribersRes.data ?? [];
  const subscribers = {
    total:    subs.length,
    active:   subs.filter(s => s.activo && s.suscrito).length,
    by_role:  { minero: 0, comprador: 0, tecnico: 0, admin: 0 } as Record<string, number>,
  };
  for (const s of subs) {
    if (s.activo && s.suscrito && subscribers.by_role[s.rol] !== undefined) {
      subscribers.by_role[s.rol] += 1;
    }
  }

  // Build onboarding funnel
  const funnel: Record<string, number> = {
    ASK_NAME: 0, ASK_ID: 0, ASK_LOCATION: 0, ASK_ROLE: 0, COMPLETE: 0,
  };
  for (const row of onboardingFunnel.data ?? []) {
    if (funnel[row.estado] !== undefined) funnel[row.estado] += 1;
  }
  const leadsInProgress =
    funnel.ASK_NAME + funnel.ASK_ID + funnel.ASK_LOCATION + funnel.ASK_ROLE;

  // Distinct phones today
  const phonesToday = new Set(
    (convoTodayPhones.data ?? []).map(r => r.numero_whatsapp)
  );

  return NextResponse.json({
    conversations_today_count: convoCount.count ?? 0,
    unique_phones_today:       phonesToday.size,
    onboarding_funnel:         funnel,
    leads_in_onboarding:       leadsInProgress,
    pending_transactions:      pendingTx.count ?? 0,
    last_broadcast:            lastBroadcastRes.data ?? null,
    last_admin_command:        lastAdminCmdRes.data ?? null,
    subscribers,
    clientes_total:            clientesCountRes.count ?? 0,
    prices_today:              pricesTodayRes.data ?? null,
    whatsapp_token_health:     health,
    timestamp:                 new Date().toISOString(),
  });
}
