import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only: uses the service role key to bypass RLS for admin operations.
// Never expose this client or its key to the browser.
export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[Admin] Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your .env.local file.'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
