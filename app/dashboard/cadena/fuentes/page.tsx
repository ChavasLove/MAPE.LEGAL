// /dashboard/cadena/fuentes — fuentes del comercializador (origen de los
// lotes) con evaluación de elegibilidad. La planta no tiene acceso: solo ve
// sus lotes. La guardia con consecuencias vive en /api/cadena/fuentes.

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import { Forbidden } from '@/components/cadena/shared';
import FuentesClient from './FuentesClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERMITIDOS: ReadonlyArray<string> = ['admin', 'abogado', 'tecnico_ambiental', 'comercializador', 'auditor'];

export default async function FuentesPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');
  const role: string = auth.role;
  if (!PERMITIDOS.includes(role)) {
    return <Forbidden detalle="El registro de fuentes está reservado al comercializador, al auditor externo y al equipo de CHT." />;
  }
  return <FuentesClient role={role} />;
}
