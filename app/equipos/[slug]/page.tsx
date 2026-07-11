import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEquipoBySlug } from '@/services/equiposService';
import { EquipoDetailClient } from './EquipoDetailClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let equipo = null;
  try {
    equipo = await getEquipoBySlug(slug);
  } catch {
    // handled by the page itself
  }

  if (!equipo) {
    return { title: 'Equipo no encontrado' };
  }

  return {
    title: `${equipo.nombre} — Equipo para Minería de Oro`,
    description: equipo.descripcion_corta || equipo.descripcion || undefined,
  };
}

export default async function EquipoDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const equipo = await getEquipoBySlug(slug);

  if (!equipo) {
    notFound();
  }

  return <EquipoDetailClient equipo={equipo} />;
}
