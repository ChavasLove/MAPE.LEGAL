// /comercializacion — condiciones genéricas de la venta formal de oro (Fase
// 2C, Tarea 5; hotfix de neutralidad 11-nov-2026). MAPE.LEGAL no compra, no
// vende ni intermedia oro: esta página describe lo que la ley exige a
// cualquier comprador formal y publica el precio referencial informativo.
// Server component; el copy con consecuencia jurídica se importa desde
// lib/content/copy-legal.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import MariaWidget from '@/components/landing/MariaWidget'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  AVISO_PRECIO_REFERENCIAL,
  CERTIFICADO_ORIGEN_NOTA,
  CITAS_LEGALES,
  CONDICION_COMPRA,
  CONTACTO,
  FORMULA_PRECIO_REFERENCIAL,
  LIBERTAD_VENTA,
  POLITICA_PRECIO,
  RAZON_SOCIAL,
  REGISTRO_COMERCIALIZADOR,
  ROL_CHT,
} from '@/lib/content/copy-legal'
import { ROTULO_PRECIO_REFERENCIAL } from '@/lib/precio/factores'

export const metadata: Metadata = {
  title: 'Comercialización formal del oro — libertad de venta y certificado de origen',
  description:
    'Condiciones genéricas de la venta formal de oro de pequeña minería en Honduras: libertad de venta (Art. 37 LGM), verificación de origen a cargo del comprador (Art. 38 LGM), certificado de origen oficial por lote y precio referencial informativo. MAPE.LEGAL no compra ni vende oro.',
  alternates: { canonical: '/comercializacion' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Comercialización formal del oro · MAPE.LEGAL',
    description:
      'Libertad de venta, certificado de origen oficial por lote y precio referencial informativo. La verificación de origen es una obligación legal del comprador.',
    images: [{ url: '/images/RIVER AND MOUNTAINS.png', width: 1200, height: 630, alt: 'MAPE LEGAL — territorio' }],
  },
}

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(22px, 3vw, 28px)',
  fontWeight: 600,
  color: 'var(--ink)',
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
}

const BODY: React.CSSProperties = { fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 'clamp(20px, 4vw, 24px)',
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
}

/* Qué suele documentar una venta formal — descripción genérica, no un
   formato propio: la plataforma no liquida transacciones. */
const DOCUMENTACION_VENTA = [
  'Peso entregado y ley del material, determinada por el método que acuerden productor y comprador.',
  'Referencia internacional del oro y tipo de cambio aplicados a la transacción.',
  'Monto bruto, deducciones expresamente autorizadas por escrito (si las hay) y monto neto.',
  'Número del Certificado de Origen oficial del lote y, en su caso, del registro del sello complementario.',
] as const

export default function ComercializacionPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Comercialización</div>
        <h1 className="section-title" style={{ maxWidth: 780 }}>
          Cómo se vende oro de pequeña minería de forma legal.
        </h1>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          Estas son las condiciones que la ley hondureña impone a toda venta formal de oro.
          Se publican para que el operador las conozca antes de cualquier transacción.
          {' '}{RAZON_SOCIAL} {ROL_CHT} MAPE.LEGAL no compra, no vende ni intermedia oro.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 56, maxWidth: 760, marginTop: 48 }}>
          {/* LIBERTAD DE VENTA — prominente, no letra pequeña */}
          <div
            style={{
              ...CARD,
              background: 'color-mix(in oklch, var(--moss) 8%, white)',
              border: '1px solid color-mix(in oklch, var(--moss) 30%, white)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--moss)',
                marginBottom: 10,
              }}
            >
              Libertad de venta
            </div>
            <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 500 }}>
              {LIBERTAD_VENTA}
            </p>
          </div>

          {/* PRECIO REFERENCIAL INFORMATIVO */}
          <section id="precio" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>{ROTULO_PRECIO_REFERENCIAL}.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 500 }}>
                {POLITICA_PRECIO}
              </p>
              <p
                style={{
                  marginTop: 12,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: 'var(--t1)',
                  background: 'var(--concrete)',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}
              >
                {FORMULA_PRECIO_REFERENCIAL}
              </p>
              <p style={{ marginTop: 12, fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                {AVISO_PRECIO_REFERENCIAL}
              </p>
            </div>
            <p style={BODY}>
              El precio referencial del día, su fórmula y la política de publicación están en{' '}
              <Link href="/precio" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/precio
              </Link>
              . Sirve para que el productor compare la oferta que reciba de cualquier comprador.
            </p>
          </section>

          {/* QUÉ EXIGE LA LEY A TODO COMPRADOR */}
          <section id="condiciones" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Qué exige la ley a todo comprador.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 500 }}>
                {CONDICION_COMPRA}
              </p>
            </div>
            <p style={BODY}>
              La verificación de origen no es una política interna de nadie: es una
              obligación legal del comprador. El {CITAS_LEGALES.regArt34.articulo} del
              Reglamento Especial MAPE exige derecho minero vigente para comercializar
              producción, y el {CITAS_LEGALES.leyArt38.articulo} de la Ley General de
              Minería hace responsable solidario a quien compra sin verificar el origen.
              Por eso un comprador formal pide el documento oficial del titular antes de
              cerrar una transacción.
            </p>
            <p style={BODY}>{REGISTRO_COMERCIALIZADOR}</p>
            <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{CERTIFICADO_ORIGEN_NOTA}</p>
          </section>

          {/* QUÉ DOCUMENTA UNA VENTA FORMAL */}
          <section id="documentacion" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Qué documenta una venta formal.</h2>
            <p style={BODY}>
              Una venta formal deja constancia escrita entre productor y comprador. Lo
              habitual es que el documento recoja:
            </p>
            <div style={CARD}>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
                {DOCUMENTACION_VENTA.map((campo) => (
                  <li key={campo} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                    {campo}
                  </li>
                ))}
              </ul>
            </div>
            <p style={BODY}>
              Cualquier deducción sobre el pago del oro debe constar por escrito y con
              autorización expresa del productor. MAPE.LEGAL no liquida ni paga
              transacciones: no es parte de la venta.
            </p>
          </section>

          {/* CTA */}
          <section id="contacto-cta" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Antes de la primera venta.</h2>
            <p style={BODY}>
              Si su operación aún no tiene derecho minero vigente, la ruta empieza por el
              expediente de{' '}
              <Link href="/pequena-mineria" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                pequeña minería
              </Link>
              . Si ya lo tiene, escríbanos para ordenar la documentación de procedencia de
              sus lotes.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={CONTACTO.whatsappHref} className="btn-primary">
                WhatsApp {CONTACTO.whatsapp}
              </a>
              <a href={CONTACTO.emailHref} className="btn-ghost">
                {CONTACTO.email}
              </a>
            </div>
          </section>
        </div>
      </section>

      <SiteFooter />
      <MariaWidget lang="es" />
    </>
  )
}
