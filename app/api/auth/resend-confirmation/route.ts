import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { emailConfirmacionCorreo } from '@/services/emailService';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

const RESEND_LIMIT     = 3;
const RESEND_WINDOW_MS = 15 * 60 * 1000;

// POST /api/auth/resend-confirmation — sends a fresh confirmation link to an
// unconfirmed user. We use generateLink('magiclink') because:
//   - it works for users that already exist in auth.users (signup-link variant
//     requires a password and is for brand-new accounts)
//   - clicking the link both confirms the email (sets email_confirmed_at) and
//     establishes a one-time session that bounces back to /login?confirmed=1
//   - it does NOT trigger Supabase's built-in mailer, so we control delivery
//     entirely via SendGrid with the branded emailShell()
//
// Returns { ok: true } regardless of whether the address corresponds to a real
// account, to avoid leaking which emails are registered.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Correo requerido' }, { status: 400 });
    }

    const rateKey = `resend:${clientIpFrom(req)}:${email.toLowerCase()}`;
    const rate    = checkRateLimit(rateKey, RESEND_LIMIT, RESEND_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta nuevamente en ${Math.ceil(rate.retryAfterSec / 60)} minutos.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal';
    const admin   = getAdminClient();

    const { data, error } = await admin.auth.admin.generateLink({
      type:  'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/login?confirmed=1` },
    });

    // Email enumeration guard: respond identically whether the user exists or
    // not. Log server-side so admins can debug genuine failures.
    if (error || !data?.properties?.action_link) {
      console.error('[resend-confirmation] generateLink failed:', error?.message ?? 'no action_link');
      return NextResponse.json({ ok: true });
    }

    emailConfirmacionCorreo(email, data.properties.action_link).catch(
      (err: unknown) => console.error('[resend-confirmation] email failed:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend-confirmation] unexpected:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
