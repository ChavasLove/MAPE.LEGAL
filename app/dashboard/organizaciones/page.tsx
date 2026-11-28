import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { puede } from '@/lib/acceso/personal';
import OrganizacionesClient from './OrganizacionesClient';

export const dynamic = 'force-dynamic';

export default async function OrganizacionesPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?from=/dashboard/organizaciones');
  if (!puede(auth.role, 'perfil:ver')) redirect('/dashboard');
  return <OrganizacionesClient />;
}
