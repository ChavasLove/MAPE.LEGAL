import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

// POST /api/admin/auth/logout — clears all auth cookies AND revokes the
// session server-side. See /api/auth/logout for the rationale on global scope.
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('auth-token')?.value
    ?? req.cookies.get('admin-token')?.value;

  if (accessToken) {
    try {
      const admin = getAdminClient();
      await admin.auth.admin.signOut(accessToken, 'global');
    } catch (err) {
      console.error('[admin-logout] supabase admin.signOut failed:', err);
    }
  }

  const loginUrl = new URL('/login', req.url);
  const res = NextResponse.redirect(loginUrl);
  res.cookies.set('admin-token',  '', { maxAge: 0, path: '/' });
  res.cookies.set('auth-token',   '', { maxAge: 0, path: '/' });
  res.cookies.set('auth-role',    '', { maxAge: 0, path: '/' });
  res.cookies.set('auth-refresh', '', { maxAge: 0, path: '/' });
  res.cookies.set('user-email',   '', { maxAge: 0, path: '/' });
  return res;
}
