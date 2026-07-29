// /politica-de-precios — Política de Precios de MAPE.LEGAL, versionada.
//
// Documento estático institucional. La cláusula de revisión es TEXTO LEGAL
// — LITERAL (lib/content/copy-legal.ts, prohibido parafrasear). El método
// de determinación de ley renderiza la constante METODO_ENSAYE — con el
// valor actual la página muestra "PENDIENTE DE DEFINICIÓN", lo cual es
// correcto y deliberado: la página /precio no debe publicarse en
// producción sin ese dato definido (ver reporte del encargo 2026-07-29).

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  GRAMOS_POR_ONZA_TROY,
  METODO_ENSAYE,
  VERSION_POLITICA_PRECIOS,
  FECHA_VIGENCIA_POLITICA,
  FACTOR_COMERCIALIZACION_VIGENTE,
} from '@/lib/precio/calculo'
import {
  CITAS_LEGALES,
  PRECIO_REF_FORMULA,
  PRECIO_REF_CLAUSULA_REVISION,
  PRECIO_REF_REQUISITOS_TITULO,
  PRECIO_REF_REQUISITOS_ITEMS,
  PRECIO_REF_REQUISITOS_CIERRE,
  RAZON_SOCIAL,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Política de Precios',
  description:
    'Política de Precios de MAPE.LEGAL: fórmula de cálculo del precio de referencia, factor de comercialización vigente, cláusula de revisión, derecho de contramuestra y requisitos de elegibilidad del vendedor.',
  alternates: { canonical: '/politica-de-precios' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Política de Precios · MAPE.LEGAL',
    description:
      'Fórmula verificable, factor de comercialización publicado y cláusula de revisión del Precio de Referencia MAPE.LEGAL.',
    images: [{ url: '/images/RIVER AND MOUNTAINS.png', width: 1200, height: 630, alt: 'MAPE LEGAL — territorio' }],
  },
}

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(20px, 2.6vw, 26px)',
  fontWeight: 600,
  color: 'var(--ink)',
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
}

