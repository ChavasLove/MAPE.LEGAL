import { NextResponse, type NextRequest } from 'next/server';
import { validateAccessToken } from '@/lib/sessionValidator';

// Guard real de rutas en el límite de request (convención `proxy` de
// Next.js 16 — ES el middleware del framework: `middleware.ts` está deprecado
// y renombrado a `proxy.ts`, ver node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md; el build lo confirma con
// "ƒ Proxy (Middleware)").
//
// Desde el blindaje Fase 0 (2026-08) este guard exige una SESIÓN VÁLIDA:
// el JWT de la cookie auth-token se valida contra Supabase Auth en cada
// request protegida (lib/sessionValidator.ts — el mismo validador que usa
// lib/serverAuth.ts), no solo la presencia de cookies. La autorización por
// ROL sigue viviendo en requireRole()/layouts dentro de cada handler — esto
// es defensa en profundidad, no reemplazo.
//
// Contrato:
//  - Páginas protegidas sin sesión → 302 a /login?from=<ruta-original>
//    (convención existente de /login: safeFrom() lee `from` con guard
//    anti open-redirect).
//  - APIs protegidas sin sesión → 401 JSON { error: 'no_autenticado' } —
//    nunca redirect en APIs.
//  - Superficies públicas intactas: /, /pequena-mineria, /comercializacion,
//    /mercados, /precio, /precios, /politica-de-precios, /verificar*,
//    /api/verificar/*, /aviso-legal, /equipos, /registro, /login, /auth/*,
//    /api/auth/*, /api/maria/chat, /api/webhook/*, /api/whatsapp (webhook
//    Twilio), /api/broadcast/run (CRON_SECRET), /api/precio*, /api/precios/*,
//    /api/concesiones/*, /api/contacto, /api/equipos*, assets. El matcher
//    solo cubre prefijos protegidos, así que todo lo no listado abajo queda
//    público por defecto; isPublic() cubre además las rutas públicas que un
//    prefijo protegido del matcher sí alcanza.

// Rutas públicas que el matcher puede alcanzar — nunca se gatean.
function isPublic(pathname: string): boolean {
  return (
    pathname === '/api/whatsapp' ||          // webhook Twilio — sin cookies
    pathname === '/api/broadcast/run' ||     // cron — protegido por CRON_SECRET
    pathname.startsWith('/api/auth/') ||     // endpoints de auth unificados
    pathname.startsWith('/api/webhook/') ||  // webhooks externos (Meta)
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/sitemap')
  );
}

// APIs internas: sin sesión válida → 401 JSON, jamás redirect.
function isProtectedApi(pathname: string): boolean {
  return (
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/expedientes') ||
    pathname.startsWith('/api/documentos') ||
    pathname.startsWith('/api/mensajes') ||
    pathname.startsWith('/api/email/') ||
    pathname.startsWith('/api/whatsapp/') || // /api/whatsapp exacto es público (arriba)
    pathname.startsWith('/api/broadcast/config') ||
    pathname.startsWith('/api/broadcast/prices') ||
    pathname === '/api/broadcast' ||
    pathname.startsWith('/api/prices')
  );
}

// Páginas internas: sin sesión válida → 302 a /login.
function isProtectedPage(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/expedientes') // superficie interna: consume /api/expedientes
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const protectedApi = isProtectedApi(pathname);
  const protectedPage = isProtectedPage(pathname);
  if (!protectedApi && !protectedPage) return NextResponse.next();

  const token = request.cookies.get('auth-token')?.value;
  const user = token ? await validateAccessToken(token, 'proxy') : null;

  if (!user) {
    if (protectedApi) {
      return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl, 302);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/portal/:path*',
    '/expedientes/:path*',
    '/api/admin/:path*',
    '/api/expedientes/:path*',
    '/api/documentos/:path*',
    '/api/mensajes/:path*',
    '/api/email/:path*',
    '/api/whatsapp/:path*',
    '/api/broadcast',
    '/api/broadcast/:path*',
    '/api/prices',
  ],
};
