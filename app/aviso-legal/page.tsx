// /aviso-legal — notas legales completas del sitio (Fase 2C, Tarea 8).
// Server component. Todo el texto con consecuencia jurídica proviene de
// lib/content/copy-legal.ts — este archivo solo lo presenta.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  AVISO_NATURALEZA_INFORMATIVA,
  AVISO_PLATAFORMA,
  AVISO_PRECIO_REFERENCIAL,
  AVISO_RESOLUCIONES,
  CERTIFICADO_ORIGEN_NOTA,
  CITAS_LEGALES,
  CONFLICTO_INTERES_CHT,
  ESTANDAR_NATURALEZA,
  FORMULA_PRECIO_REFERENCIAL,
  LIBERTAD_VENTA,
  PIE_NOTA_LEGAL,
  RAZON_SOCIAL,
  ROL_TITULAR,
} from '@/lib/content/copy-legal'
import { ROTULO_PRECIO_REFERENCIAL } from '@/lib/precio/factores'

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

// Hotfix de neutralidad (11-nov-2026): sin "Condición de compra", sin
// "Registro de Comercializadores" y sin "Política de precio" — la plataforma
// no compra. El precio es referencial e informativo, con su aviso literal.
const NOTAS: Array<{ titulo: string; texto: string }> = [
  { titulo: 'Certificado de Origen y sello complementario', texto: CERTIFICADO_ORIGEN_NOTA },
  { titulo: 'Nota legal del sello MAPE.LEGAL', texto: PIE_NOTA_LEGAL },
  { titulo: ROTULO_PRECIO_REFERENCIAL, texto: `${FORMULA_PRECIO_REFERENCIAL}. ${AVISO_PRECIO_REFERENCIAL}` },
  { titulo: 'Libertad de venta', texto: LIBERTAD_VENTA },
  { titulo: 'Conflicto de interés', texto: CONFLICTO_INTERES_CHT },
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
              {RAZON_SOCIAL} (CHT) — {ROL_TITULAR.toLowerCase()} — desarrolla y opera la
              base de datos, lleva el sello complementario de trazabilidad y presta servicios
              legales y mineros a los productores. CHT no compra ni vende mineral. El sello no
              es un acto de INHGEOMIN y no sustituye el documento oficial de procedencia.
            </p>
            <p style={BODY}>{CONFLICTO_INTERES_CHT}</p>
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

          {/* Estándar privado de debida diligencia (Etapa 2, 2026-11-12) */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Estándar privado de debida diligencia.</h2>
            <p style={BODY}>{ESTANDAR_NATURALEZA}</p>
            <p style={BODY}>
              Estructura, versión y estado:{' '}
              <Link href="/estandar" style={{ color: 'var(--moss)' }}>
                /estandar
              </Link>
              . Compromisos de la cadena:{' '}
              <Link href="/politica-de-cadena" style={{ color: 'var(--moss)' }}>
                /politica-de-cadena
              </Link>
              .
            </p>
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
