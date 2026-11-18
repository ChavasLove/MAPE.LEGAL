// /portal/lotes — lotes del productor (rol cliente): estado, eventos resumidos
// y SUS pagos del lote. El layout del portal ya exige rol cliente; la API
// filtra por el productor autenticado.

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { moduloCadenaDisponible } from '@/lib/cadena/disponibilidad';
import ModuloEnPreparacion from '@/components/cadena/ModuloEnPreparacion';
import PortalLotesClient from './PortalLotesClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortalLotesPage() {
  const [auth, modulo] = await Promise.all([getServerAuth(), moduloCadenaDisponible()]);
  if (!auth) redirect('/login');
  if (!modulo.disponible && modulo.motivo === 'migracion_pendiente') return <ModuloEnPreparacion />;
  return <PortalLotesClient />;
}
