import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal'
  ),
  title: {
    default: 'MAPE.LEGAL — Corporación Hondureña Tenka',
    template: '%s · MAPE.LEGAL',
  },
  description:
    'Transformamos la minería artesanal en oro trazable, certificado y premium. ' +
    'Acompañamiento legal continuo desde INHGEOMIN hasta los mercados éticos internacionales.',
  openGraph: {
    type:        'website',
    locale:      'es_HN',
    url:         '/',
    siteName:    'MAPE.LEGAL — Corporación Hondureña Tenka',
    title:       'MAPE.LEGAL — Formalización minera en Honduras',
    description:
      'Transformamos la minería artesanal en oro trazable, certificado y premium. ' +
      'ILO 169 · CRAFT · Fairmined · RJC · EUDR 2027.',
    images: [
      {
        url:    '/images/RIVER AND MOUNTAINS.png',
        width:  1200,
        height: 630,
        alt:    'Corredor aurífero hondureño — MAPE.LEGAL',
      },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'MAPE.LEGAL — Formalización minera en Honduras',
    description:
      'Acompañamiento legal continuo desde INHGEOMIN hasta los mercados éticos internacionales.',
    images:      ['/images/RIVER AND MOUNTAINS.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
