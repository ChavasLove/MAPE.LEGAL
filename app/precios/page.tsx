import type { Metadata } from 'next';
import PreciosClient from './PreciosClient';

export const metadata: Metadata = {
  title: 'Precio del oro en Honduras — actualizado diariamente, solo informativo',
  description:
    'Precio internacional del oro actualizado diariamente, convertido a lempiras por gramo de oro fino con el tipo de cambio de compra del BCH, con fuente y fecha. Solo informativo: MAPE.LEGAL no compra ni vende oro.',
  alternates: { canonical: '/precios' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Precio del oro · MAPE.LEGAL',
    description:
      'Precio internacional del oro en lempiras por gramo de oro fino (tipo de cambio de compra del BCH), actualizado diariamente. Solo informativo: MAPE.LEGAL no compra ni vende oro.',
    images: [{ url: '/images/RIVER AND MOUNTAINS.png', width: 1200, height: 630, alt: 'MAPE LEGAL — territorio' }],
  },
};

export default function PreciosPage() {
  return <PreciosClient />;
}
