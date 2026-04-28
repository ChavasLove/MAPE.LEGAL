/**
 * seed-super-admin.mjs
 *
 * Creates the primary admin account in Supabase and assigns the admin role.
 * Run once from the project root after env vars are set:
 *
 *   node scripts/seed-super-admin.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 * Safe to re-run — skips creation if the email already exists, only
 * upserts the role entry.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL    = 'cachivo@gmail.com';
const PASSWORD = 'jackjack';
const ROL      = 'admin';

async function run() {
  // Check if user already exists
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const existing = users.find(u => u.email === EMAIL);
  let userId;

  if (existing) {
    console.log(`[seed] User already exists (${existing.id}) — skipping auth creation`);
    userId = existing.id;
  } else {
    const { data: { user }, error: createErr } = await admin.auth.admin.createUser({
      email:          EMAIL,
      password:       PASSWORD,
      email_confirm:  true,
    });
    if (createErr || !user) throw createErr ?? new Error('Failed to create user');
    userId = user.id;
    console.log(`[seed] Created auth user ${userId}`);
  }

  // Upsert role — insert or update if already present
  const { error: roleErr } = await admin
    .from('user_roles')
    .upsert(
      { user_id: userId, rol: ROL, activo: true },
      { onConflict: 'user_id' }
    );

  if (roleErr) throw roleErr;

  console.log(`[seed] Role '${ROL}' assigned to ${EMAIL} — done.`);
}

run().catch(err => {
  console.error('[seed] Error:', err.message ?? err);
  process.exit(1);
});
