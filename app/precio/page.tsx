// /precio — Precio informativo del oro de la plataforma MAPE.LEGAL.
//
// Registro institucional, no pieza comercial: publica el precio informativo
// diario (fijado a las 08:00 hora de Honduras, fijo durante la jornada) y lo
// acompaña siempre del aviso literal AVISO_PRECIO_INFORMATIVO y de la fórmula
// pública con fuente y fecha. DEC-2026-11-26-1 / DEC-2026-11-27-2: sin factor
// de compra, con el tipo de cambio de COMPRA del BCH. Aquí no hay comprador,
// ni "precio de compra", ni requisitos "para vender a X" — solo lo que la ley
// exige a cualquier comprador formal. MAPE.LEGAL no compra, no vende ni
// intermedia oro ni administra fondos. Sin lenguaje de venta ni CTAs.
//
// Las filas de la BD son indelebles y guardan un factor registrado (columna
// NOT NULL de la migración 030) que NO se renderiza: el precio mostrado se
// recalcula en lectura con la fórmula pública (recalcularLpsGramoFino) o se
// declara "dato no disponible".
//
// Server component ES-only. Todo el texto con consecuencia jurídica se
// importa de lib/content/copy-legal.ts. R4: sin polling ni actualización
// automática — el dato se lee una vez por render del servidor.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  getPrecioReferenciaHoy,
  getHistorialVigente,
  recalcularLpsGramoFino,
  type PrecioReferenciaRow,
} from '@/lib/precio/consulta'
import { GRAMOS_POR_ONZA_TROY } from '@/lib/precio/calculo'
import {
  DATO_NO_DISPONIBLE,
  ETIQUETA_TIPO_CAMBIO,
  FUENTE_TIPO_CAMBIO,
  PRECIO_REF_FORMULA,
  ROTULO_PRECIO_INFORMATIVO,
  SOLO_INFORMATIVO,
  PRECIO_REF_APLICACION_ORO_FINO,
  PRECIO_REF_REQUISITOS_TITULO,
  PRECIO_REF_REQUISITOS_ITEMS,
  PRECIO_REF_REQUISITOS_CIERRE,
  PRECIO_REF_NATURALEZA_TITULO,
  PRECIO_REF_NATURALEZA,
  PRECIO_REF_REQUISITOS_NOTA_REGISTRO,
  PRECIO_REF_CARACTER_COMERCIAL,
} from '@/lib/content/copy-legal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Precio del oro en lempiras por gramo de oro fino — solo informativo',
  description:
    'Precio internacional del oro convertido a lempiras por gramo de oro fino con el tipo de cambio de compra del BCH, publicado una vez al día con fórmula pública, fuente y fecha. Solo informativo: MAPE.LEGAL no compra, no vende ni intermedia oro.',
  alternates: { canonical: '/precio' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Precio informativo del oro · MAPE.LEGAL',
    description:
      'Precio diario del oro en lempiras por gramo de oro fino (tipo de cambio de compra del BCH), con fórmula pública y aviso. No es una oferta de compra.',
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

const MONO_EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--slate)',
}

function fmtL(n: number, decimals = 2): string {
  return n.toLocaleString('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function InsumoRow({ etiqueta, valor, nota, last }: { etiqueta: string; valor: string; nota?: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{etiqueta}</span>
        {nota && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', lineHeight: 1.5, marginTop: 2, maxWidth: 460 }}>
            {nota}
          </span>
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--t1)', whiteSpace: 'nowrap' }}>
        {valor}
      </span>
    </div>
  )
}

