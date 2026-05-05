import { NextResponse } from 'next/server';
import { checkWhatsAppTokenHealth } from '@/services/whatsappService';

export const dynamic = 'force-dynamic';

// GET /api/admin/whatsapp/health
// Verifies the WHATSAPP_TOKEN against Meta Cloud API without sending a message.
// Use this to diagnose 8 AM broadcast failures: an expired token returns
// { ok: false, isAuthError: true } and the env var must be regenerated.
//
// Protected by proxy.ts admin gate. No CRON_SECRET required (admin cookie path).
export async function GET() {
  const health = await checkWhatsAppTokenHealth();
  const status = health.ok ? 200 : (health.isAuthError ? 401 : 500);
  return NextResponse.json(health, { status });
}
