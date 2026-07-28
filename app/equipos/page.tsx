import type { Metadata } from 'next';
import { getEquiposVitrina } from '@/services/equiposService';
import { EquiposShowcase } from './EquiposShowcase';
import type { EquipoMercado } from '@/lib/types/equipo';

export const metadata: Metadata = {
  title: 'Equipos en Venta — Maquinaria para Minería Artesanal',
  description:
    'Vitrina de equipos para lavado de oro importados por MAPE LEGAL: plantas de lavado, trommels y maquinaria verificada con precio CIF Honduras.',
};

export const dynamic = 'force-dynamic';

// La vitrina muestra el inventario real (máx. 3 equipos activos, cap
// enforced en el admin) — sin buscador ni filtros: a esta escala cada
// equipo se presenta completo.
export default async function EquiposPage() {
  // Degrade cleanly when migration 027 hasn't been applied yet — an empty
  // showcase beats a 500 on a public page (same philosophy as the onboarding
  // non-fatal catch in the María webhook).
  let equipos: EquipoMercado[] = [];
  try {
    equipos = await getEquiposVitrina(3);
  } catch (err) {
    console.error('[equipos] non-fatal — vitrina unavailable (migration 027 applied?):', err);
  }

  return <EquiposShowcase equipos={equipos} />;
}
