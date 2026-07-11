import type { Metadata } from 'next';
import { searchEquipos, getCategoriaStats } from '@/services/equiposService';
import { EquiposCatalogClient } from './EquiposCatalogClient';
import type { EquipoFilters, EquipoSearchResult, CategoriaStat } from '@/lib/types/equipo';
import { CATEGORIA_LABELS, type EquipoCategoria } from '@/lib/types/equipo';

export const metadata: Metadata = {
  title: 'Equipo para Minería Artesanal de Oro',
  description:
    'Catálogo de equipos para lavado de oro, trommels, sluice boxes y maquinaria para minería artesanal y pequeña escala en Honduras.',
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    precio_min?: string;
    precio_max?: string;
  }>;
}

export const dynamic = 'force-dynamic';

function pickCategoria(v: string | undefined): EquipoCategoria | undefined {
  if (!v) return undefined;
  return v in CATEGORIA_LABELS ? (v as EquipoCategoria) : undefined;
}

function pickInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function EquiposPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const filters: EquipoFilters = {
    query:     params.q,
    categoria: pickCategoria(params.categoria),
    precioMin: pickInt(params.precio_min),
    precioMax: pickInt(params.precio_max),
  };

  // Degrade cleanly when migration 027 hasn't been applied yet — an empty
  // catalog beats a 500 on a public page (same philosophy as the onboarding
  // non-fatal catch in the María webhook).
  let equipos: EquipoSearchResult[] = [];
  let total = 0;
  let categorias: CategoriaStat[] = [];
  try {
    [{ equipos, total }, categorias] = await Promise.all([
      searchEquipos(filters, 50, 0),
      getCategoriaStats(),
    ]);
  } catch (err) {
    console.error('[equipos] non-fatal — catalog unavailable (migration 027 applied?):', err);
  }

  return (
    <EquiposCatalogClient
      equipos={equipos}
      total={total}
      categorias={categorias}
      initialFilters={filters}
    />
  );
}
