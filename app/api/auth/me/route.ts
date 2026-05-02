import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value
    ?? req.cookies.get('admin-token')?.value;  // backward compat

  const role = req.cookies.get('auth-role')?.value
    ?? (req.cookies.get('admin-token')?.value ? 'admin' : null);

  if (!token || !role) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }

  return NextResponse.json({ id: user.id, email: user.email, role });
}