export default async function PrecioReferenciaPage() {
  const { hoy, vigente, anterior } = await getPrecioReferenciaHoy()
  const historial = await getHistorialVigente(undefined, undefined, 30)

  // Registro que alimenta la fórmula del Bloque 2: el vigente de hoy o, en
  // su defecto, el último vigente anterior — siempre etiquetado con su fecha.
  const mostrado: PrecioReferenciaRow | null = vigente ?? anterior
  // Recalculado en lectura con la fórmula pública (sin factor); null = dato no disponible.
  const precioMostrado = mostrado ? recalcularLpsGramoFino(mostrado) : null

  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Precio informativo</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 56, maxWidth: 760 }}>
          {/* ── BLOQUE 1 — Encabezado ─────────────────────────────────── */}
          <section aria-labelledby="precio-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 id="precio-titulo" className="section-title" style={{ maxWidth: 720 }}>
              {ROTULO_PRECIO_INFORMATIVO}
            </h1>
            <p style={{ ...MONO_EYEBROW, color: 'var(--moss)' }}>{SOLO_INFORMATIVO}</p>
            <p style={BODY}>{PRECIO_REF_CARACTER_COMERCIAL}</p>

            {mostrado ? (
              <div
                style={{
                  ...CARD,
                  background: 'color-mix(in oklch, var(--moss) 7%, white)',
                  border: '1px solid color-mix(in oklch, var(--moss) 28%, white)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 'clamp(38px, 7vw, 56px)',
                      lineHeight: 1,
                      color: 'var(--earth)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {precioMostrado != null ? `L ${fmtL(precioMostrado)}` : DATO_NO_DISPONIBLE}
                  </span>
                  {precioMostrado != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--slate)' }}>
                      por gramo de oro fino · {SOLO_INFORMATIVO.toLowerCase()}
                    </span>
                  )}
                </div>
                <p style={{ marginTop: 12, fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  Fijado el {fmtFechaLarga(mostrado.fecha)} a las 08:00 horas (Honduras). No varía
                  durante el día.
                </p>
                {!vigente && anterior && (
                  <p style={{ marginTop: 8, fontSize: 14, color: 'var(--slate)', lineHeight: 1.7 }}>
                    Último precio informativo publicado, correspondiente al{' '}
                    {fmtFechaLarga(anterior.fecha)}. El precio informativo de hoy (
                    {fmtFechaLarga(hoy)}) aún no ha sido fijado.
                  </p>
                )}
              </div>
            ) : (
              <div style={CARD}>
                <p style={BODY}>
                  Aún no se ha publicado un precio informativo. La fórmula de cálculo y la
                  política que lo rigen se publican a continuación.
                </p>
              </div>
            )}
          </section>

          {/* ── BLOQUE 2 — Fórmula pública ────────────────────────────── */}
          <section aria-labelledby="formula-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="formula-titulo" style={SECTION_TITLE}>
              Fórmula pública.
            </h2>
            <div style={CARD}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: 'var(--t1)',
                  background: 'var(--concrete)',
                  borderRadius: 8,
                  padding: '14px 16px',
                }}
              >
                {PRECIO_REF_FORMULA}
              </p>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
                <InsumoRow
                  etiqueta="Precio internacional del oro del día"
                  valor={mostrado && mostrado.referencia_lbma_usd_oz > 0 ? `USD ${fmtL(mostrado.referencia_lbma_usd_oz)} por onza troy` : DATO_NO_DISPONIBLE}
                  nota={mostrado ? `Capturado en la fijación del ${fmtFechaLarga(mostrado.fecha)}, 08:00 horas (Honduras).` : undefined}
                />
                <InsumoRow
                  etiqueta={ETIQUETA_TIPO_CAMBIO}
                  valor={mostrado && mostrado.tipo_cambio_bch > 0 ? `L ${fmtL(mostrado.tipo_cambio_bch, 4)} por USD` : DATO_NO_DISPONIBLE}
                  nota={`Fuente: ${FUENTE_TIPO_CAMBIO}, tipo de cambio de compra vigente en la fecha de la fijación.`}
                />
                <InsumoRow
                  etiqueta="Constante de conversión"
                  valor={`1 onza troy = ${GRAMOS_POR_ONZA_TROY} g`}
                  nota="Constante física, no configurable. Sin ningún factor de compra."
                  last
                />
              </div>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
                El precio publicado es solo informativo y no aplica ningún porcentaje ni
                descuento sobre el precio internacional. Toda revisión de la fórmula o de las
                fuentes se publica como nueva versión de la política de publicación.
              </p>
            </div>
          </section>

          {/* ── BLOQUE 3 — Expresado sobre oro fino ───────────────────── */}
          <section aria-labelledby="oro-fino-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="oro-fino-titulo" style={SECTION_TITLE}>
              Expresado sobre oro fino.
            </h2>
            <div style={CARD}>
              <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_APLICACION_ORO_FINO}
              </p>
            </div>
          </section>

          {/* ── BLOQUE 4 — Qué suele pedir un comprador formal ─────────── */}
          {/* Misma jerarquía visual que el precio: card destacada, no
              colapsable, en el cuerpo de la página — nunca en el pie. Sin
              nombrar comprador alguno. */}
          <section aria-labelledby="requisitos-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="requisitos-titulo" style={SECTION_TITLE}>
              {PRECIO_REF_REQUISITOS_TITULO}
            </h2>
            <div
              style={{
                ...CARD,
                background: 'color-mix(in oklch, var(--moss) 7%, white)',
                border: '1px solid color-mix(in oklch, var(--moss) 28%, white)',
              }}
            >
              <ol
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  paddingLeft: 22,
                  fontSize: 16,
                  color: 'var(--ink)',
                  lineHeight: 1.7,
                  fontWeight: 500,
                }}
              >
                {PRECIO_REF_REQUISITOS_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <p style={{ marginTop: 16, fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_REQUISITOS_CIERRE}
              </p>
              <p style={{ marginTop: 12, fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                {PRECIO_REF_REQUISITOS_NOTA_REGISTRO}
              </p>
            </div>
          </section>

          {/* ── BLOQUE 5 — Naturaleza: el aviso literal del precio informativo ── */}
          <section aria-labelledby="naturaleza-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="naturaleza-titulo" style={SECTION_TITLE}>
              {PRECIO_REF_NATURALEZA_TITULO}
            </h2>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                {PRECIO_REF_NATURALEZA}
              </p>
              <p style={{ marginTop: 12, fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                {PRECIO_REF_CARACTER_COMERCIAL}
              </p>
            </div>
          </section>

          {/* ── BLOQUE 6 — Enlaces ────────────────────────────────────── */}
          <section aria-label="Enlaces relacionados" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={MONO_EYEBROW}>Documentos relacionados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/politica-de-precios" style={{ color: 'var(--moss)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                Política de publicación del precio informativo →
              </Link>
              <Link href="/verificar" style={{ color: 'var(--moss)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                Verificación del sello complementario →
              </Link>
              <a href="#historico" style={{ color: 'var(--moss)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                Histórico de precios informativos →
              </a>
            </div>
          </section>

          {/* ── Histórico (evidencia de auditoría) ────────────────────── */}
          <section id="historico" aria-labelledby="historico-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="historico-titulo" style={SECTION_TITLE}>
              Histórico de precios informativos.
            </h2>
            {historial.length === 0 ? (
              <p style={BODY}>Sin registros publicados todavía.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      {['Fecha', 'L / gramo de oro fino', 'Oro internacional (USD/oz)', ETIQUETA_TIPO_CAMBIO, 'Política'].map((th) => (
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
                    {historial.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {r.fecha}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          {(() => { const v = recalcularLpsGramoFino(r); return v != null ? `L ${fmtL(v)}` : DATO_NO_DISPONIBLE })()}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          {r.referencia_lbma_usd_oz > 0 ? fmtL(r.referencia_lbma_usd_oz) : DATO_NO_DISPONIBLE}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          {r.tipo_cambio_bch > 0 ? fmtL(r.tipo_cambio_bch, 4) : DATO_NO_DISPONIBLE}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          v{r.version_politica}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
              Registro histórico disponible también en formato de datos en /api/precio/historico.
              Los registros publicados no se eliminan; las correcciones se documentan por
              reemplazo. El precio de cada fila se recalcula con la fórmula pública vigente
              (precio internacional × tipo de cambio de compra del BCH ÷ {GRAMOS_POR_ONZA_TROY}),
              sin ningún factor.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
