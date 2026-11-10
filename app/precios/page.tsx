import type { Metadata } from 'next';
import PreciosClient from './PreciosClient';

export const metadata: Metadata = {
  title: 'Precio del oro en Honduras — actualizado diariamente',
  description:
    'Precio del oro actualizado diariamente, precio de referencia comercial de Inversiones Zekaii en lempiras por gramo de oro fino, tipo de cambio de referencia del BCH.',
  alternates: { canonical: '/precios' },
  openGraph: {
    title: 'Precio del oro · MAPE.LEGAL',
    description:
      'Precio del oro actualizado diariamente, precio de referencia comercial de Inversiones Zekaii en lempiras por gramo de oro fino, tipo de cambio de referencia del BCH.',
  },
};

export default function PreciosPage() {
  return <PreciosClient />;
}
