import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mape.legal";

const siteTitle =
  "MAPE LEGAL — Trazabilidad legal del oro de minería artesanal en Honduras";
const siteDescription =
  "Infraestructura de evidencia legal con la que Corporación Hondureña Tenka formaliza unidades mineras artesanales y emite certificados de origen verificables bajo la Ley de Minería de Honduras y la Guía de Debida Diligencia de la OCDE.";
const ogImage = "/images/RIVER AND MOUNTAINS.png";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1F2A38",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · MAPE LEGAL",
  },
  description: siteDescription,
  applicationName: "MAPE LEGAL",
  authors: [{ name: "Corporación Hondureña Tenka, S.A." }],
  keywords: [
    "MAPE",
    "minería artesanal",
    "Honduras",
    "certificado de origen",
    "INHGEOMIN",
    "SERNA",
    "OCDE debida diligencia",
    "oro trazable",
    "Convenio 169 OIT",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_HN",
    alternateLocale: "en_US",
    url: siteUrl,
    siteName: "MAPE LEGAL",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "MAPE LEGAL — territorio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description:
      "Infraestructura de evidencia legal de Corporación Hondureña Tenka.",
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
      className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
