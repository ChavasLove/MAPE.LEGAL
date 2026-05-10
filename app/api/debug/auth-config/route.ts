import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAuthEnv } from '@/lib/authEnv';

export const dynamic = 'force-dynamic';

// GET /api/debug/auth-config
// Read-only diagnostic: hit this in a browser when login returns
// "Configuración de servidor incompleta" or "Sin rol asignado" to see which
// env var is broken — and whether the role-lookup path actually works
// end-to-end against the live Supabase project.
//
// Reports presence/placeholder status for each env var (never returns the
// values themselves), then runs three independent probes:
//
//   - rpc_status:           does the SECURITY DEFINER RPC respond? (this is
//                           the path the auth flow takes; if green, login
//                           works regardless of `service_role.rolbypassrls`)
//   - service_role_bypassrls: does direct SELECT on user_roles see actual
//                             rows when called via service-role? `off` means
//                             RLS is hiding rows and the project relies on
//                             the RPC for auth (still works, just informational)
//   - user_roles_count_visible: how many rows the service-role can see; 0
//                                with non-empty table is the BYPASSRLS=off
//                                fingerprint
type RpcStatus    = 'ok' | 'unauthorized' | 'unreachable' | 'skipped';
type BypassStatus = 'on' | 'off' | 'unknown';

// Sentinel UUID — we don't expect any real user to have this id; we just
// want to verify the function executes without 401/permission errors.
const PROBE_UUID = '00000000-0000-0000-0000-000000000000';

export async function GET() {
  const env = checkAuthEnv();

  let rpcStatus: RpcStatus = 'skipped';
  let rpcError:  string | null = null;

  let bypassrls: BypassStatus = 'unknown';
  let visibleRows: number | null = null;
  let directProbeError: string | null = null;

  if (env.url === 'ok' && env.serviceKey === 'ok') {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // (1) RPC probe — the path auth routes actually use.
    try {
      const { error } = await client.rpc('get_user_role_for_login', { p_user_id: PROBE_UUID });
      if (error) {
        rpcStatus = 'unauthorized';
        rpcError  = `${error.code ?? '?'}: ${error.message}`;
      } else {
        rpcStatus = 'ok';
      }
    } catch (e: unknown) {
      rpcStatus = 'unreachable';
      rpcError  = e instanceof Error ? e.message : String(e);
    }

    // (2) Direct SELECT probe — distinguishes BYPASSRLS=on from =off.
    // With BYPASSRLS=on, service_role sees every row. With =off, the only
    // matching policy "Users can read own role" evaluates auth.uid()=null
    // and the count comes back 0 with no error. visibleRows>0 → BYPASSRLS=on
    // for sure. visibleRows=0 is ambiguous (empty table vs. RLS hiding
    // everything), reported as 'unknown'.
    try {
      const { count, error } = await client
        .from('user_roles')
        .select('user_id', { head: true, count: 'exact' });
      if (error) {
        directProbeError = `${error.code ?? '?'}: ${error.message}`;
      } else {
        visibleRows = count ?? 0;
        bypassrls   = visibleRows > 0 ? 'on' : 'unknown';
      }
    } catch (e: unknown) {
      directProbeError = e instanceof Error ? e.message : String(e);
    }
  }

  const allOk = env.ok && rpcStatus === 'ok';

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
        rpc_status:                rpcStatus,
        rpc_error:                 rpcError,
        service_role_bypassrls:    bypassrls,
        user_roles_count_visible:  visibleRows,
        direct_probe_error:        directProbeError,
      },
      hint: hintFor(env.ok, rpcStatus, bypassrls, visibleRows),
    },
    { status: 200 }
  );
}

function hintFor(
  envOk:       boolean,
  rpc:         RpcStatus,
  bypassrls:   BypassStatus,
  visibleRows: number | null,
): string {
  if (!envOk) {
    return 'Set the missing/placeholder vars in Vercel → Project → Settings → Environment Variables for Production, then redeploy.';
  }
  if (rpc !== 'ok') {
    return `RPC get_user_role_for_login is not callable (status: ${rpc}). Most likely cause: migration 019_role_lookup_rpc_and_policy_tighten.sql has not been applied to the Supabase project. Open Supabase Studio → SQL Editor → run that migration.`;
  }
  if (bypassrls === 'unknown' && visibleRows === 0) {
    return 'RPC works (auth flow is fine), but the direct SELECT probe sees 0 rows on user_roles. This usually means service_role does not have BYPASSRLS — informational only, the RPC sidesteps that. If you want service_role to see the table directly: ALTER ROLE service_role BYPASSRLS;';
  }
  return 'Auth env looks good and the SECURITY DEFINER RPC responds. If login still fails, check Supabase Auth user state (email_confirmed_at, last_sign_in_at) and Vercel function logs for [login] / [oauth-session] error codes.';
}
