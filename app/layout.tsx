import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CONTACTO, DOMICILIO_LINES, RAZON_SOCIAL } from "@/lib/content/copy-legal";

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
  "MAPE LEGAL — Legalización de permisos de pequeña minería de oro en Honduras";
const siteDescription =
  "Acompañamiento legal, ambiental y técnico para el permiso de pequeña minería ante INHGEOMIN: requisitos del expediente, licencia ambiental, certificado de origen del oro y comercialización formal en Honduras.";
const ogImage = "/images/RIVER AND MOUNTAINS.png";

/* JSON-LD Organization — datos institucionales de la operadora del sitio. */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: RAZON_SOCIAL,
  alternateName: ["MAPE LEGAL", "MAPE.LEGAL"],
  url: siteUrl,
  email: CONTACTO.email,
  telephone: CONTACTO.whatsapp,
  address: {
    "@type": "PostalAddress",
    streetAddress: `${DOMICILIO_LINES[0]}, ${DOMICILIO_LINES[1]}, ${DOMICILIO_LINES[2]}`,
    addressLocality: "Tegucigalpa",
    addressRegion: "Francisco Morazán",
    addressCountry: "HN",
  },
};

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
  authors: [{ name: "MAPE LEGAL" }],
  keywords: [
    "permiso de pequeña minería Honduras",
    "cómo legalizar una mina de oro en Honduras",
    "requisitos INHGEOMIN pequeña minería",
    "certificado de origen oro Honduras",
    "licencia ambiental minería Honduras",
    "pequeña minería",
    "minería artesanal",
    "INHGEOMIN",
    "MAPE",
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
      "Legalización de permisos de pequeña minería de oro en Honduras.",
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
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
