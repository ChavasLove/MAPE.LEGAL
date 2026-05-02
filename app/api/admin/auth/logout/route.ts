import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/admin/login', req.url));
  res.cookies.set('admin-token', '', { maxAge: 0, path: '/' });
  return res;
}
