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
  RAZON_SOCIAL,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Acceso a mercados que exigen certificación de origen',
  description:
    'El oro sin cadena de custodia documentada queda fuera de las cadenas de suministro con debida diligencia. Qué exige un comprador aguas abajo y cómo el sello complementario de trazabilidad se verifica públicamente.',
  alternates: { canonical: '/mercados' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Acceso a mercados que exigen certificación de origen · MAPE.LEGAL',
    description:
      'Certificación de origen verificable para oro de pequeña minería en Honduras: la llave hacia cadenas de suministro con debida diligencia.',
    images: [{ url: '/images/RIVER AND MOUNTAINS.png', width: 1200, height: 630, alt: 'MAPE LEGAL — territorio' }],
  },
}

/* [PENDIENTE: reparar el demo o no anunciarlo] El certificado demostrativo
   CO-2026-0001-DEMO (seed de la migración 020) devuelve "no encontrado" en
   producción, así que el enlace al demo se retiró de la página (10-nov-2026).
   Reactivar solo cuando el registro exista en la base real. */

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

const EXIGENCIAS_COMPRADOR = [
  'Identificación del titular y de su derecho minero.',
  'Coordenadas del sitio de extracción.',
  'Evidencia fotográfica georreferenciada de la operación.',
  'Certificación de Procedencia o Certificado de Origen oficial, emitido por el titular y autenticado por la Autoridad Minera o Municipal.',
  'Registro documental de la transacción.',
] as const

const PRODUCE_MAPE = [
  {
    titulo: 'Índice de legalidad por unidad minera',
    cuerpo:
      'Cinco componentes verificados por unidad: tierra, permiso INHGEOMIN, licencia ambiental, permiso municipal y documentación de procedencia.',
  },
  {
    titulo: 'Expediente digital',
    cuerpo:
      'Documentos, coordenadas y evidencia de cada unidad minera en un expediente que sobrevive a la transacción individual.',
  },
  {
    titulo: 'Verificación pública del sello complementario',
    cuerpo:
      'Cada registro del sello tiene un número consultable por cualquier tercero en la página de verificación de este sitio, sin exponer datos personales del productor. La consulta no sustituye el documento oficial de procedencia.',
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
          La exigencia de certificación no la impone la plataforma MAPE.LEGAL, operada
          por {RAZON_SOCIAL}, ni la autoridad hondureña al minero: la imponen los mercados
          compradores que aplican debida diligencia sobre su cadena de suministro. La
          certificación es la llave para entrar.
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
              Puede verificar cualquier número de registro del sello complementario en{' '}
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
              relación preferente con comprador alguno ni con la plataforma. MAPE.LEGAL no
              compra, no vende ni intermedia oro. {CERTIFICADO_ORIGEN_NOTA}
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
      <MariaWidget lang="es" />
    </>
  )
}
