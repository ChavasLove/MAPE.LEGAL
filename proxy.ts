import { NextResponse, type NextRequest } from 'next/server';

const DASHBOARD_ROLES = new Set(['admin', 'abogado', 'tecnico_ambiental']);

// Routes that must remain publicly accessible
function isPublic(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/admin/login' ||       // redirects to /login on the page itself
    pathname.startsWith('/api/auth/') || // unified auth endpoints
    pathname.startsWith('/api/admin/auth/') || // legacy admin auth
    pathname.startsWith('/api/webhook/') ||    // external webhooks (Meta, etc.)
    pathname === '/api/whatsapp' ||            // Twilio webhook — no cookies from external
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname === '/favicon.ico'
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Only gate these protected prefixes — public pages stay open
  const isProtected =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/expedientes') ||
    pathname.startsWith('/api/documentos') ||
    pathname.startsWith('/api/mensajes') ||
    pathname.startsWith('/api/email/') ||
    pathname.startsWith('/api/whatsapp/') ||
    pathname.startsWith('/api/prices');

  if (!isProtected) return NextResponse.next();

  // Resolve token and role — support both new unified cookies and legacy admin-token
  const token = request.cookies.get('auth-token')?.value
    ?? request.cookies.get('admin-token')?.value;

  const role = request.cookies.get('auth-role')?.value
    ?? (request.cookies.get('admin-token')?.value ? 'admin' : null);

  if (!token || !role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── /admin/* — admin only ────────────────────────────────────────────────
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    if (role !== 'admin') return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  // ── /dashboard/* and dashboard API — abogado, tecnico_ambiental, admin ──
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/expedientes') ||
    pathname.startsWith('/api/documentos') ||
    pathname.startsWith('/api/mensajes') ||
    pathname.startsWith('/api/email/') ||
    pathname.startsWith('/api/whatsapp/') ||
    pathname.startsWith('/api/prices')
  ) {
    if (!DASHBOARD_ROLES.has(role)) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  // ── /portal/* — cliente only ─────────────────────────────────────────────
  if (pathname.startsWith('/portal')) {
    if (role !== 'cliente') return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/portal/:path*',
    '/login',
    '/api/admin/:path*',
    '/api/auth/:path*',
    '/api/expedientes/:path*',
    '/api/documentos/:path*',
    '/api/mensajes/:path*',
    '/api/email/:path*',
    '/api/whatsapp/:path*',
    '/api/prices',
    '/api/webhook/:path*',
  ],
};
