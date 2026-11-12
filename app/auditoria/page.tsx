// /auditoria — resumen de auditoría externa anual del estándar privado
// MAPE.LEGAL (Etapa 2, brief v2.1, 12-nov-2026). Server component ES-only.
//
// Paso 5 de la Guía OCDE: informar anualmente. Mientras no exista un informe
// real de un auditor externo designado, la página declara el vacío con el
// texto literal AUDITORIA_TEXTO_VACIO. No finge informe, no nombra auditor,
// no anticipa resultados.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  AUDITORIA_CICLO,
  AUDITORIA_RESUMEN_DISPONIBLE,
  AUDITORIA_TEXTO_VACIO,
  CANAL_CORRECCIONES,
  ESTANDAR_VERSION,
} from '@/lib/content/estandar'

export const metadata: Metadata = {
  title: 'Resumen de auditoría externa anual',
  description:
    'Resumen anual de la auditoría externa del estándar privado de debida diligencia MAPE.LEGAL. Se publica con versión y fecha cuando existe un informe real de un auditor externo designado.',
  alternates: { canonical: '/auditoria' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Resumen de auditoría externa anual · MAPE.LEGAL',
    description:
      'Ciclo anual de auditoría externa del estándar privado. Sin informe publicado todavía.',
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

const CONTENIDO_FUTURO = [
  'Versión y fecha del resumen, y versión del estándar auditada.',
  'Identidad del auditor externo designado.',
  'Alcance revisado: registro de fuentes, cadena de custodia, conciliación de pesos, pagos, consentimientos y bitácora.',
  'Hallazgos y medidas adoptadas, según el informe.',
] as const

export default function AuditoriaPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Auditoría externa</div>
        <h1 className="section-title" style={{ maxWidth: 760 }}>
          Resumen de auditoría externa anual.
        </h1>
        <p style={{ ...MONO, marginTop: 12 }}>
          Ciclo: {AUDITORIA_CICLO} · Informes publicados: {AUDITORIA_RESUMEN_DISPONIBLE ? '1 o más' : '0'} · Estándar
          v{ESTANDAR_VERSION}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 760, marginTop: 40 }}>
          {!AUDITORIA_RESUMEN_DISPONIBLE ? (
            <div role="status" style={{ ...CARD, background: 'var(--concrete)' }}>
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
                Sin informe publicado
              </div>
              <p style={{ fontSize: 15, color: 'var(--t1)', lineHeight: 1.7 }}>{AUDITORIA_TEXTO_VACIO}</p>
            </div>
          ) : null}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué publicará esta página.</h2>
            <p style={BODY}>
              El estándar privado prevé una auditoría externa con ciclo {AUDITORIA_CICLO} (sección
              11 del{' '}
              <Link href="/estandar" style={{ color: 'var(--moss)' }}>
                estándar
              </Link>
              ). Cuando exista un informe real, esta página publicará su resumen con:
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
              {CONTENIDO_FUTURO.map((item) => (
                <li key={item} style={BODY}>
                  {item}
                </li>
              ))}
            </ul>
            <p style={BODY}>
              Hasta entonces, la página declara el vacío. No se anticipan resultados ni se nombra a
              un auditor que no haya sido designado.
            </p>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Correcciones.</h2>
            <p style={BODY}>
              Señale cualquier error a{' '}
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
