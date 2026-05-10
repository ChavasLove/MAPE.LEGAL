import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { checkAuthEnv, logAuthEnvFailure } from '@/lib/authEnv';
import { lookupUserRole, type Role } from '@/lib/userRoleLookup';

// Single source of truth for "is the caller logged in and what role do they have".
// The auth-role cookie is treated as a hint for proxy.ts only — never trusted by
// any server component or API route. Role is always re-derived from user_roles
// via the SECURITY DEFINER RPC (see lib/userRoleLookup.ts).

export type { Role };

export const DASHBOARD_ROLES: ReadonlyArray<Role> = ['admin', 'abogado', 'tecnico_ambiental'];

export interface AuthContext {
  user: User;
  role: Role;
  token: string;
}

function validatorClient(): SupabaseClient | null {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function roleLookupClient(): SupabaseClient | null {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Validates the JWT against Supabase Auth and resolves the role from user_roles.
// Returns null when:
//   - no token cookie is present
//   - JWT is missing/expired/malformed/signature-invalid (Supabase rejects)
//   - role lookup fails for any reason (logged via lookupUserRole)
//   - required env vars are missing (logs to stderr first)
export async function getServerAuth(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get('auth-token')?.value;
  if (!token) return null;

  const env = checkAuthEnv();
  if (!env.ok) {
    logAuthEnvFailure('serverAuth', env);
    return null;
  }

  const validator = validatorClient();
  if (!validator) return null;

  const { data: { user }, error } = await validator.auth.getUser(token);
  if (error || !user) return null;

  const roleClient = roleLookupClient();
  if (!roleClient) return null;

  const result = await lookupUserRole(roleClient, user.id, 'serverAuth');
  if (!result.ok) return null;

  return { user, role: result.role, token };
}

// Convenience for API route handlers. Returns the auth context when allowed,
// otherwise a 401/403 NextResponse the handler should return immediately.
//
//   const auth = await requireRole('admin');
//   if (auth instanceof NextResponse) return auth;
//   // ... use auth.user / auth.role
//
// Pass no roles to require any authenticated user.
export async function requireRole(...allowed: Role[]): Promise<AuthContext | NextResponse> {
  const ctx = await getServerAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (allowed.length > 0 && !allowed.includes(ctx.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }
  return ctx;
}
