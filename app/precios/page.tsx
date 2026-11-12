import type { Metadata } from 'next';
import PreciosClient from './PreciosClient';

export const metadata: Metadata = {
  title: 'Precio del oro en Honduras — actualizado diariamente',
  description:
    'Precio internacional del oro actualizado diariamente, precio referencial (75%) en lempiras por gramo de oro fino y tipo de cambio de referencia de mercado. Informativo: MAPE.LEGAL no compra ni vende oro.',
  alternates: { canonical: '/precios' },
  openGraph: {
    title: 'Precio del oro · MAPE.LEGAL',
    description:
      'Precio internacional del oro actualizado diariamente, precio referencial (75%) en lempiras por gramo de oro fino y tipo de cambio de referencia de mercado. Informativo: MAPE.LEGAL no compra ni vende oro.',
  },
};

export default function PreciosPage() {
  return <PreciosClient />;
}
