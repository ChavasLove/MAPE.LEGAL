// /dashboard/cadena/[id] — detalle de un lote: línea de tiempo encadenada por
// hash, registro de eventos, pagos del lote (nunca visibles para la planta),
// conciliación de pesos, alertas y, para la planta, acceso al expediente del
// productor solo con consentimiento informado vigente (lo decide la API).

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import LoteDetalleClient from './LoteDetalleClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LoteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');
  const { id } = await params;
  const role: string = auth.role;
  return <LoteDetalleClient loteId={id} role={role} />;
}
