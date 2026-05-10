import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { emailResetPassword } from '@/services/emailService';

const RESET_LIMIT     = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/reset-password — sends a branded password recovery email.
//
// Uses generateLink('recovery') so we control the delivery via SendGrid
// (Supabase's built-in mailer is left disabled in the dashboard).
// Returns { ok: true } regardless of whether the email exists, to avoid
// leaking which addresses are registered.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Correo requerido' }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }

    const rateKey = `reset-password:${clientIpFrom(req)}:${email.toLowerCase()}`;
    const rate    = checkRateLimit(rateKey, RESET_LIMIT, RESET_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta nuevamente en ${Math.ceil(rate.retryAfterSec / 60)} minutos.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal';

    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo: `${siteUrl}/auth/resetear-password` },
    });

    // Email enumeration guard: respond identically whether or not the user
    // exists. Log server-side so admins can diagnose genuine failures.
    if (error || !data?.properties?.action_link) {
      console.error('[reset-password] generateLink failed:', error?.message ?? 'no action_link');
      return NextResponse.json({ ok: true });
    }

    emailResetPassword(email, data.properties.action_link).catch(
      (err: unknown) => console.error('[reset-password] email failed:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password] unexpected:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
