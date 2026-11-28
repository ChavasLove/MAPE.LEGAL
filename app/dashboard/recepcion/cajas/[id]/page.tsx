import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { puede } from '@/lib/acceso/personal';
import CajaDetalleClient from './CajaDetalleClient';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?from=/dashboard/recepcion');
  if (!puede(auth.role, 'recepcion:ver')) redirect('/dashboard');
  const { id } = await params;
  return <CajaDetalleClient id={id} />;
}
