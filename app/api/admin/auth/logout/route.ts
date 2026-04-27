import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const loginUrl = new URL('/admin/login', req.url);
  const res = NextResponse.redirect(loginUrl);
  res.cookies.set('admin-token', '', { maxAge: 0, path: '/' });
  return res;
}
