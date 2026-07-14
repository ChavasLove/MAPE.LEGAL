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

  // Degrade to 404 instead of a hard 500 when the RPC errors (migration 027
  // not applied, transient Supabase failure) — same public-surface philosophy
  // as the catalog page's non-fatal catch.
  let equipo = null;
  try {
    equipo = await getEquipoBySlug(slug);
  } catch (err) {
    console.error('[equipos/slug] non-fatal — detail unavailable (migration 027 applied?):', err);
  }

  if (!equipo) {
    notFound();
  }

  return <EquipoDetailClient equipo={equipo} />;
}
