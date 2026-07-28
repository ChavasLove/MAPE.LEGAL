import type { Metadata } from 'next';
import PreciosClient from './PreciosClient';

export const metadata: Metadata = {
  title: 'Precio del oro y del diésel en Honduras — actualizado diariamente',
  description:
    'Precio del oro actualizado diariamente, precio de compra de oro de MAPE.LEGAL en Lempiras por gramo, tipo de cambio oficial del BCH y precio del diésel en Honduras.',
  alternates: { canonical: '/precios' },
  openGraph: {
    title: 'Precio del oro y del diésel · MAPE.LEGAL',
    description:
      'Precio del oro actualizado diariamente, precio de compra en Lempiras/gramo, tipo de cambio BCH y diésel Honduras.',
  },
};

export default function PreciosPage() {
  return <PreciosClient />;
}
