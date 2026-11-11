// /dashboard/certificados — registro interno de Certificados de Origen.
//
// La plataforma MAPE.LEGAL NO emite el Certificado de Origen oficial: lo emite
// el titular del derecho minero y lo autentica la Autoridad Minera o Municipal
// (Art. 35 Regl. Especial MAPE; art. 43.e Regl. 042-2013). Aquí se REGISTRA y
// digitaliza ese documento y se asienta el sello complementario MAPE.LEGAL
// (voluntario: número de sello, folio, QR, hash) — migración 042.
//
// Server component: el layout del dashboard ya exige sesión con rol de
// dashboard; esta página solo decide si el rol puede ESCRIBIR (admin |
// abogado). La guardia con consecuencias vive en /api/certificados
// (requireRole dentro del handler).

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/serverAuth';
import CertificadosClient from './CertificadosClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function CertificadosPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');

  const canWrite = auth.role === 'admin' || auth.role === 'abogado';

  return <CertificadosClient canWrite={canWrite} />;
}
