import { NextResponse } from 'next/server';
import { checkAuthEnv } from '@/lib/authEnv';

export const dynamic = 'force-dynamic';

// GET /api/debug/auth-config
// Read-only diagnostic: hit this in a browser when login returns
// "Configuración de servidor incompleta" to see which env var is broken.
// Reports presence/placeholder status only — never returns values.
export async function GET() {
  const env = checkAuthEnv();
  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      ok:        env.ok,
      env: {
        NEXT_PUBLIC_SUPABASE_URL:      env.url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
        SUPABASE_SERVICE_ROLE_KEY:     env.serviceKey,
      },
      hint: env.ok
        ? 'Auth env looks good. If login still fails, check Supabase Auth user state.'
        : 'Set the missing/placeholder vars in Vercel → Project → Settings → Environment Variables for Production, then redeploy.',
    },
    { status: 200 }
  );
}
