// /dashboard/cadena/consentimientos — consentimientos informados del productor
// a favor de una organización (planta). Alta y revocación: admin/abogado. La
// planta y el auditor leen. El comercializador no tiene acceso.

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { Forbidden } from '@/components/cadena/shared';
import ConsentimientosClient from './ConsentimientosClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERMITIDOS: ReadonlyArray<string> = ['admin', 'abogado', 'tecnico_ambiental', 'planta', 'auditor'];

export default async function ConsentimientosPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');
  const role: string = auth.role;
  if (!PERMITIDOS.includes(role)) {
    return <Forbidden detalle="Los consentimientos informados los gestiona el equipo de CHT; la planta participante y el auditor externo los consultan." />;
  }
  const canWrite = role === 'admin' || role === 'abogado';
  return <ConsentimientosClient role={role} canWrite={canWrite} />;
}
