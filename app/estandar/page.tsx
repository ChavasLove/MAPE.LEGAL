// /estandar — estándar privado de debida diligencia MAPE.LEGAL (Etapa 2,
// brief v2.1, 12-nov-2026). Server component ES-only.
//
// Publica versión, fecha y estado; la ESTRUCTURA de las 12 secciones con el
// marcador de texto pendiente; el mapeo a los cinco pasos de la Guía OCDE; las
// referencias de diseño; y la nota del sello frente al documento oficial. No
// publica textos definitivos, umbrales, auditores ni resultados: no existen
// todavía. Todo el contenido viene de lib/content/estandar.ts y copy-legal.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import { CERTIFICADO_ORIGEN_NOTA, ESTANDAR_NATURALEZA } from '@/lib/content/copy-legal'
import {
  CANAL_CORRECCIONES,
  ESTANDAR_AVISO_BORRADOR,
  ESTANDAR_ESTADO,
  ESTANDAR_FECHA,
  ESTANDAR_PROPOSITO,
  ESTANDAR_SECCIONES,
  ESTANDAR_VERSION,
  MAPEO_OCDE,
  REFERENCIAS_DISENO,
  REFERENCIAS_DISENO_NOTA,
  SELLO_NOTA_ESTANDAR,
} from '@/lib/content/estandar'

export const metadata: Metadata = {
  title: 'Estándar privado de debida diligencia',
  description:
    'Estructura, versión y estado del estándar privado de debida diligencia MAPE.LEGAL para la cadena de suministro de la planta de beneficio participante. Borrador; sin aval de INHGEOMIN.',
  alternates: { canonical: '/estandar' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Estándar privado de debida diligencia · MAPE.LEGAL',
    description:
      'Doce secciones, mapeo a los cinco pasos de la Guía OCDE y referencias de diseño. Publicado como borrador con versión y fecha.',
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

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  color: 'var(--slate)',
}

const TH: React.CSSProperties = {
  background: 'var(--ink)',
  color: '#fff',
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EstandarPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Estándar privado</div>
        <h1 className="section-title" style={{ maxWidth: 760 }}>
          Cómo funciona el estándar privado de debida diligencia.
        </h1>
        <p style={{ ...MONO, marginTop: 12 }}>
          Versión {ESTANDAR_VERSION} · Fecha {fmtFechaLarga(ESTANDAR_FECHA)} · Estado: {ESTANDAR_ESTADO}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 800, marginTop: 40 }}>
          {/* Aviso de borrador — estado, no decoración */}
          <div
            role="note"
            style={{
              ...CARD,
              background: 'color-mix(in oklch, var(--amber) 10%, white)',
              border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--amber)',
                marginBottom: 8,
              }}
            >
              Borrador
            </div>
            <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{ESTANDAR_AVISO_BORRADOR}</p>
          </div>

          {/* Qué es */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué es y a quién aplica.</h2>
            <p style={BODY}>{ESTANDAR_PROPOSITO}</p>
            <p style={BODY}>{ESTANDAR_NATURALEZA}</p>
          </section>

          {/* Estructura */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Estructura del estándar.</h2>
            <p style={BODY}>
              Doce secciones. Cada una publica su alcance; el texto definitivo se incorporará
              con versión y fecha cuando esté aprobado.
            </p>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 0, listStyle: 'none' }}>
              {ESTANDAR_SECCIONES.map((s) => (
                <li key={s.numero} style={CARD}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ ...MONO, color: 'var(--earth)', fontWeight: 600 }}>
                      {String(s.numero).padStart(2, '0')}
                    </span>
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {s.titulo}
                    </h3>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, marginTop: 8 }}>{s.alcance}</p>
                  {s.fundamento ? (
                    <p style={{ ...MONO, fontSize: 12, marginTop: 8 }}>Fundamento: {s.fundamento}</p>
                  ) : null}
                  <p style={{ ...MONO, fontSize: 12, marginTop: 8 }}>Texto: {s.texto}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Mapeo OCDE */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Correspondencia con los cinco pasos de la Guía OCDE.</h2>
            <p style={BODY}>
              La Guía de Debida Diligencia de la OCDE ordena el proceso en cinco pasos. La tabla
              muestra qué módulo o control de la plataforma responde a cada uno.{' '}
              {REFERENCIAS_DISENO_NOTA}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr>
                    <th scope="col" style={TH}>Paso</th>
                    <th scope="col" style={TH}>Módulos y controles</th>
                  </tr>
                </thead>
                <tbody>
                  {MAPEO_OCDE.map((p) => (
                    <tr key={p.paso} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td
                        style={{
                          padding: '10px 14px',
                          fontSize: 13,
                          color: 'var(--t1)',
                          background: 'var(--bg)',
                          verticalAlign: 'top',
                          minWidth: 180,
                        }}
                      >
                        <span style={{ ...MONO, color: 'var(--earth)', fontWeight: 600 }}>{p.paso}</span>{' '}
                        {p.titulo}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', background: 'var(--bg)', lineHeight: 1.6 }}>
                        <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {p.modulos.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Referencias de diseño */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Referencias de diseño.</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
              {REFERENCIAS_DISENO.map((r) => (
                <li key={r.nombre} style={BODY}>
                  <strong style={{ color: 'var(--ink)' }}>{r.nombre}.</strong> {r.detalle}{' '}
                  <span style={{ color: 'var(--t3)' }}>{REFERENCIAS_DISENO_NOTA}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Sello y documento oficial */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Sello complementario y documento oficial.</h2>
            <p style={BODY}>{CERTIFICADO_ORIGEN_NOTA}</p>
            <p style={BODY}>{SELLO_NOTA_ESTANDAR}</p>
          </section>

          {/* Documentos relacionados */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Documentos relacionados.</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
              <li style={BODY}>
                <Link href="/politica-de-cadena" style={{ color: 'var(--moss)' }}>
                  Política de cadena de suministro
                </Link>{' '}
                — compromisos adoptados por la cadena (borrador).
              </li>
              <li style={BODY}>
                <Link href="/auditoria" style={{ color: 'var(--moss)' }}>
                  Resumen de auditoría externa anual
                </Link>{' '}
                — se publica cuando exista un informe real.
              </li>
              <li style={BODY}>
                <Link href="/quienes-somos" style={{ color: 'var(--moss)' }}>
                  Quiénes somos
                </Link>{' '}
                — titular, propósito y conflicto de interés.
              </li>
            </ul>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
              Correcciones:{' '}
              <a href={`mailto:${CANAL_CORRECCIONES}`} style={{ color: 'var(--moss)' }}>
                {CANAL_CORRECCIONES}
              </a>
              .
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
