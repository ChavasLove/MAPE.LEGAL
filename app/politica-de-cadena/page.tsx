// /politica-de-cadena — política de cadena de suministro del estándar privado
// MAPE.LEGAL (Etapa 2, brief v2.1, 12-nov-2026). Server component ES-only.
//
// Publica versión, fecha y estado y la ESTRUCTURA de la política (compromisos
// del Anexo II de la Guía OCDE adoptados como política privada de la cadena)
// con el marcador de texto pendiente. No publica textos definitivos. Todo el
// contenido viene de lib/content/estandar.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  CADENA_DESCRIPCION_PUBLICA,
  CANAL_CORRECCIONES,
  ESTANDAR_AVISO_BORRADOR,
  POLITICA_CADENA_ESTADO,
  POLITICA_CADENA_FECHA,
  POLITICA_CADENA_SECCIONES,
  POLITICA_CADENA_VERSION,
  REFERENCIAS_DISENO_NOTA,
} from '@/lib/content/estandar'

export const metadata: Metadata = {
  title: 'Política de cadena de suministro',
  description:
    'Estructura y estado de la política de cadena de suministro del estándar privado MAPE.LEGAL: compromisos del Anexo II de la Guía OCDE adoptados como política privada. Borrador.',
  alternates: { canonical: '/politica-de-cadena' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Política de cadena de suministro · MAPE.LEGAL',
    description:
      'Compromisos de la cadena de suministro de la planta de beneficio participante, publicados como borrador con versión y fecha.',
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

function fmtFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PoliticaDeCadenaPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Política de cadena</div>
        <h1 className="section-title" style={{ maxWidth: 760 }}>
          Política de cadena de suministro.
        </h1>
        <p style={{ ...MONO, marginTop: 12 }}>
          Versión {POLITICA_CADENA_VERSION} · Fecha {fmtFechaLarga(POLITICA_CADENA_FECHA)} · Estado:{' '}
          {POLITICA_CADENA_ESTADO}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 800, marginTop: 40 }}>
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

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué regula esta política.</h2>
            <p style={BODY}>
              Los compromisos que asumen los actores de {CADENA_DESCRIPCION_PUBLICA} al adherirse
              al estándar privado MAPE.LEGAL. Sigue la estructura del Anexo II de la Guía de
              Debida Diligencia de la OCDE, adoptada como política privada de la cadena.{' '}
              {REFERENCIAS_DISENO_NOTA}
            </p>
            <p style={BODY}>
              La política forma parte del{' '}
              <Link href="/estandar" style={{ color: 'var(--moss)' }}>
                estándar
              </Link>{' '}
              y se versiona con él.
            </p>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Estructura de la política.</h2>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 0, listStyle: 'none' }}>
              {POLITICA_CADENA_SECCIONES.map((s) => (
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
                  <p style={{ ...MONO, fontSize: 12, marginTop: 8 }}>Texto: {s.texto}</p>
                </li>
              ))}
            </ol>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Correcciones.</h2>
            <p style={BODY}>
              Señale cualquier error a{' '}
              <a href={`mailto:${CANAL_CORRECCIONES}`} style={{ color: 'var(--moss)' }}>
                {CANAL_CORRECCIONES}
              </a>
              . Las versiones anteriores de la política permanecerán accesibles cuando exista
              una nueva.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
