// /politica-de-precios — Política de publicación del precio informativo de la
// plataforma MAPE.LEGAL, versionada.
//
// DEC-2026-11-26-1 / DEC-2026-11-27-2: esta NO es la política de precios de
// un comprador. MAPE.LEGAL no compra, no vende ni intermedia oro ni administra
// fondos; publica el precio internacional del oro convertido a lempiras por
// gramo de oro fino con el tipo de cambio de COMPRA del BCH, SIN factor, una
// vez al día, con fórmula pública, fuente real y fecha, y siempre acompañado
// del aviso literal AVISO_PRECIO_INFORMATIVO. Las cláusulas del encargo
// 2026-07-29 (XRF, ensayo al fuego, contramuestra, laboratorio) describían la
// operación de un comprador y NO se renderizan.
//
// Las versiones anteriores (v1.1 de un modelo de comprador; borrador 1.2 del
// "precio referencial") se conservan como histórico en el registro de
// versiones, sin publicar sus factores numéricos.
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
  VERSION_POLITICA_BORRADOR_SUPERADO,
} from '@/lib/precio/calculo'
import {
  AVISO_PRECIO_INFORMATIVO,
  CONFLICTO_INTERES_CHT,
  DATO_NO_DISPONIBLE,
  ETIQUETA_TIPO_CAMBIO,
  FUENTE_TIPO_CAMBIO,
  PRECIO_REF_CARACTER_COMERCIAL,
  PRECIO_REF_CLAUSULA_REVISION,
  PRECIO_REF_FORMULA,
  RAZON_SOCIAL,
  ROTULO_PRECIO_INFORMATIVO,
} from '@/lib/content/copy-legal'

// Vigencia del borrador: FECHA_VIGENCIA_POLITICA vale "[CONFIRMAR]" mientras
// Willis no la fije (lib/precio/calculo.ts). No se formatea como fecha.
const VIGENCIA_BORRADOR = FECHA_VIGENCIA_POLITICA

export const metadata: Metadata = {
  title: 'Política de publicación del precio informativo del oro',
  description:
    'Cómo publica MAPE.LEGAL el precio del oro: precio internacional convertido a lempiras por gramo de oro fino con el tipo de cambio de compra del BCH, sin factor, una vez al día, con fuente y fecha. Solo informativo: no es una oferta de compra.',
  alternates: { canonical: '/politica-de-precios' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Política de publicación del precio informativo · MAPE.LEGAL',
    description:
      'Fórmula pública, insumos, cadencia y aviso del precio informativo del oro publicado por la plataforma. No es una oferta de compra.',
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
      'Borrador: precio solo informativo, sin ningún factor de compra. Precio internacional del oro ' +
      `convertido a lempiras por gramo de oro fino con el ${ETIQUETA_TIPO_CAMBIO.toLowerCase()} ` +
      `(${FUENTE_TIPO_CAMBIO}), con fuente real y fecha de cada insumo. Pendiente de revisión legal.`,
  },
  {
    version: VERSION_POLITICA_BORRADOR_SUPERADO,
    vigencia: 'No entró en vigencia',
    cambio:
      'Borrador superado: publicaba un precio referencial con un factor sobre la referencia internacional ' +
      'y un tipo de cambio de mercado no oficial. Retirado antes de entrar en vigencia.',
  },
  {
    version: VERSION_POLITICA_ANTERIOR,
    vigencia: FECHA_VIGENCIA_POLITICA_ANTERIOR,
    cambio:
      'Versión histórica de un modelo de comprador hoy retirado: aplicaba un factor de compra ' +
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
          Política de publicación del precio informativo.
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
              operadora {RAZON_SOCIAL}, calcula y publica el {ROTULO_PRECIO_INFORMATIVO.toLowerCase()}:
              el precio internacional del oro convertido a lempiras con el tipo de cambio de
              compra del Banco Central de Honduras (BCH), sin ningún factor de compra.
            </p>
            <p style={BODY}>
              El precio es solo informativo. No es una oferta de compra, ni un precio oficial, ni una
              garantía de pago. MAPE.LEGAL no compra, no vende ni intermedia oro y no administra
              fondos.{' '}
              {PRECIO_REF_CARACTER_COMERCIAL}
            </p>
          </section>

          {/* 2. Insumos */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>2. Insumos.</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Precio internacional del oro:</strong>{' '}
                precio del oro en dólares por onza troy, tomado de un proveedor de datos externo, capturado una vez al día
                (hoy goldapi.io, con respaldo de Yahoo Finance). La fuente real y la fecha y hora
                del dato se publican junto al precio. No es el precio oficial de la LBMA; la
                conexión a un precio LBMA oficial queda pendiente y se anunciará aquí cuando exista.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>{ETIQUETA_TIPO_CAMBIO}:</strong> lempiras
                por dólar según el tipo de cambio de compra que publica el {FUENTE_TIPO_CAMBIO}.
                Se muestra con su fecha de vigencia. Si el dato del BCH no está disponible, la
                plataforma muestra &laquo;{DATO_NO_DISPONIBLE}&raquo; y nunca sustituye el valor por
                otra fuente ni por una estimación.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Constante de conversión:</strong> una onza
                troy equivale a {GRAMOS_POR_ONZA_TROY} gramos. Constante física, no configurable.
              </li>
              <li style={BODY}>
                <strong style={{ color: 'var(--ink)' }}>Sin factor:</strong> el precio no aplica
                ningún porcentaje, descuento ni factor de compra sobre el precio internacional.
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
              El precio internacional por onza troy se multiplica por el tipo de cambio de compra
              del BCH y se divide entre {GRAMOS_POR_ONZA_TROY} para obtener el valor en lempiras
              por gramo de oro fino. La publicación de los insumos, con fuente y fecha, permite
              que cualquier productor o tercero verifique el cálculo.
            </p>
          </section>

          {/* 4. Cadencia */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>4. Cadencia.</h2>
            <p style={BODY}>
              El precio informativo se publica una vez al día, a las 08:00 horas (Honduras), y se
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
                {AVISO_PRECIO_INFORMATIVO}
              </p>
            </div>
            <p style={BODY}>
              Este aviso acompaña toda vista del precio informativo, su conversión por kilates,
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
              históricas del registro se muestran recalculadas con la fórmula pública vigente,
              sin factor; sus insumos originales (precio internacional y tipo de cambio) se
              conservan tal como se registraron.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
