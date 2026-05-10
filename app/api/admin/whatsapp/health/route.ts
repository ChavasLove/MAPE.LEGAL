import { NextResponse } from 'next/server';
import { checkWhatsAppTokenHealth } from '@/services/whatsappService';
import { requireRole } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/whatsapp/health
// Verifies the WHATSAPP_TOKEN against Meta Cloud API without sending a message.
// Use this to diagnose 8 AM broadcast failures: an expired token returns
// { ok: false, isAuthError: true } and the env var must be regenerated.
//
// Admin-gated at the route level (defence in depth — does not rely on the
// proxy alone, which only checks cookie presence).
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const health = await checkWhatsAppTokenHealth();
  const status = health.ok ? 200 : (health.isAuthError ? 401 : 500);
  return NextResponse.json(health, { status });
}
