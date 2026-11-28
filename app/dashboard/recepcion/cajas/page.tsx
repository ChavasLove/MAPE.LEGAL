import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { puede } from '@/lib/acceso/personal';
import CajasClient from './CajasClient';

export const dynamic = 'force-dynamic';

// Solo personal con `recepcion:ver`. La API vuelve a exigir el rol y el
// alcance por punto en cada llamada.
export default async function Page() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?from=/dashboard/recepcion');
  if (!puede(auth.role, 'recepcion:ver')) redirect('/dashboard');
  return <CajasClient />;
}
