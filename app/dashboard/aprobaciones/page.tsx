import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { puede } from '@/lib/acceso/personal';
import AprobacionesClient from './AprobacionesClient';

export const dynamic = 'force-dynamic';

// Cola de aprobaciones de perfiles. Solo personal con `perfil:ver`; la API
// vuelve a exigir el rol en cada llamada.
export default async function AprobacionesPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?from=/dashboard/aprobaciones');
  if (!puede(auth.role, 'perfil:ver')) redirect('/dashboard');
  return <AprobacionesClient />;
}
