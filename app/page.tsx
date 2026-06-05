'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import TopoBand from '@/components/decor/TopoBand'
import TerrainMapSection from '@/components/terrain/TerrainMapSection'
import MariaWidget from '@/components/landing/MariaWidget'

type Lang = 'es' | 'en'

const SITE_LAST_UPDATED_ISO = '2026-05-10'

const NAV_LINKS: Array<{ href: string; es: string; en: string }> = [
  { href: '#identidad', es: 'Identidad', en: 'About' },
  { href: '#cumplimiento', es: 'Cumplimiento', en: 'Compliance' },
  { href: '#archivos-mineros', es: 'Mapa Minero', en: 'Mining Map' },
  { href: '#contacto', es: 'Contacto', en: 'Contact' },
]

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es')
  const [navOpen, setNavOpen] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml_lang')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'es' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  // Close mobile nav on Escape; restore focus to toggle button
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  // Close mobile nav on click outside the nav element
  useEffect(() => {
    if (!navOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      const insideNav = navRef.current?.contains(target)
      const insidePanel = panelRef.current?.contains(target)
      if (!insideNav && !insidePanel) setNavOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [navOpen])

  // Auto-close on desktop resize (≥ 1024)
  useEffect(() => {
    if (!navOpen) return
    const onResize = () => {
      if (window.innerWidth >= 1024) setNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [navOpen])

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [navOpen])

  // When overlay opens, move focus into it
  useEffect(() => {
    if (!navOpen) return
    const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>('a')
    firstLink?.focus()
  }, [navOpen])

  const changeLang = (l: Lang) => {
    setLang(l)
    try { localStorage.setItem('ml_lang', l) } catch {}
  }

  const t = (es: string, en: string) => lang === 'es' ? es : en

  return (
    <>
      {/* NAV */}
      <nav className="nav" ref={navRef}>
        <Link href="/" className="nav-logo">
          <span className="nav-logo-text">MAPE LEGAL</span>
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="nav-link">{t(link.es, link.en)}</a>
          ))}
        </div>
        <div className="lang-toggle" style={{ marginLeft: 'auto' }}>
          <button className={`lang-btn${lang === 'es' ? ' active' : ''}`} onClick={() => changeLang('es')}>ES</button>
          <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => changeLang('en')}>EN</button>
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          aria-expanded={navOpen}
          aria-controls="nav-mobile-panel"
          aria-label={navOpen ? t('Cerrar menú', 'Close menu') : t('Abrir menú', 'Open menu')}
          onClick={() => setNavOpen((v) => !v)}
        >
          {navOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>
      {navOpen && (
        <div id="nav-mobile-panel" className="nav-mobile-panel" ref={panelRef}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link"
              onClick={() => setNavOpen(false)}
            >
              {t(link.es, link.en)}
            </a>
          ))}
        </div>
      )}

      {/* HERO */}
      <section
        className="hero"
        style={{
          position: 'relative',
          gridTemplateColumns: '1fr',
          backgroundImage: 'url(/images/RIVER%20AND%20MOUNTAINS.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'color-mix(in oklch, var(--bg-soft) 88%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <TopoBand variant="light" position="overlay" />
        <div className="hero-content" style={{ position: 'relative', maxWidth: 820 }}>
          <div className="hero-eyebrow">
            {t('Trazabilidad legal del oro · Honduras', 'Legal traceability of gold · Honduras')}
          </div>
          <h1 className="hero-title">
            {t(
              'MAPE LEGAL formaliza oro artesanal hondureño y certifica su origen.',
              'MAPE LEGAL formalizes artisanal Honduran gold and certifies its origin.'
            )}
          </h1>
          <p className="hero-sub" style={{ maxWidth: 680 }}>
            {t(
              'Amparamos cada unidad minera bajo la Ley General de Minería de Honduras y emitimos certificados de origen que el comprador puede verificar.',
              "We cover each mining unit under Honduras' General Mining Law and issue certificates of origin the buyer can verify."
            )}
          </p>
        </div>
      </section>

      {/* IDENTIDAD */}
      <section
        id="identidad"
        className="mape-section"
        style={{
          background: 'var(--bg-soft)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Identidad', 'About')}</div>
        <h2 className="section-title">
          {t('Quiénes somos.', 'Who we are.')}
        </h2>
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 mt-10 items-start"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'MAPE LEGAL es una operación hondureña que formaliza unidades de minería artesanal y de pequeña escala (MAPE). Acompañamos al productor desde el expediente de INHGEOMIN hasta la venta de oro certificado en la cadena formal.',
                'MAPE LEGAL is a Honduran operation that formalizes artisanal and small-scale mining (MAPE) units. We accompany the producer from the INHGEOMIN file through the sale of certified gold into the formal supply chain.'
              )}
            </p>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'Las asociaciones mineras con las que trabajamos completan la consulta libre, previa e informada del Convenio 169 de la OIT antes de abrir expediente. Los pagos pasan por Finacoop, y cada productor formalizado mantiene cuenta bancaria propia en lempiras.',
                "The miners' associations we work with complete the free, prior and informed consultation under ILO Convention 169 before a file is opened. Payments move through Finacoop, and every formalized producer holds their own lempira bank account."
              )}
            </p>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'Todo lo que aparece en este sitio existe en papel: expediente legal, contrato firmado y certificado de origen emitido por MAPE LEGAL. Las cifras agregadas y los certificados publicados aquí son la única divulgación pública de la operación.',
                "Everything you see on this site exists on paper: a legal file, a signed contract and a certificate of origin issued by MAPE LEGAL. The aggregate figures and certificates published here are this operation's only public disclosure."
              )}
            </p>
          </div>
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
              background: 'var(--bg)',
              aspectRatio: '4 / 5',
              backgroundImage: 'url(/images/Technitians%20Field%20Work.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-hidden="true"
          />
        </div>
      </section>

      {/* CUMPLIMIENTO */}
      <section
        id="cumplimiento"
        className="mape-section"
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Cumplimiento', 'Compliance')}</div>
        <h2 className="section-title">
          {t('Bajo qué reglas opera MAPE LEGAL.', 'The rules MAPE LEGAL operates under.')}
        </h2>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          {t(
            'MAPE LEGAL responde a cuatro marcos a la vez: la ley nacional, el derecho de consulta indígena, los estándares OCDE de cadena de suministro y un registro auditable. Cada expediente minero los cruza todos.',
            'MAPE LEGAL answers to four frameworks at once: national law, indigenous consultation rights, OECD supply-chain due diligence, and an auditable record. Every mining file crosses all four.'
          )}
        </p>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mt-12"
        >
          {[
            {
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ),
              titleEs: 'Marco jurídico hondureño',
              titleEn: 'Honduran legal framework',
              bodyEs: 'Cada unidad minera avanza por las cuatro fases del INHGEOMIN previstas en la Ley General de Minería y el Reglamento Especial para la Minería Artesanal (Acuerdo 042-2013). La operación ambiental se ampara en la licencia SLAS-2 de SERNA / MiAmbiente+.',
              bodyEn: 'Every mining unit moves through the four INHGEOMIN phases set out in the General Mining Law and the Special Regulation for Artisanal Mining (Agreement 042-2013). Environmental operation is covered by the SLAS-2 license issued by SERNA / MiAmbiente+.',
            },
            {
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M3.5 12h17M12 3.5c2.5 2.5 4 5.5 4 8.5s-1.5 6-4 8.5M12 3.5c-2.5 2.5-4 5.5-4 8.5s1.5 6 4 8.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              ),
              titleEs: 'Convenio 169 de la OIT',
              titleEn: 'ILO Convention 169',
              bodyEs: 'Antes de abrir expediente, la comunidad anfitriona completa la consulta libre, previa e informada que exige el Convenio 169 de la OIT. El acta de consulta queda dentro del expediente legal de la unidad minera.',
              bodyEn: "Before a file is opened, the host community completes the free, prior and informed consultation required by ILO Convention 169. The consultation record sits inside the mining unit's legal file.",
            },
            {
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3l8 4v6c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V7l8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              titleEs: 'Debida diligencia OCDE',
              titleEn: 'OECD due diligence',
              bodyEs: 'Cada certificado de origen sigue la Guía de Debida Diligencia de la OCDE para Cadenas de Suministro Responsables de Minerales en Zonas de Conflicto y Alto Riesgo. La trazabilidad se hace por unidad minera concreta, no por lote agregado: el comprador sabe de qué bocamina viene cada gramo.',
              bodyEn: 'Each certificate of origin follows the OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas. Traceability is per individual mining unit, not per aggregate batch: the buyer knows which mine each gram came from.',
            },
            {
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M3 12l9 4 9-4M3 17l9 4 9-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              ),
              titleEs: 'Auditoría y registro',
              titleEn: 'Audit and record-keeping',
              bodyEs: 'Cada transacción y cada certificado existen por triplicado: copia firmada para el productor, copia para MAPE LEGAL y número público verificable en este sitio. El registro no se reescribe.',
              bodyEn: 'Every transaction and every certificate exists in triplicate: a signed copy for the producer, a copy for MAPE LEGAL, and a publicly verifiable number on this site. The record is not rewritten.',
            },
          ].map((card) => (
            <div
              key={card.titleEs}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 'clamp(20px, 4vw, 24px)',
                boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'color-mix(in oklch, var(--moss) 12%, white)',
                  color: 'var(--moss)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {card.icon}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {t(card.titleEs, card.titleEn)}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                {t(card.bodyEs, card.bodyEn)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* VERIFICACIÓN */}
      <section
        id="verificacion"
        className="mape-section"
        style={{
          background: 'var(--bg-soft)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Verificación', 'Verification')}</div>
        <h2 className="section-title">
          {t('Verifique un certificado.', 'Verify a certificate.')}
        </h2>
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 mt-10 items-start lg:items-center"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'Introduzca el número de certificado en el portal público y obtendrá la unidad minera de origen, la fecha de emisión, el peso certificado y el estado del certificado. No se publican datos personales del productor ni montos de transacción.',
                "Enter the certificate number in the public portal and you will see the source mining unit, the issue date, the certified weight, and the certificate's current status. No personal data of the producer or transaction amounts are published."
              )}
            </p>
            <Link
              href="/verificar"
              style={{
                color: 'var(--moss)',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                borderBottom: '1px solid color-mix(in oklch, var(--moss) 35%, white)',
                paddingBottom: 2,
                alignSelf: 'flex-start',
              }}
            >
              {t('Verificar un certificado', 'Verify a certificate')} →
            </Link>
          </div>

          {/* Illustrative certificate card (visual only, not a real record) */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
              overflow: 'hidden',
            }}
            aria-hidden="true"
          >
            <div
              style={{
                background: 'var(--ink)',
                color: '#fff',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {t('Certificado de Origen', 'Certificate of Origin')}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--sand)',
                  letterSpacing: '0.04em',
                }}
              >
                MAPE LEGAL
              </div>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--t3)',
                    marginBottom: 4,
                  }}
                >
                  {t('Número', 'Number')}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  CO-2026-0001
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--t3)',
                      marginBottom: 4,
                    }}
                  >
                    {t('Unidad minera', 'Mining unit')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                    {t('Distrito minero — Honduras', 'Mining district — Honduras')}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--t3)',
                      marginBottom: 4,
                    }}
                  >
                    {t('Peso certificado', 'Certified weight')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                    100.000 g
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--t3)',
                      marginBottom: 4,
                    }}
                  >
                    {t('Estado', 'Status')}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      background: 'color-mix(in oklch, var(--green) 14%, white)',
                      color: 'var(--green)',
                      border: '1px solid color-mix(in oklch, var(--green) 30%, white)',
                      padding: '2px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {t('Vigente', 'Valid')}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--t3)',
                      marginBottom: 4,
                    }}
                  >
                    {t('Válido hasta', 'Valid until')}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: 'var(--ink)',
                    }}
                  >
                    2027-05-10
                  </div>
                </div>
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--t3)',
                }}
              >
                {t('Ejemplo ilustrativo. No representa una transacción real.', 'Illustrative example. Does not represent a real transaction.')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHIVOS MINEROS — BIBLIOTECA DE ARCHIVOS MINEROS DE HONDURAS */}
      <section
        id="archivos-mineros"
        className="mape-section"
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <TerrainMapSection lang={lang} t={t} />
      </section>

      {/* CONTACTO */}
      <section
        id="contacto"
        className="mape-section"
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Contacto', 'Contact')}</div>
        <h2 className="section-title">
          {t('Cómo escribirnos.', 'How to reach us.')}
        </h2>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10"
        >
          {[
            {
              labelEs: 'WhatsApp institucional',
              labelEn: 'Institutional WhatsApp',
              valueLines: ['+504 9737 3139'],
              hrefValue: 'https://wa.me/50497373139',
            },
            {
              labelEs: 'Correo',
              labelEn: 'Email',
              valueLines: ['gerencia@mape.legal'],
              hrefValue: 'mailto:gerencia@mape.legal',
            },
            {
              labelEs: 'Oficina',
              labelEn: 'Office',
              valueLines: [
                'Local Nexcrea — Condominios Metrópolis',
                'Torre 1, Nivel 18',
                'Boulevard Suyapa, Tegucigalpa',
                'Francisco Morazán, Honduras',
              ],
              hrefValue: null,
            },
          ].map((block) => (
            <div
              key={block.labelEs}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 'clamp(20px, 4vw, 24px)',
                boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--earth)',
                }}
              >
                {t(block.labelEs, block.labelEn)}
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: 'var(--ink)',
                  lineHeight: 1.6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {block.hrefValue ? (
                  <a
                    href={block.hrefValue}
                    style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {block.valueLines[0]}
                  </a>
                ) : (
                  block.valueLines.map((line) => (
                    <span key={line} style={{ fontSize: 14, color: 'var(--t2)' }}>{line}</span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ position: 'relative' }}>
        <TopoBand variant="dark" position="band" />
        <div className="logo">MAPE LEGAL</div>
        <div className="copy">
          © 2026 MAPE LEGAL — {t('Todos los derechos reservados.', 'All rights reserved.')} {t('Tegucigalpa, Honduras.', 'Tegucigalpa, Honduras.')}
          <span style={{ display: 'block', marginTop: 4, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {t('Actualizado el:', 'Site last updated:')} {SITE_LAST_UPDATED_ISO}
          </span>
        </div>
        <div className="links">
          <Link href="/verificar">{t('Verificar certificado', 'Verify certificate')}</Link>
          <a href="#cumplimiento">{t('Cumplimiento', 'Compliance')}</a>
          <a href="#contacto">{t('Contacto', 'Contact')}</a>
        </div>
      </footer>

      {/* María — chat widget. Fixed-position FAB, available on every section. */}
      <MariaWidget lang={lang} />
    </>
  )
}
