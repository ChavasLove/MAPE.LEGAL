// /municipalidades — "Para municipalidades" (DEC-2026-11-26-1 / DEC-2026-11-27-2).
// El estándar MAPE.LEGAL es abierto y los municipios pueden adoptarlo. Tono de
// beneficio para el minero, la municipalidad y el Estado. Sin cifras
// inventadas, sin convenio con INHGEOMIN, sin prometer competencias de
// autoridad. El producto de adopción no está construido: se marca "en
// implementación". Server component ES-only; el copy con consecuencia jurídica
// se importa de lib/content/copy-legal.ts y lib/content/estandar.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  CERTIFICADO_ORIGEN_NOTA,
  CONTACTO,
  EN_IMPLEMENTACION,
  IDENTIDAD_FONDOS_TARIFAS,
  MUNICIPALIDADES_ADOPCION,
  MUNICIPALIDADES_BENEFICIOS,
  MUNICIPALIDADES_ESTADO_NOTA,
  MUNICIPALIDADES_INTRO,
  MUNICIPALIDADES_TITULO,
} from '@/lib/content/copy-legal'
import {
  ALINEACION_OCDE_LBMA,
  ESTANDAR_ESTADO,
  ESTANDAR_VERSION,
  REFERENCIAS_DISENO_NOTA,
} from '@/lib/content/estandar'

export const metadata: Metadata = {
  title: 'Para municipalidades — un estándar abierto de trazabilidad del oro',
  description:
    'El estándar MAPE.LEGAL es abierto: cualquier municipalidad puede adoptarlo como herramienta de trazabilidad del oro de la minería artesanal y de pequeña escala de su territorio. Sin convenio con INHGEOMIN; no sustituye competencias de autoridad. En implementación.',
  alternates: { canonical: '/municipalidades' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Para municipalidades · MAPE.LEGAL',
    description:
      'Un estándar abierto de trazabilidad del oro que los municipios pueden adoptar. Beneficio para el minero, la municipalidad y el Estado. En implementación.',
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

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--earth)',
  marginBottom: 8,
}

export default function MunicipalidadesPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Estándar abierto</div>
        <h1 className="section-title" style={{ maxWidth: 760 }}>
          {MUNICIPALIDADES_TITULO}.
        </h1>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          {MUNICIPALIDADES_INTRO}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 760, marginTop: 40 }}>
          {/* Estado honesto */}
          <div
            role="status"
            style={{
              ...CARD,
              background: 'color-mix(in oklch, var(--amber) 10%, white)',
              border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
            }}
          >
            <div style={{ ...EYEBROW, color: 'var(--amber)' }}>{EN_IMPLEMENTACION}</div>
            <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{MUNICIPALIDADES_ESTADO_NOTA}</p>
          </div>

          {/* A quién beneficia */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>A quién beneficia.</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {MUNICIPALIDADES_BENEFICIOS.map((b) => (
                <div key={b.actor} style={CARD}>
                  <div style={EYEBROW}>{b.actor}</div>
                  <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{b.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Qué implica adoptarlo */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué implica adoptar el estándar.</h2>
            <div style={CARD}>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
                {MUNICIPALIDADES_ADOPCION.map((item) => (
                  <li key={item} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p style={BODY}>{IDENTIDAD_FONDOS_TARIFAS}</p>
          </section>

          {/* Qué es el estándar */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué es el estándar.</h2>
            <p style={BODY}>
              Un estándar privado, voluntario y abierto de debida diligencia del origen y del
              mercado de destino del oro, {ALINEACION_OCDE_LBMA.toLowerCase()} como referencias de
              diseño. {REFERENCIAS_DISENO_NOTA} Se publica hoy como borrador (versión{' '}
              {ESTANDAR_VERSION}; {ESTANDAR_ESTADO.toLowerCase()}) en{' '}
              <Link href="/estandar" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                /estandar
              </Link>
              .
            </p>
            <p style={BODY}>{CERTIFICADO_ORIGEN_NOTA}</p>
          </section>

          {/* Contacto institucional */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Cómo iniciar la conversación.</h2>
            <p style={BODY}>
              Una municipalidad interesada puede escribir a{' '}
              <a href={CONTACTO.emailHref} style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                {CONTACTO.email}
              </a>
              . La respuesta describe el estado real del estándar y del procedimiento de
              adopción; no compromete plazos ni resultados.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
