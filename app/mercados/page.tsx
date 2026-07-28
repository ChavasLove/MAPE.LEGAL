// /mercados — acceso a mercados que exigen certificación de origen (Fase 2C,
// Tarea 6). El encuadre es siempre: la exigencia proviene del mercado
// comprador, no es una restricción impuesta al minero. Server component.

import type { Metadata } from 'next'
import Link from 'next/link'
import MariaWidget from '@/components/landing/MariaWidget'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  CERTIFICADO_ORIGEN_NOTA,
  MERCADOS_ACCESO,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Acceso a mercados que exigen certificación de origen',
  description:
    'El oro sin cadena de custodia documentada queda fuera de las cadenas de suministro con debida diligencia. Qué exige un comprador aguas abajo y cómo el certificado de origen del oro de Honduras se verifica públicamente.',
  alternates: { canonical: '/mercados' },
  openGraph: {
    title: 'Acceso a mercados que exigen certificación de origen · MAPE.LEGAL',
    description:
      'Certificación de origen verificable para oro de pequeña minería en Honduras: la llave hacia cadenas de suministro con debida diligencia.',
  },
}

/** Número del certificado demostrativo sembrado por la migración 020. */
const CERTIFICADO_DEMO = 'CO-2026-0001-DEMO'

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(22px, 3vw, 28px)',
  fontWeight: 600,
  color: 'var(--ink)',
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
  scrollMarginTop: 96,
}

const BODY: React.CSSProperties = { fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 'clamp(20px, 4vw, 24px)',
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
}

const EXIGENCIAS_COMPRADOR = [
  'Identificación del titular y de su derecho minero.',
  'Coordenadas del sitio de extracción.',
  'Evidencia fotográfica georreferenciada de la operación.',
  'Certificado de Origen avalado por la autoridad.',
  'Registro documental de la transacción.',
] as const

const PRODUCE_MAPE = [
  {
    titulo: 'Índice de legalidad por unidad minera',
    cuerpo:
      'Cinco componentes verificados por unidad: tierra, permiso INHGEOMIN, licencia ambiental, permiso municipal y registro de comercializador.',
  },
  {
    titulo: 'Expediente digital',
    cuerpo:
      'Documentos, coordenadas y evidencia de cada unidad minera en un expediente que sobrevive a la transacción individual.',
  },
  {
    titulo: 'Verificación pública del certificado',
    cuerpo:
      'Cada certificado tiene un número consultable por cualquier tercero en la página de verificación de este sitio, sin exponer datos personales del productor.',
  },
] as const

export default function MercadosPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Mercados</div>
        <h1 className="section-title" style={{ maxWidth: 820 }}>
          {MERCADOS_ACCESO}
        </h1>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          La exigencia de certificación no la impone CHT ni la autoridad hondureña al
          minero: la imponen los mercados compradores que aplican debida diligencia
          sobre su cadena de suministro. La certificación es la llave para entrar.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 56, maxWidth: 760, marginTop: 48 }}>
          {/* MARCO */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>El marco de referencia.</h2>
            <p style={BODY}>
              El oro sin cadena de custodia documentada queda fuera de las cadenas de
              suministro que aplican debida diligencia. No importa su ley ni su pureza:
              sin origen demostrable, el material no entra. La barrera es del mercado
              comprador; el operador que documenta su origen la convierte en ventaja.
            </p>
          </section>

          {/* QUÉ EXIGE UN COMPRADOR */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Qué exige un comprador aguas abajo.</h2>
            <div style={CARD}>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
                {EXIGENCIAS_COMPRADOR.map((item) => (
                  <li key={item} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* CÓMO LO PRODUCE MAPE.LEGAL */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={SECTION_TITLE}>Cómo lo produce MAPE.LEGAL.</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {PRODUCE_MAPE.map((bloque) => (
                <div key={bloque.titulo} style={CARD}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      marginBottom: 8,
                    }}
                  >
                    {bloque.titulo}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{bloque.cuerpo}</p>
                </div>
              ))}
            </div>
            <p style={BODY}>
              Puede probar el verificador con el certificado demostrativo:{' '}
              <Link
                href={`/verificar/${CERTIFICADO_DEMO}`}
                style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 14 }}
              >
                {CERTIFICADO_DEMO}
              </Link>{' '}
              o verificar cualquier número en{' '}
              <Link href="/verificar" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/verificar
              </Link>
              .
            </p>
          </section>

          {/* NOTA DE ENCUADRE */}
          <div
            style={{
              ...CARD,
              background: 'var(--concrete)',
            }}
          >
            <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
              El acceso a estos mercados depende del cumplimiento del operador, no de una
              relación preferente con CHT. {CERTIFICADO_ORIGEN_NOTA}
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
      <MariaWidget lang="es" />
    </>
  )
}
