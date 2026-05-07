import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const loginUrl = new URL('/login', req.url);
  const res = NextResponse.redirect(loginUrl);
  res.cookies.set('admin-token',  '', { maxAge: 0, path: '/' });
  res.cookies.set('auth-token',   '', { maxAge: 0, path: '/' });
  res.cookies.set('auth-role',    '', { maxAge: 0, path: '/' });
  res.cookies.set('auth-refresh', '', { maxAge: 0, path: '/' });
  res.cookies.set('user-email',   '', { maxAge: 0, path: '/' });
  return res;
}
