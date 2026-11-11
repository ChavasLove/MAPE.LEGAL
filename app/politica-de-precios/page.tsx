// /politica-de-precios — Política de publicación del precio referencial de la
// plataforma MAPE.LEGAL, versionada.
//
// Hotfix de neutralidad (11-nov-2026): esta ya NO es la política de precios de
// un comprador. MAPE.LEGAL no compra, no vende ni intermedia oro; publica un
// precio REFERENCIAL estimado al 75 % de la referencia internacional del oro,
// en lempiras por gramo de oro fino, una vez al día, con fórmula pública,
// fuente y fecha, y siempre acompañado del aviso literal
// AVISO_PRECIO_REFERENCIAL. Las cláusulas 5 y 6 del encargo 2026-07-29 (XRF,
// ensayo al fuego, contramuestra), el Anexo I de laboratorio y las
// verificaciones externas describían la operación de un comprador y NO se
// renderizan (quedan @deprecated en lib/content/copy-legal.ts).
//
// v1.1 (2026-07-29) se conserva como histórico en el registro de versiones:
// aplicaba un factor 0,80 bajo un modelo de comprador hoy retirado.
//
// Server component ES-only. El texto con consecuencia jurídica se importa de
// lib/content/copy-legal.ts; las constantes numéricas, de lib/precio/*.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  GRAMOS_POR_ONZA_TROY,
  VERSION_POLITICA_PRECIOS,
  FECHA_VIGENCIA_POLITICA,
  VERSION_POLITICA_ANTERIOR,
  FECHA_VIGENCIA_POLITICA_ANTERIOR,
  FACTOR_POLITICA_ANTERIOR,
} from '@/lib/precio/calculo'
import { FACTOR_REFERENCIA, FACTOR_REFERENCIA_PCT, ROTULO_PRECIO_REFERENCIAL } from '@/lib/precio/factores'
import {
  AVISO_PRECIO_REFERENCIAL,
  CONFLICTO_INTERES_CHT,
  ETIQUETA_TIPO_CAMBIO,
  FUENTE_TIPO_CAMBIO,
  PRECIO_REF_CARACTER_COMERCIAL,
  PRECIO_REF_CLAUSULA_REVISION,
  PRECIO_REF_FORMULA,
  RAZON_SOCIAL,
} from '@/lib/content/copy-legal'

// Vigencia del borrador: FECHA_VIGENCIA_POLITICA vale "[CONFIRMAR]" mientras
// Willis no la fije (lib/precio/calculo.ts). No se formatea como fecha.
const VIGENCIA_BORRADOR = FECHA_VIGENCIA_POLITICA

