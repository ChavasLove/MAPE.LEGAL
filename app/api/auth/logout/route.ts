import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

// POST /api/auth/logout — clears auth cookies AND revokes the refresh token
// server-side. Without the server-side revoke, the refresh token remained
// valid for 30 days after logout — anyone who captured it (XSS, log leak,
// shared device) could mint fresh access tokens indefinitely.
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('auth-token')?.value;

  // Best-effort revocation. The cookie clear below always runs — even if
  // Supabase is unreachable, the local browser session is gone immediately.
  // Scope 'global' invalidates every refresh token for the user, which is
  // the right default for a sensitive admin/legal system: a logout click
  // here is a security signal, not a UX preference.
  if (accessToken) {
    try {
      const admin = getAdminClient();
      await admin.auth.admin.signOut(accessToken, 'global');
    } catch (err) {
      console.error('[logout] supabase admin.signOut failed:', err);
    }
  }

  const loginUrl = new URL('/login', req.url);
  const res = NextResponse.redirect(loginUrl);

  // Clear unified auth cookies + the legacy admin-token in case any stale
  // sessions still carry it from before its removal.
  for (const name of ['auth-token', 'auth-role', 'auth-refresh', 'user-email', 'admin-token']) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' });
  }

  return res;
}
