// /aviso-legal — notas legales completas del sitio (Fase 2C, Tarea 8).
// Server component. Todo el texto con consecuencia jurídica proviene de
// lib/content/copy-legal.ts — este archivo solo lo presenta.

import type { Metadata } from 'next'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  AVISO_NATURALEZA_INFORMATIVA,
  AVISO_PLATAFORMA,
  AVISO_RESOLUCIONES,
  CERTIFICADO_ORIGEN_NOTA,
  CITAS_LEGALES,
  CONDICION_COMPRA,
  LIBERTAD_VENTA,
  POLITICA_PRECIO,
  RAZON_SOCIAL,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Aviso legal',
  description:
    'Naturaleza informativa del contenido de mape.legal, notas legales completas y fundamento normativo: Ley General de Minería y Reglamento Especial MAPE de Honduras.',
  alternates: { canonical: '/aviso-legal' },
  robots: { index: true, follow: true },
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

const NOTAS: Array<{ titulo: string; texto: string }> = [
  { titulo: 'Certificado de Origen', texto: CERTIFICADO_ORIGEN_NOTA },
  { titulo: 'Condición de compra', texto: CONDICION_COMPRA },
  { titulo: 'Política de precio', texto: POLITICA_PRECIO },
  { titulo: 'Libertad de venta', texto: LIBERTAD_VENTA },
  { titulo: 'Resoluciones de la Autoridad Minera', texto: AVISO_RESOLUCIONES },
]

export default function AvisoLegalPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Aviso legal</div>
        <h1 className="section-title" style={{ maxWidth: 720 }}>
          Notas legales de mape.legal.
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 760, marginTop: 40 }}>
          {/* Naturaleza informativa */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Naturaleza del contenido.</h2>
            <p style={BODY}>{AVISO_NATURALEZA_INFORMATIVA}</p>
            <p style={BODY}>{AVISO_PLATAFORMA}</p>
            <p style={BODY}>
              Para asesoría sobre un caso concreto, {RAZON_SOCIAL} atiende por los canales
              de contacto publicados en este sitio, previa evaluación del caso y acuerdo
              expreso de representación.
            </p>
          </section>

          {/* Notas legales completas */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Notas legales completas.</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {NOTAS.map((nota) => (
                <div
                  key={nota.titulo}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 'clamp(16px, 3vw, 20px)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--earth)',
                      marginBottom: 8,
                    }}
                  >
                    {nota.titulo}
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{nota.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Fundamento normativo */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Fundamento normativo citado en este sitio.</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr>
                    {['Norma', 'Artículo', 'Síntesis'].map((th) => (
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
                        }}
                      >
                        {th}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CITAS_LEGALES).map(([key, cita]) => (
                    <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)' }}>
                        {cita.norma}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {cita.articulo}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', lineHeight: 1.6 }}>
                        {cita.sintesis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
              Las síntesis son orientativas. El texto aplicable es el publicado en La
              Gaceta, Diario Oficial de la República de Honduras.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
