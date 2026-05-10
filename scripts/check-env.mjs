/**
 * check-env.mjs
 *
 * Validates that all required environment variables are set before deploy.
 * Run from project root:
 *
 *   node scripts/check-env.mjs
 *
 * Exits with code 1 if any required variable is missing.
 */

const REQUIRED = [
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // App
  'NEXT_PUBLIC_SITE_URL',
  // SendGrid
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
  'SENDGRID_FROM_NAME',
  // WhatsApp Meta
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_VERIFY_TOKEN',
  // Twilio (María bot)
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  // Anthropic (María bot)
  'ANTHROPIC_API_KEY',
];

const missing = REQUIRED.filter(key => !process.env[key]);

if (missing.length === 0) {
  console.log('[check-env] All required environment variables are set.');
  process.exit(0);
} else {
  console.error('[check-env] Missing required environment variables:');
  missing.forEach(key => console.error(`  ✗ ${key}`));
  console.error('\nCopy .env.example to .env.local and fill in the missing values.');
  process.exit(1);
}
