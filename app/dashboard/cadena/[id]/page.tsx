// /dashboard/cadena/[id] — detalle de un lote: línea de tiempo encadenada por
// hash, registro de eventos, pagos del lote (nunca visibles para la planta),
// conciliación de pesos, alertas y, para la planta, acceso al expediente del
// productor solo con consentimiento informado vigente (lo decide la API).

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { moduloCadenaDisponible } from '@/lib/cadena/disponibilidad';
import ModuloEnPreparacion from '@/components/cadena/ModuloEnPreparacion';
import LoteDetalleClient from './LoteDetalleClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LoteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const [auth, modulo] = await Promise.all([getServerAuth(), moduloCadenaDisponible()]);
  if (!auth) redirect('/login');
  const { id } = await params;
  const role: string = auth.role;
  if (!modulo.disponible && modulo.motivo === 'migracion_pendiente') return <ModuloEnPreparacion />;
  return <LoteDetalleClient loteId={id} role={role} />;
}
