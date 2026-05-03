import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const loginUrl = new URL('/login', req.url);
  const res = NextResponse.redirect(loginUrl);

  for (const name of ['auth-token', 'auth-role', 'auth-refresh', 'user-email', 'admin-token']) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' });
  }

  return res;
}
