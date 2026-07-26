import type { Metadata } from 'next';
import PreciosClient from './PreciosClient';

export const metadata: Metadata = {
  title: 'Precios del oro, plata y diésel',
  description:
    'Precios en vivo del oro y la plata, precio de compra de oro de MAPE LEGAL en Lempiras, tipo de cambio USD/LPS y precio del diésel en Honduras. Para mineros artesanales y de pequeña escala.',
  alternates: { canonical: '/precios' },
  openGraph: {
    title: 'Precios del oro, plata y diésel · MAPE LEGAL',
    description:
      'Oro y plata en vivo, precio de compra MAPE LEGAL en Lempiras/gramo, tipo de cambio USD/LPS y diésel Honduras.',
  },
};

export default function PreciosPage() {
  return <PreciosClient />;
}
