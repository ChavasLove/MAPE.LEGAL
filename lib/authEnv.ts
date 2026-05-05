// Validates the Supabase env vars the auth flow depends on.
//
// Treats whitespace-only values and the `<project>` placeholder from
// `.env.example` as missing — those are the silent failure modes that
// produce "Configuración de servidor incompleta" in production despite
// the var appearing "set" in Vercel.

export type EnvStatus = 'ok' | 'missing' | 'placeholder';

export interface AuthEnvCheck {
  url:        EnvStatus;
  anonKey:    EnvStatus;
  serviceKey: EnvStatus;
  ok:         boolean;     // true only when url + anonKey are 'ok'
  missing:    string[];    // names of vars not in 'ok' state
}

const PLACEHOLDER_HINTS = ['<project>', '<your-', 'your-project', 'PASTE_'];

function classify(raw: string | undefined): EnvStatus {
  if (!raw) return 'missing';
  const v = raw.trim();
  if (!v) return 'missing';
  if (PLACEHOLDER_HINTS.some(h => v.includes(h))) return 'placeholder';
  return 'ok';
}

export function checkAuthEnv(): AuthEnvCheck {
  const url        = classify(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey    = classify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceKey = classify(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const missing: string[] = [];
  if (url        !== 'ok') missing.push(`NEXT_PUBLIC_SUPABASE_URL(${url})`);
  if (anonKey    !== 'ok') missing.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY(${anonKey})`);
  if (serviceKey !== 'ok') missing.push(`SUPABASE_SERVICE_ROLE_KEY(${serviceKey})`);

  return { url, anonKey, serviceKey, ok: url === 'ok' && anonKey === 'ok', missing };
}

// Logs to stderr (visible in Vercel function logs) so an operator can
// see exactly which var is broken without exposing values to the client.
export function logAuthEnvFailure(scope: string, check: AuthEnvCheck): void {
  console.error(
    `[${scope}] Auth env invalid — missing/placeholder: ${check.missing.join(', ')}`
  );
}
