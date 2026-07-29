// /precio — Precio de Referencia MAPE.LEGAL.
//
// Registro institucional, no pieza comercial: publica el precio de
// referencia diario (fijado a las 08:00 hora de Honduras, fijo durante la
// jornada) y constituye evidencia documental de que CHT verifica el origen
// del mineral antes de comprar. Sin lenguaje de venta, sin CTAs
// comerciales, sin signos de exclamación.
//
// Server component ES-only. Todo el texto con consecuencia jurídica se
// importa de lib/content/copy-legal.ts (bloques TEXTO LEGAL — LITERAL del
// encargo 2026-07-29 — prohibido parafrasear). El orden de bloques 1–6 es
// obligatorio. R4: sin polling ni actualización automática — el dato se
// lee una vez por render del servidor.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  getPrecioReferenciaHoy,
  getHistorialVigente,
  type PrecioReferenciaRow,
} from '@/lib/precio/consulta'
import { VERSION_POLITICA_PRECIOS } from '@/lib/precio/calculo'
import {
  PRECIO_REF_FORMULA,
  factorVigenteNota,
  PRECIO_REF_APLICACION_ORO_FINO,
  PRECIO_REF_REQUISITOS_TITULO,
  PRECIO_REF_REQUISITOS_ITEMS,
  PRECIO_REF_REQUISITOS_CIERRE,
  PRECIO_REF_NATURALEZA_TITULO,
  PRECIO_REF_NATURALEZA,
} from '@/lib/content/copy-legal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Precio de Referencia — lempiras por gramo de oro fino',
  description:
    'Precio de Referencia MAPE.LEGAL en lempiras por gramo de oro fino, fijado una vez al día con fórmula verificable: referencia LBMA, tipo de cambio del BCH y factor de comercialización publicado.',
  alternates: { canonical: '/precio' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Precio de Referencia · MAPE.LEGAL',
    description:
      'Precio de referencia diario en lempiras por gramo de oro fino, con fórmula verificable y política de precios versionada.',
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

  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Precio de Referencia</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 56, maxWidth: 760 }}>
          {/* ── BLOQUE 1 — Encabezado ─────────────────────────────────── */}
          <section aria-labelledby="precio-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 id="precio-titulo" className="section-title" style={{ maxWidth: 720 }}>
              Precio de Referencia MAPE.LEGAL
            </h1>

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
                    L {fmtL(mostrado.precio_lempiras_gramo_fino)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--slate)' }}>
                    por gramo de oro fino
                  </span>
                </div>
                <p style={{ marginTop: 12, fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  Fijado el {fmtFechaLarga(mostrado.fecha)} a las 08:00 horas (Honduras). No varía
                  durante el día.
                </p>
                {!vigente && anterior && (
                  <p style={{ marginTop: 8, fontSize: 14, color: 'var(--slate)', lineHeight: 1.7 }}>
                    Último precio de referencia vigente, correspondiente al{' '}
                    {fmtFechaLarga(anterior.fecha)}. El precio de referencia de hoy (
                    {fmtFechaLarga(hoy)}) aún no ha sido fijado.
                  </p>
                )}
              </div>
            ) : (
              <div style={CARD}>
                <p style={BODY}>
                  Aún no se ha publicado un precio de referencia. La fórmula de cálculo y la
                  política que lo rigen se publican a continuación.
                </p>
              </div>
            )}
          </section>

          {/* ── BLOQUE 2 — Fórmula verificable ────────────────────────── */}
          <section aria-labelledby="formula-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="formula-titulo" style={SECTION_TITLE}>
              Fórmula verificable.
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
                  etiqueta="Referencia LBMA del día"
                  valor={mostrado ? `USD ${fmtL(mostrado.referencia_lbma_usd_oz)} por onza troy` : '—'}
                />
                <InsumoRow
                  etiqueta="Tipo de cambio de referencia del BCH"
                  valor={mostrado ? `L ${fmtL(mostrado.tipo_cambio_bch, 4)} por USD` : '—'}
                />
                <InsumoRow
                  etiqueta="Factor de comercialización"
                  valor={mostrado ? fmtL(mostrado.factor_comercializacion, 4) : '—'}
                  nota={factorVigenteNota(mostrado?.version_politica ?? VERSION_POLITICA_PRECIOS)}
                  last
                />
              </div>
            </div>
          </section>

          {/* ── BLOQUE 3 — Aplicación sobre oro fino (LITERAL) ────────── */}
          <section aria-labelledby="oro-fino-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="oro-fino-titulo" style={SECTION_TITLE}>
              Aplicación sobre oro fino.
            </h2>
            <div style={CARD}>
              <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRECIO_REF_APLICACION_ORO_FINO}
              </p>
            </div>
          </section>

          {/* ── BLOQUE 4 — Requisitos para vender a CHT (LITERAL) ─────── */}
          {/* Misma jerarquía visual que el precio: card destacada, no
              colapsable, en el cuerpo de la página — nunca en el pie. */}
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
            </div>
          </section>

          {/* ── BLOQUE 5 — Naturaleza jurídica (LITERAL) ──────────────── */}
          <section aria-labelledby="naturaleza-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="naturaleza-titulo" style={SECTION_TITLE}>
              {PRECIO_REF_NATURALEZA_TITULO}
            </h2>
            <div style={CARD}>
              <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                {PRECIO_REF_NATURALEZA}
              </p>
            </div>
          </section>

          {/* ── BLOQUE 6 — Enlaces ────────────────────────────────────── */}
          <section aria-label="Enlaces relacionados" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={MONO_EYEBROW}>Documentos relacionados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/politica-de-precios" style={{ color: 'var(--moss)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                Política de Precios vigente →
              </Link>
              <Link href="/verificar" style={{ color: 'var(--moss)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                Verificación de Certificados de Origen →
              </Link>
              <a href="#historico" style={{ color: 'var(--moss)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                Histórico de precios de referencia →
              </a>
            </div>
          </section>

          {/* ── Histórico (evidencia de auditoría) ────────────────────── */}
          <section id="historico" aria-labelledby="historico-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 id="historico-titulo" style={SECTION_TITLE}>
              Histórico de precios de referencia.
            </h2>
            {historial.length === 0 ? (
              <p style={BODY}>Sin registros publicados todavía.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      {['Fecha', 'L / gramo de oro fino', 'Referencia LBMA (USD/oz)', 'TC BCH', 'Factor', 'Política'].map((th) => (
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
                          L {fmtL(r.precio_lempiras_gramo_fino)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          {fmtL(r.referencia_lbma_usd_oz)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          {fmtL(r.tipo_cambio_bch, 4)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
                          {fmtL(r.factor_comercializacion, 4)}
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
              reemplazo.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
