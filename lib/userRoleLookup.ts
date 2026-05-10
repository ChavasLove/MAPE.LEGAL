import type { SupabaseClient } from '@supabase/supabase-js';

// Single source of truth for "given a Supabase auth user.id, what role do
// they have?". Used by every auth surface (login, oauth-session, callback,
// refresh, serverAuth) so behaviour stays identical across them.
//
// Why an RPC instead of a direct SELECT:
//   The previous implementation did `client.from('user_roles').select(...)`
//   with the service-role client, assuming `service_role` has BYPASSRLS. In
//   Supabase projects where that's not the case, RLS evaluates auth.uid() =
//   null on the policy "Users can read own role", returns 0 rows, and the
//   call surfaces no error — visually identical to a real "no role" miss.
//   The fallback upsert then fails for the same reason → the user lands on
//   /login?error=Sin%20rol%20asignado without any actionable signal.
//
//   `get_user_role_for_login` is SECURITY DEFINER, owner = postgres. It
//   bypasses RLS via owner privileges, so the lookup works regardless of
//   `service_role.rolbypassrls`.

export type Role = 'admin' | 'abogado' | 'tecnico_ambiental' | 'cliente';

export type RoleLookupOk = {
  ok: true;
  role: Role;
  source: 'rpc' | 'fallback';
};
export type RoleLookupFail = {
  ok: false;
  reason: 'inactive' | 'unknown_role' | 'db_error' | 'fallback_failed';
  errorCode?: string;
  errorMessage?: string;
};
export type RoleLookupResult = RoleLookupOk | RoleLookupFail;

const KNOWN_ROLES = new Set<Role>(['admin', 'abogado', 'tecnico_ambiental', 'cliente']);
function isKnownRole(value: string): value is Role {
  return KNOWN_ROLES.has(value as Role);
}

interface RoleRpcRow {
  rol: string;
  activo: boolean;
}

export async function lookupUserRole(
  client: SupabaseClient,
  userId: string,
  scope: string,
): Promise<RoleLookupResult> {
  const { data, error } = await client.rpc('get_user_role_for_login', {
    p_user_id: userId,
  });

  if (error) {
    console.error(`[${scope}] role rpc failed`, {
      user_id: userId,
      code:    error.code,
      message: error.message,
      details: (error as { details?: string }).details,
      hint:    (error as { hint?: string    }).hint,
    });
    return {
      ok:           false,
      reason:       'db_error',
      errorCode:    error.code,
      errorMessage: error.message,
    };
  }

  const rows = Array.isArray(data) ? (data as RoleRpcRow[]) : [];
  const row  = rows[0] ?? null;

  if (row) {
    if (!row.activo)              return { ok: false, reason: 'inactive' };
    if (!isKnownRole(row.rol))    return { ok: false, reason: 'unknown_role' };
    return { ok: true, role: row.rol, source: 'rpc' };
  }

  // No row exists. Self-heal with the default 'cliente' — same pattern as
  // before, but with `ignoreDuplicates: true` so a TOCTOU race against the
  // trigger 015 / a concurrent callback can never overwrite an existing
  // admin row down to 'cliente'.
  const { error: upsertErr } = await client
    .from('user_roles')
    .upsert(
      { user_id: userId, rol: 'cliente', activo: true },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (upsertErr) {
    console.error(`[${scope}] role fallback upsert failed`, {
      user_id: userId,
      code:    upsertErr.code,
      message: upsertErr.message,
      details: (upsertErr as { details?: string }).details,
      hint:    (upsertErr as { hint?: string    }).hint,
    });
    return {
      ok:           false,
      reason:       'fallback_failed',
      errorCode:    upsertErr.code,
      errorMessage: upsertErr.message,
    };
  }

  return { ok: true, role: 'cliente', source: 'fallback' };
}