const BODY: React.CSSProperties = { fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 'clamp(16px, 3vw, 20px)',
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const VERSIONES: Array<{ version: string; vigencia: string; cambio: string }> = [
  { version: '1.0', vigencia: FECHA_VIGENCIA_POLITICA, cambio: 'Versión inicial.' },
]

export default function PoliticaDePreciosPage() {
  const factorPorcentaje = (FACTOR_COMERCIALIZACION_VIGENTE * 100).toLocaleString('es-HN', {
    maximumFractionDigits: 2,
  })

  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Política de Precios</div>
        <h1 className="section-title" style={{ maxWidth: 720 }}>
          Política de Precios de MAPE.LEGAL.
        </h1>
        <p
          style={{
            marginTop: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--slate)',
          }}
        >
          Versión {VERSION_POLITICA_PRECIOS} · Vigente desde el {fmtFechaLarga(FECHA_VIGENCIA_POLITICA)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 760, marginTop: 40 }}>
          {/* 1. Objeto y alcance */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>1. Objeto y alcance.</h2>
            <p style={BODY}>
              Esta política regula el cálculo, la publicación y la revisión del Precio de
              Referencia MAPE.LEGAL. Aplica a las operaciones de compraventa de oro de{' '}
              {RAZON_SOCIAL} (CHT).
            </p>
            <p style={BODY}>
              El precio de referencia se fija una vez al día, a las 08:00 horas (Honduras), y no
              varía durante la jornada. Se publica en{' '}
              <Link href="/precio" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/precio
              </Link>
              .
            </p>
          </section>

          {/* 2. Fórmula de cálculo */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>2. Fórmula de cálculo.</h2>
            <div style={CARD}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: 'var(--t1)',
                  background: 'var(--concrete)',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}
              >
                {PRECIO_REF_FORMULA}
              </p>
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Referencia LBMA:</strong> precio
                internacional del oro en dólares por onza troy, tomado como referencia por CHT al
                momento de la fijación. El valor usado cada día se publica junto al precio.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Constante de conversión:</strong> una onza
                troy equivale a {GRAMOS_POR_ONZA_TROY} gramos. Constante física, no configurable.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Factor de comercialización:</strong> el
                definido en la sección 3 de esta política.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Tipo de cambio:</strong> tipo de cambio de
                referencia publicado por el Banco Central de Honduras (BCH), capturado al momento
                de la fijación. El valor usado cada día se publica junto al precio.
              </li>
            </ul>
          </section>

          {/* 3. Factor de comercialización */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>3. Factor de comercialización.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 500 }}>
                Valor vigente: {FACTOR_COMERCIALIZACION_VIGENTE.toLocaleString('es-HN', { minimumFractionDigits: 2 })}{' '}
                ({factorPorcentaje}%).
              </p>
            </div>
            <p style={BODY}>
              La publicación del factor tiene por objeto permitir la verificación independiente
              del cálculo del precio de referencia por cualquier vendedor o tercero.
            </p>
          </section>

          {/* 4. Cláusula de revisión — TEXTO LEGAL LITERAL */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>4. Cláusula de revisión.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_CLAUSULA_REVISION}
              </p>
            </div>
          </section>

          {/* 5. Método de determinación de ley */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>5. Método de determinación de ley.</h2>
            <div style={CARD}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)' }}>
                Método declarado: {METODO_ENSAYE}
              </p>
            </div>
            <p style={BODY}>
              La ley del material se determina mediante el método declarado en esta sección,
              practicado en presencia del vendedor o de su representante. La declaración del
              método se publicará como una nueva versión de esta política.
            </p>
          </section>

          {/* 6. Derecho de contramuestra */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>6. Derecho de contramuestra.</h2>
            <p style={BODY}>
              En el acto de entrega, el vendedor o su representante puede solicitar una
              contramuestra del lote. La contramuestra se sella en presencia de ambas partes y
              queda bajo custodia de CHT por treinta (30) días calendario.
            </p>
            <p style={BODY}>
              Dentro de ese plazo, el vendedor puede pedir que la contramuestra sea analizada por
              un tercero dirimente acordado por escrito entre las partes. El resultado del tercero
              dirimente prevalece para la liquidación del lote.
            </p>
          </section>

          {/* 7. Requisitos de elegibilidad del vendedor */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>7. Requisitos de elegibilidad del vendedor.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7, fontWeight: 600, marginBottom: 10 }}>
                {PRECIO_REF_REQUISITOS_TITULO}
              </p>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 20, fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_REQUISITOS_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <p style={{ marginTop: 14, fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_REQUISITOS_CIERRE}
              </p>
            </div>
            <p style={BODY}>
              Fundamento: {CITAS_LEGALES.leyArt38.articulo}, {CITAS_LEGALES.leyArt38.norma} —{' '}
              {CITAS_LEGALES.leyArt38.sintesis}
            </p>
          </section>

          {/* 8. Deducciones */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>8. Deducciones.</h2>
            <p style={BODY}>
              El precio publicado es el precio aplicado. Cualquier deducción requiere autorización
              escrita, previa y revocable del vendedor. Toda deducción autorizada consta en el
              estado de cuenta de la transacción.
            </p>
          </section>

          {/* 9. Registro de versiones */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>9. Registro de versiones.</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead>
                  <tr>
                    {['Versión', 'Fecha de vigencia', 'Cambio introducido'].map((th) => (
                      <th
                        key={th}
                        scope="col"
                        style={{
                          background: 'var(--ink)',
                          color: '#fff',
                          textAlign: 'left',
                          padding: '10px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {th}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VERSIONES.map((v) => (
                    <tr key={v.version} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                        v{v.version}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {v.vigencia}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)' }}>
                        {v.cambio}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
              Las versiones anteriores permanecen accesibles públicamente conforme a la cláusula 4.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
