import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

// Admin-only "who am I" endpoint. Validates the JWT and verifies the admin
// role against user_roles — never trusts cookies for role information.
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    id:    auth.user.id,
    email: auth.user.email,
    role:  auth.role,
  });
}
