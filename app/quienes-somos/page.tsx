// /quienes-somos — identidad institucional (Etapa 2, brief v2.1, 12-nov-2026).
// Server component ES-only. Corporación Hondureña Tenka, S.A. (CHT) es
// desarrolladora y titular de la plataforma y del estándar privado de debida
// diligencia; no compra ni vende mineral. Ningún comprador se nombra. Todo el
// texto con consecuencia jurídica proviene de lib/content/copy-legal.ts y
// lib/content/estandar.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  AVISO_PLATAFORMA,
  CONFLICTO_INTERES_CHT,
  CONTACTO,
  ESTANDAR_NATURALEZA,
  RAZON_SOCIAL,
  ROL_CHT,
} from '@/lib/content/copy-legal'
import {
  CADENA_DESCRIPCION_PUBLICA,
  CANAL_CORRECCIONES,
  ESTANDAR_ESTADO,
  ESTANDAR_VERSION,
} from '@/lib/content/estandar'

export const metadata: Metadata = {
  title: 'Quiénes somos',
  description:
    'Corporación Hondureña Tenka, S.A. (CHT) desarrolla y es titular de la plataforma MAPE.LEGAL y de su estándar privado de debida diligencia. CHT no compra ni vende mineral.',
  alternates: { canonical: '/quienes-somos' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Quiénes somos · MAPE.LEGAL',
    description:
      'Quién desarrolla y es titular de la plataforma y del estándar privado de debida diligencia, qué hace y qué no, y cómo señalar una corrección.',
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

const QUE_HACE = [
  'Desarrolla y mantiene la plataforma MAPE.LEGAL y su estándar privado de debida diligencia.',
  'Lleva el registro de fuentes y la cadena de custodia por lote, con eventos encadenados por hash.',
  'Presta servicios legales y mineros a los productores artesanales y de pequeña minería.',
  'Publica la estructura del estándar, la política de cadena y el resumen de auditoría cuando exista.',
] as const

const QUE_NO_HACE = [
  'No compra, no vende ni intermedia oro.',
  'No es autoridad: no otorga permisos ni autentica certificados de origen.',
  'No cuenta con aval, certificación ni convenio de INHGEOMIN, SERNA, el BCH ni ningún organismo.',
  'No garantiza el resultado de ningún trámite ante la Autoridad Minera.',
] as const

export default function QuienesSomosPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Quiénes somos</div>
        <h1 className="section-title" style={{ maxWidth: 760 }}>
          Quién está detrás de MAPE.LEGAL.
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 760, marginTop: 40 }}>
          {/* Identidad */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Una sola titular.</h2>
            <p style={BODY}>
              {RAZON_SOCIAL} (CHT) {ROL_CHT}
            </p>
            <p style={BODY}>
              CHT desarrolla y es titular del estándar privado de debida diligencia MAPE.LEGAL.
              El estándar se publica hoy como borrador (versión {ESTANDAR_VERSION}; {ESTANDAR_ESTADO.toLowerCase()}).
            </p>
            <p style={BODY}>{AVISO_PLATAFORMA}</p>
          </section>

          {/* Propósito */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Para qué existe la plataforma.</h2>
            <p style={BODY}>
              La plataforma sirve a la debida diligencia privada de {CADENA_DESCRIPCION_PUBLICA}.
              Registra las fuentes del mineral, la custodia de cada lote, los pagos bancarios y
              los consentimientos de acceso al expediente. Así, un lote de oro llega a la planta
              con su origen documentado y verificable.
            </p>
            <p style={BODY}>{ESTANDAR_NATURALEZA}</p>
            <p style={BODY}>
              Estructura, versión y mapeo del estándar:{' '}
              <Link href="/estandar" style={{ color: 'var(--moss)' }}>
                /estandar
              </Link>
              .
            </p>
          </section>

          {/* Qué hace y qué no */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué hace CHT y qué no.</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div style={CARD}>
                <div style={EYEBROW}>Hace</div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
                  {QUE_HACE.map((item) => (
                    <li key={item} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={CARD}>
                <div style={EYEBROW}>No hace</div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
                  {QUE_NO_HACE.map((item) => (
                    <li key={item} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Conflicto de interés — texto literal */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Declaración de conflicto de interés.</h2>
            <div
              style={{
                ...CARD,
                background: 'var(--concrete)',
              }}
            >
              <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{CONFLICTO_INTERES_CHT}</p>
            </div>
          </section>

          {/* Correcciones */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Cómo señalar una corrección.</h2>
            <p style={BODY}>
              Cualquier persona puede señalar un error en el contenido de este sitio o en un
              registro público del sello. Escriba a{' '}
              <a href={`mailto:${CANAL_CORRECCIONES}`} style={{ color: 'var(--moss)' }}>
                {CANAL_CORRECCIONES}
              </a>
              . Toda corrección queda registrada con fecha; el dato anterior no se borra.
            </p>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
              Atención por WhatsApp: {CONTACTO.whatsapp}. Notas legales completas en{' '}
              <Link href="/aviso-legal" style={{ color: 'var(--moss)' }}>
                /aviso-legal
              </Link>
              .
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
