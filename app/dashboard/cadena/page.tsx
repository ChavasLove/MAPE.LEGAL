// /dashboard/cadena — lotes de la cadena de custodia (estándar privado de
// debida diligencia, Etapa 2). El layout del dashboard ya exige sesión con rol
// de dashboard; esta página solo decide qué acciones mostrar según el rol. La
// guardia con consecuencias vive en /api/cadena/* (requireRole en el handler).

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import LotesClient from './LotesClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function CadenaLotesPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');
  const role: string = auth.role;
  return <LotesClient role={role} />;
}
