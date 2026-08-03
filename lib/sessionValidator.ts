import { createClient, type User } from '@supabase/supabase-js';

// Single validation path for the auth-token JWT, shared by lib/serverAuth.ts
// (route handlers / server layouts) and proxy.ts (the Next.js 16 request
// boundary, edge runtime). Both callers must agree on what "a valid session"
// means — this module is the only place that answers it.
//
// Edge-compatible on purpose: no next/headers, no service-role key. The anon
// key is enough to validate a JWT via auth.getUser(); role resolution stays in
// lib/serverAuth.ts (it needs the service-role client + the SECURITY DEFINER
// RPC and is NOT the proxy's job — the proxy demands session, not role).
export async function validateAccessToken(
  token: string,
  scope = 'sessionValidator'
): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    // Fail closed: without env vars nothing downstream can validate either.
    console.error(`[${scope}] Supabase env missing — cannot validate session`);
    return null;
  }

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    // Network blips fail closed — an unverifiable session is not a session.
    console.error(`[${scope}] session validation failed:`, err);
    return null;
  }
}
