// /comercializacion — condiciones publicadas de compraventa de oro (Fase 2C,
// Tarea 5). Es un instrumento de protección legal antes que comercial: se
// redacta como condiciones publicadas, no como oferta. Server component; el
// copy con consecuencia jurídica se importa desde lib/content/copy-legal.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import MariaWidget from '@/components/landing/MariaWidget'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  CITAS_LEGALES,
  CONDICION_COMPRA,
  CONTACTO,
  LIBERTAD_VENTA,
  POLITICA_PRECIO,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Condiciones de compra de oro — certificado de origen y pago bancarizado',
  description:
    'Condiciones publicadas de compraventa de oro de pequeña minería en Honduras: un solo precio de referencia actualizado diariamente, certificado de origen del oro por transacción y pago bancarizado en lempiras.',
  alternates: { canonical: '/comercializacion' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Condiciones de compra de oro · MAPE.LEGAL',
    description:
      'Precio publicado, certificado de origen por transacción y pago bancarizado. La verificación de origen es una obligación legal del comprador.',
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

/* Contenido del estado de cuenta por transacción. */
const ESTADO_CUENTA_CAMPOS = [
  'Peso entregado y ley del material.',
  'Referencia LBMA y tipo de cambio del BCH aplicados a la transacción.',
  'Monto bruto resultante.',
  'Deducciones expresamente autorizadas por escrito, si las hay.',
  'Monto neto depositado.',
  'Número del Certificado de Origen asociado a la transacción.',
] as const

export default function ComercializacionPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Comercialización</div>
        <h1 className="section-title" style={{ maxWidth: 780 }}>
          Condiciones publicadas de compra de oro.
        </h1>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          Estas son las condiciones bajo las que Corporación Hondureña Tenka, S.A.
          (CHT) compra oro de pequeña minería. Se publican para que el operador las
          conozca antes de cualquier transacción y para que cualquier tercero pueda
          verificarlas.
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

          {/* UN SOLO PRECIO PUBLICADO */}
          <section id="precio" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Un solo precio publicado.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 500 }}>
                {POLITICA_PRECIO}
              </p>
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
              <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                Sin comisión de intermediación adicional.
              </li>
              <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                Sin cargo por la emisión del Certificado de Origen.
              </li>
              <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                Sin descuento por servicio legal aplicado automáticamente al oro.
              </li>
            </ul>
            <p style={BODY}>
              El precio de referencia del día, su fórmula y la política que lo rige se publican
              en{' '}
              <Link href="/precio" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/precio
              </Link>
              .
            </p>
          </section>

          {/* CONDICIONES DE COMPRA */}
          <section id="condiciones" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Condiciones de compra.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 500 }}>
                {CONDICION_COMPRA}
              </p>
            </div>
            <p style={BODY}>
              La verificación de origen no es una política interna de CHT: es una
              obligación legal del comprador. El {CITAS_LEGALES.regArt34.articulo} del
              Reglamento Especial MAPE exige derecho minero vigente para comercializar
              producción, y el {CITAS_LEGALES.leyArt38.articulo} de la Ley General de
              Minería hace responsable solidario a quien compra sin verificar el origen.
              Por eso la exigencia existe, y por eso queda documentada en cada
              transacción.
            </p>
          </section>

          {/* PAGO */}
          <section id="pago" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Pago.</h2>
            <p style={BODY}>
              El pago se realiza por depósito en la cuenta minera del operador, el mismo
              día de la transacción, en lempiras, a través de una cooperativa financiera
              aliada. Requisito no negociable: Certificado de Origen válido por
              transacción.
            </p>
          </section>

          {/* ESTADO DE CUENTA POR TRANSACCIÓN */}
          <section id="estado-cuenta" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Estado de cuenta por transacción.</h2>
            <p style={BODY}>
              Cada compra queda documentada en un estado de cuenta entregado al operador,
              con este contenido:
            </p>
            <div style={CARD}>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
                {ESTADO_CUENTA_CAMPOS.map((campo) => (
                  <li key={campo} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                    {campo}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* DEDUCCIONES */}
          <section id="deducciones" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Deducciones.</h2>
            <p style={BODY}>
              No existe compensación automática de deuda contra el pago del oro. Cualquier
              deducción requiere autorización escrita del operador, revocable en cualquier
              momento y con un tope definido en la propia autorización.
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
              . Si ya lo tiene, escríbanos para coordinar la verificación documental.
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
