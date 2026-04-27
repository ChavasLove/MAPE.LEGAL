import { redirect } from 'next/navigation';

// /admin/login is deprecated — all auth is handled by /login
export default function AdminLoginRedirect() {
  redirect('/login');
}
