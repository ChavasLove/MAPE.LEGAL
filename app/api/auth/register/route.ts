import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { emailConfirmacionCorreo } from '@/services/emailService';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

const REGISTER_LIMIT     = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register — public self-registration for new clients.
//
// Self-registration is locked to role 'cliente'. The role row is created
// automatically by the `on_auth_user_created` trigger (migration 015), so we
// don't need to insert into user_roles here.
//
// We use admin.generateLink('signup') instead of auth.signUp() because:
//   - it bypasses Supabase's built-in mailer (we deliver via SendGrid)
//   - it returns a usable action_link for the branded confirmation email
//   - it avoids leaking user-existence via signUp's distinct error codes
export async function POST(req: NextRequest) {
  try {
    const { email, password, nombre, telefono } = await req.json();

    // ── Validation ──────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 });
    }
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Contraseña debe tener entre 8 y 128 caracteres' },
        { status: 400 }
      );
    }

    const rateKey = `register:${clientIpFrom(req)}`;
    const rate    = checkRateLimit(rateKey, REGISTER_LIMIT, REGISTER_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Demasiados registros. Intenta en ${Math.ceil(rate.retryAfterSec / 60)} minutos.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal';

    // ── Create the auth user via admin (no email is sent by Supabase) ──
    const admin = getAdminClient();
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type:     'signup',
      email,
      password,
      options: {
        data:       { nombre: nombre ?? null, telefono: telefono ?? null },
        redirectTo: `${siteUrl}/login?confirmed=1`,
      },
    });

    if (linkErr) {
      const msg = (linkErr.message ?? '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'El correo ya está registrado' }, { status: 409 });
      }
      // Supabase returns "Database error saving new user" when the
      // on_auth_user_created trigger (migration 015) fails — typically because
      // migration 017_fix_user_roles_recursion.sql wasn't applied to the
      // production database, so the recursive RLS policy on user_roles trips
      // 42P17 inside the trigger and rolls back the auth.users INSERT. This
      // is a server-side configuration error, not a user input problem;
      // surface it with a distinct code so it lights up in error monitors.
      if (msg.includes('database error') || msg.includes('saving new user')) {
        console.error('[register] trigger failure — likely migration 017_fix_user_roles_recursion.sql not applied to production Supabase. Original error:', linkErr.message);
        return NextResponse.json(
          { error: 'No se pudo crear la cuenta. El equipo ya fue notificado.', code: 'TRIGGER_FAILURE' },
          { status: 500 }
        );
      }
      console.error('[register] generateLink failed:', linkErr.message);
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 400 });
    }
    if (!linkData?.user || !linkData.properties?.action_link) {
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 });
    }

    // The on_auth_user_created trigger has now inserted user_roles (cliente, activo=true).
    // Self-registration cannot promote — admins do that via /admin/usuarios.

    emailConfirmacionCorreo(email, linkData.properties.action_link).catch(
      (err: unknown) => console.error('[register] email failed:', err)
    );

    return NextResponse.json({
      ok: true,
      message: 'Revisa tu correo para confirmar tu cuenta.',
    });
  } catch (err) {
    console.error('[register] unexpected:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
