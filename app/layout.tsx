import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "MAPE LEGAL — Tu proceso minero, siempre visible",
  description:
    "Gestión legal de concesiones y exploraciones mineras con trazabilidad completa, alertas automáticas y comunicación directa por WhatsApp.",
  openGraph: {
    type: "website",
    locale: "es_HN",
    siteName: "MAPE LEGAL",
    title: "MAPE LEGAL — Tu proceso minero, siempre visible",
    description:
      "Gestión legal de concesiones y exploraciones mineras con trazabilidad completa, alertas automáticas y comunicación directa por WhatsApp.",
    images: [{ url: "/images/RIVER AND MOUNTAINS.png", width: 1200, height: 630, alt: "MAPE LEGAL" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MAPE LEGAL — Tu proceso minero, siempre visible",
    description:
      "Gestión legal de concesiones y exploraciones mineras con trazabilidad completa, alertas automáticas y comunicación directa por WhatsApp.",
    images: ["/images/RIVER AND MOUNTAINS.png"],
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
