import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ROLE_REDIRECT: Record<string, string> = {
  admin:             '/admin',
  abogado:           '/dashboard',
  tecnico_ambiental: '/dashboard',
  cliente:           '/portal',
};

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    // Fetch role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('rol, activo')
      .eq('user_id', data.user.id)
      .single();

    if (!roleRow) {
      return NextResponse.json({ error: 'Sin rol asignado — contacte al administrador' }, { status: 403 });
    }

    if (!roleRow.activo) {
      return NextResponse.json({ error: 'Cuenta inactiva — contacte al administrador' }, { status: 403 });
    }

    const role       = roleRow.rol as string;
    const redirectTo = ROLE_REDIRECT[role] ?? '/dashboard';
    const maxAge     = data.session.expires_in ?? 3600;

    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge,
      path: '/',
    };

    const res = NextResponse.json({ ok: true, role, redirectTo });
    res.cookies.set('auth-token', data.session.access_token, cookieOpts);
    res.cookies.set('auth-role',  role, cookieOpts);
    // Non-httpOnly so the client can read it for display purposes only — not trusted for auth
    res.cookies.set('user-email', email, { ...cookieOpts, httpOnly: false });

    // Backward-compat: keep admin-token for existing admin layout guard
    if (role === 'admin') {
      res.cookies.set('admin-token', data.session.access_token, cookieOpts);
    }

    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