export const metadata: Metadata = {
  title: 'Política de publicación del precio referencial',
  description:
    'Cómo publica MAPE.LEGAL su precio referencial del oro: 75 % de la referencia internacional, convertido a lempiras con un tipo de cambio de referencia de mercado, por gramo de oro fino, una vez al día. Informativo: no es una oferta de compra.',
  alternates: { canonical: '/politica-de-precios' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Política de publicación del precio referencial · MAPE.LEGAL',
    description:
      'Fórmula pública, insumos, cadencia y aviso del precio referencial (75%) del oro publicado por la plataforma. No es una oferta de compra.',
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
  {
    version: VERSION_POLITICA_PRECIOS,
    vigencia: VIGENCIA_BORRADOR,
    cambio:
      `Borrador: la política pasa a ser de publicación de un precio referencial informativo de la plataforma, ` +
      `al ${FACTOR_REFERENCIA_PCT} % de la referencia internacional del oro, con tipo de cambio de referencia de mercado ` +
      `(${FUENTE_TIPO_CAMBIO}). Se retiran las cláusulas de liquidación y contramuestra. Pendiente de revisión legal.`,
  },
  {
    version: VERSION_POLITICA_ANTERIOR,
    vigencia: FECHA_VIGENCIA_POLITICA_ANTERIOR,
    cambio:
      `Versión histórica de un modelo de comprador hoy retirado: factor ${FACTOR_POLITICA_ANTERIOR.toLocaleString('es-HN', { minimumFractionDigits: 2 })} ` +
      'y cláusulas de determinación de ley y liquidación. Accesible como versión anterior.',
  },
  { version: '1.0', vigencia: '2026-07-29', cambio: 'Versión inicial.' },
]

export default function PoliticaDePreciosPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Política de publicación</div>
        <h1 className="section-title" style={{ maxWidth: 720 }}>
          Política de publicación del precio referencial.
        </h1>
        <p
          style={{
            marginTop: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--slate)',
          }}
        >
          Versión {VERSION_POLITICA_PRECIOS} · Vigencia: {VIGENCIA_BORRADOR} · Versión anterior v
          {VERSION_POLITICA_ANTERIOR}, vigente desde el {fmtFechaLarga(FECHA_VIGENCIA_POLITICA_ANTERIOR)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 760, marginTop: 40 }}>
          {/* 1. Objeto */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>1. Objeto.</h2>
            <p style={BODY}>
              Esta política regula cómo la plataforma MAPE.LEGAL, de la que es titular y
              operadora {RAZON_SOCIAL}, calcula y publica su {ROTULO_PRECIO_REFERENCIAL.toLowerCase()}:
              un precio referencial estimado al {FACTOR_REFERENCIA_PCT} % de la referencia
              internacional del oro, expresado en lempiras por gramo de oro fino.
            </p>
            <p style={BODY}>
              El precio es informativo. No es una oferta de compra, ni un precio oficial, ni una
              garantía de pago. MAPE.LEGAL no compra, no vende ni intermedia oro.{' '}
              {PRECIO_REF_CARACTER_COMERCIAL}
            </p>
          </section>

          {/* 2. Insumos */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>2. Insumos.</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Referencia internacional del oro:</strong>{' '}
                precio internacional del oro en dólares por onza troy, tomado del proveedor de
                datos de la plataforma al momento de la captura. La fuente y el valor usados
                cada día se publican junto al precio.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>{ETIQUETA_TIPO_CAMBIO}:</strong> lempiras
                por dólar, tomado de {FUENTE_TIPO_CAMBIO} al momento de la captura. La fecha y
                hora de captura se publican junto al precio. No es un tipo de cambio oficial.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Constante de conversión:</strong> una onza
                troy equivale a {GRAMOS_POR_ONZA_TROY} gramos. Constante física, no configurable.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Factor referencial:</strong>{' '}
                {FACTOR_REFERENCIA.toLocaleString('es-HN', { minimumFractionDigits: 2 })} ({FACTOR_REFERENCIA_PCT} %).
                Fijo y público; solo cambia con una nueva versión de esta política.
              </li>
            </ul>
          </section>

          {/* 3. Fórmula pública */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>3. Fórmula pública.</h2>
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
            <p style={BODY}>
              El precio internacional por onza troy se divide entre {GRAMOS_POR_ONZA_TROY} para
              obtener el valor por gramo de oro fino. La publicación del factor y de los insumos
              permite que cualquier productor o tercero verifique el cálculo.
            </p>
          </section>

          {/* 4. Cadencia */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>4. Cadencia.</h2>
            <p style={BODY}>
              El precio referencial se publica una vez al día, a las 08:00 horas (Honduras), y se
              mantiene fijo durante la jornada: se actualiza diariamente, no de forma continua. Se publica en{' '}
              <Link href="/precio" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/precio
              </Link>{' '}
              y en{' '}
              <Link href="/precios" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/precios
              </Link>
              , junto con la fuente y la fecha de cada insumo.
            </p>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_CLAUSULA_REVISION}
              </p>
            </div>
          </section>

          {/* 5. Aviso */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>5. Aviso.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {AVISO_PRECIO_REFERENCIAL}
              </p>
            </div>
            <p style={BODY}>
              Este aviso acompaña toda vista del precio referencial, su calculadora por kilates,
              el boletín diario y cualquier cotización de la asistente virtual.
            </p>
          </section>

          {/* 6. Conflicto de interés */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>6. Conflicto de interés.</h2>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {CONFLICTO_INTERES_CHT}
              </p>
            </div>
          </section>

          {/* 7. Registro de versiones */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>7. Registro de versiones.</h2>
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
              Las versiones anteriores permanecen accesibles públicamente. Las fijaciones
              históricas del registro muestran el factor registrado en cada fecha, no el vigente.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
