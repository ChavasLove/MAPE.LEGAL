// /publicaciones — marketplace abierto de publicaciones de los participantes
// (DEC-2026-11-27-2). EN IMPLEMENTACIÓN: la página publica qué será el módulo
// y sus reglas, sin filas, sin precios de ejemplo y sin consultar la base de
// datos (la migración 044 que lo modela NO está aplicada). CHT no carga los
// precios de los participantes; nada de aquí sustituye al precio informativo
// del oro de /precios. Server component ES-only; todo el copy con consecuencia
// jurídica se importa de lib/content/copy-legal.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  EN_IMPLEMENTACION,
  IDENTIDAD_FONDOS_TARIFAS,
  LIBERTAD_VENTA,
  MARKETPLACE_ESTADO_NOTA,
  MARKETPLACE_INTRO,
  MARKETPLACE_REGLAS,
  MARKETPLACE_TITULO,
  POSICIONAMIENTO_PLATAFORMA,
} from '@/lib/content/copy-legal'
import { ETIQUETAS_PARTICIPANTE, ETIQUETAS_TIPO } from '@/lib/publicaciones/types'

export const metadata: Metadata = {
  title: 'Publicaciones de los participantes — marketplace abierto (en implementación)',
  description:
    'Marketplace abierto donde cada participante publica su producción estimada y los precios a los que compra o vende oro. CHT no carga esos precios ni intermedia. Módulo en implementación, sin datos cargados.',
  alternates: { canonical: '/publicaciones' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Publicaciones de los participantes · MAPE.LEGAL',
    description:
      'Marketplace abierto de producción y precios publicados por cada participante. En implementación.',
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
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

export default function PublicacionesPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Marketplace abierto</div>
        <h1 className="section-title" style={{ maxWidth: 760 }}>
          {MARKETPLACE_TITULO}.
        </h1>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          {MARKETPLACE_INTRO}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 760, marginTop: 40 }}>
          {/* Estado — señal ámbar (DESIGN.md §1.3: pendiente), no decoración */}
          <div
            role="status"
            style={{
              ...CARD,
              background: 'color-mix(in oklch, var(--amber) 10%, white)',
              border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
            }}
          >
            <div style={{ ...MONO, color: 'var(--amber)', marginBottom: 8 }}>{EN_IMPLEMENTACION}</div>
            <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{MARKETPLACE_ESTADO_NOTA}</p>
          </div>

          {/* Qué publicará cada participante — estructura, sin datos */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Qué publica cada participante.</h2>
            <p style={BODY}>
              Cada publicación lleva el nombre del participante, su tipo, el dato que publica y
              su vigencia. La tabla de abajo muestra la estructura; no contiene datos.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table aria-label="Estructura de una publicación (sin datos)" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr>
                    {['Participante', 'Tipo de participante', 'Qué publica', 'Vigencia'].map((th) => (
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
                  <tr>
                    <td colSpan={4} style={{ padding: '18px 14px', fontSize: 14, color: 'var(--t3)', background: 'var(--bg)', textAlign: 'center' }}>
                      Sin publicaciones cargadas. {EN_IMPLEMENTACION}.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
              Tipos de participante previstos: {Object.values(ETIQUETAS_PARTICIPANTE).join(', ').toLowerCase()}.
              Tipos de publicación: {Object.values(ETIQUETAS_TIPO).join(', ').toLowerCase()}.
            </p>
          </section>

          {/* Reglas */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Reglas del marketplace.</h2>
            <div style={CARD}>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
                {MARKETPLACE_REGLAS.map((r) => (
                  <li key={r} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <p style={BODY}>{LIBERTAD_VENTA}</p>
            <p style={BODY}>{IDENTIDAD_FONDOS_TARIFAS}</p>
          </section>

          {/* Posicionamiento y enlaces */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={SECTION_TITLE}>Dónde encaja.</h2>
            <p style={BODY}>{POSICIONAMIENTO_PLATAFORMA}</p>
            <p style={BODY}>
              El precio informativo del oro del día (precio internacional × tipo de cambio de
              compra del BCH ÷ 31.1034768, sin ningún factor) está en{' '}
              <Link href="/precios" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                mape.legal/precios
              </Link>
              . Las reglas del estándar, en{' '}
              <Link href="/estandar" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                /estandar
              </Link>
              ; la adopción por municipios, en{' '}
              <Link href="/municipalidades" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
                /municipalidades
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
