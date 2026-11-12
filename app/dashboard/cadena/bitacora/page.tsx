// /dashboard/cadena/bitacora — bitácora de accesos (lecturas y exportaciones)
// del estándar privado. Solo admin y auditor externo.

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { Forbidden } from '@/components/cadena/shared';
import BitacoraClient from './BitacoraClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function BitacoraPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');
  const role: string = auth.role;
  if (role !== 'admin' && role !== 'auditor') {
    return <Forbidden detalle="La bitácora de accesos está reservada a la administración y al auditor externo." />;
  }
  return <BitacoraClient />;
}
