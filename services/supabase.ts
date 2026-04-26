import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('[Supabase] Missing environment variables at runtime');
  }

  if (!_client) {
    _client = createClient(url, key);
  }

  return _client;
}

// Proxy defers client creation to first actual call.
// Prevents "supabaseUrl is required" crash during Next.js build
// when env vars are not present at module-import time.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function'
      ? (value as Function).bind(client)
      : value;
  },
});
