import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/serverAuth';

// Returns the currently-authenticated user. The role is always re-derived
// from user_roles — the auth-role cookie is never trusted as a source of
// truth, only as a hint for the proxy guard.
export async function GET() {
  const auth = await getServerAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }
  return NextResponse.json({
    id:    auth.user.id,
    email: auth.user.email,
    role:  auth.role,
  });
}
