import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/services/adminSupabase';

// POST /api/auth/confirm-reset — completes a password reset.
//
// The reset page (/auth/resetear-password) extracts the `access_token` from the
// URL fragment (the recovery link Supabase issues redirects with `#access_token=`)
// and posts it here along with the new password.
//
// We validate the JWT against Supabase Auth (anon client) to identify the user,
// then update the password with the admin client. Updating via the admin path
// is more reliable than calling updateUser with a stateless recovery JWT, which
// requires re-establishing a session and can flake with `persistSession: false`.
export async function POST(req: NextRequest) {
  try {
    const { accessToken, password } = await req.json();

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json({ error: 'Token de recuperación requerido' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Contraseña inválida (mínimo 8, máximo 128 caracteres)' },
        { status: 400 }
      );
    }

    const url     = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
    }

    // Validate the recovery JWT and identify the user.
    const validator = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: userRes, error: userErr } = await validator.auth.getUser(accessToken);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    // Apply the new password using the service role client. This avoids the
    // need to set or carry a recovery session in the server context.
    const admin = getAdminClient();
    const { error: updErr } = await admin.auth.admin.updateUserById(userRes.user.id, { password });
    if (updErr) {
      console.error('[confirm-reset] update failed:', updErr.message);
      return NextResponse.json({ error: 'No se pudo actualizar la contraseña' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[confirm-reset] unexpected:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
