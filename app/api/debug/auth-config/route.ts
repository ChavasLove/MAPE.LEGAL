import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAuthEnv } from '@/lib/authEnv';

export const dynamic = 'force-dynamic';

// GET /api/debug/auth-config
// Read-only diagnostic: hit this in a browser when login returns
// "Configuración de servidor incompleta" or "Sin rol asignado" to see which
// env var is broken — and whether the service-role key actually works.
//
// Reports presence/placeholder status for each env var (never returns the
// values themselves), then attempts a service-role round-trip query against
// public.user_roles. Probing user_roles deliberately: that is the table that
// has been failing in production, so a successful probe rules out both
// "service key missing/wrong" and "RLS policy on user_roles still broken".
type LiveStatus = 'ok' | 'unauthorized' | 'unreachable' | 'skipped';

export async function GET() {
  const env = checkAuthEnv();

  let serviceKeyLive: LiveStatus = 'skipped';
  let serviceKeyError: string | null = null;

  if (env.serviceKey === 'ok' && env.url === 'ok') {
    try {
      const probe = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
        process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error } = await probe
        .from('user_roles')
        .select('user_id', { head: true, count: 'exact' })
        .limit(1);
      if (error) {
        serviceKeyLive  = 'unauthorized';
        serviceKeyError = `${error.code ?? '?'}: ${error.message}`;
      } else {
        serviceKeyLive = 'ok';
      }
    } catch (e: unknown) {
      serviceKeyLive  = 'unreachable';
      serviceKeyError = e instanceof Error ? e.message : String(e);
    }
  }

  const allOk = env.url === 'ok'
    && env.anonKey === 'ok'
    && env.serviceKey === 'ok'
    && serviceKeyLive === 'ok';

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      ok:        allOk,
      env: {
        NEXT_PUBLIC_SUPABASE_URL:      env.url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
        SUPABASE_SERVICE_ROLE_KEY:     env.serviceKey,
      },
      probe: {
        target:      'public.user_roles',
        status:      serviceKeyLive,
        error:       serviceKeyError,
      },
      hint: allOk
        ? 'Auth env looks good and the service-role key can read user_roles. If login still fails, check Supabase Auth user state.'
        : !env.ok || env.serviceKey !== 'ok'
          ? 'Set the missing/placeholder vars in Vercel → Project → Settings → Environment Variables for Production, then redeploy.'
          : serviceKeyLive === 'unauthorized'
            ? 'Service-role key is set but cannot read public.user_roles. Likely causes: key revoked, key from a different Supabase project, or migration 017_fix_user_roles_recursion.sql not applied (look for 42P17 in probe.error).'
            : 'Service-role probe could not reach Supabase — check network egress from Vercel and the Supabase URL.',
    },
    { status: 200 }
  );
}
