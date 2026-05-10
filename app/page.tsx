'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopoBand from '@/components/decor/TopoBand'
import TerrainMapSection from '@/components/terrain/TerrainMapSection'

type Lang = 'es' | 'en'

const SITE_LAST_UPDATED_ISO = '2026-05-10'

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml_lang')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'es' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    try { localStorage.setItem('ml_lang', l) } catch {}
  }

  const t = (es: string, en: string) => lang === 'es' ? es : en

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-text">MAPE LEGAL</span>
        </Link>
        <div className="nav-links">
          <a href="#identidad" className="nav-link">{t('Identidad', 'About')}</a>
          <a href="#cumplimiento" className="nav-link">{t('Cumplimiento', 'Compliance')}</a>
          <a href="#archivos-mineros" className="nav-link">{t('Archivos', 'Archives')}</a>
          <a href="#contacto" className="nav-link">{t('Contacto', 'Contact')}</a>
          <div className="lang-toggle">
            <button className={`lang-btn${lang === 'es' ? ' active' : ''}`} onClick={() => changeLang('es')}>ES</button>
            <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => changeLang('en')}>EN</button>
          </div>
        </div>
      </nav>

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
            Corporación Hondureña Tenka, S.A.
          </div>
          <h1 className="hero-title">
            {t(
              'Trazabilidad legal del oro de minería artesanal en Honduras.',
              'Legal traceability of artisanal gold in Honduras.'
            )}
          </h1>
          <p className="hero-sub" style={{ maxWidth: 680 }}>
            {t(
              'MAPE LEGAL es la infraestructura de evidencia con la que CHT formaliza unidades mineras artesanales y de pequeña escala bajo la Ley de Minería de Honduras y emite certificados de origen verificables para la cadena de comercialización formal.',
              "MAPE LEGAL is the evidence infrastructure CHT uses to formalize artisanal and small-scale mining units under Honduras' Mining Law and to issue verifiable certificates of origin for the formal commercialization chain."
            )}
          </p>
        </div>
      </section>

      {/* IDENTIDAD */}
      <section
        id="identidad"
        style={{
          background: 'var(--bg-soft)',
          padding: '80px max(24px, calc((100% - 1100px)/2))',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Identidad', 'About')}</div>
        <h2 className="section-title">
          {t('Quiénes somos.', 'Who we are.')}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            marginTop: 40,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'CHT es una empresa hondureña dedicada a la formalización de la minería artesanal y de pequeña escala (MAPE). Operamos como intermediario de certificación y comercialización entre productores artesanales y la refinería Chiopa Industrias, bajo el marco jurídico hondureño y los estándares de debida diligencia de la cadena de oro.',
                'CHT is a Honduran company dedicated to the formalization of artisanal and small-scale mining (MAPE). We operate as a certification and commercialization intermediary between artisanal producers and the Chiopa Industrias refinery, under the Honduran legal framework and the gold supply chain due-diligence standards.'
              )}
            </p>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'Nuestro piloto opera en Iriona, departamento de Colón, con una asociación de mineros artesanales que ha completado su consulta libre, previa e informada bajo el Convenio 169 de la OIT. La operación canaliza pagos a través de Finacoop y mantiene cuentas bancarias formales en lempiras para cada productor formalizado.',
                'Our pilot operates in Iriona, department of Colón, with an artisanal miners association that has completed its free, prior and informed consent under ILO Convention 169. The operation channels payments through Finacoop and maintains formal bank accounts in lempiras for each formalized producer.'
              )}
            </p>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'Toda la actividad descrita en este sitio está respaldada por expedientes legales, contratos firmados y certificados de origen emitidos por CHT. Las cifras agregadas y los certificados publicados aquí son los únicos canales de divulgación pública de la operación.',
                'Every activity described on this site is backed by legal files, signed contracts and certificates of origin issued by CHT. The aggregate figures and certificates published here are the only public disclosure channels of the operation.'
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
        style={{
          background: 'var(--bg)',
          padding: '80px max(24px, calc((100% - 1100px)/2))',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Cumplimiento', 'Compliance')}</div>
        <h2 className="section-title">
          {t('Marco regulatorio y estándares.', 'Regulatory framework and standards.')}
        </h2>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          {t(
            'La operación de CHT está enmarcada en cuatro capas de cumplimiento: ley nacional, derecho indígena internacional, debida diligencia de cadena de suministro y registro auditable.',
            "CHT's operation is framed by four compliance layers: national law, international indigenous rights, supply chain due diligence and auditable record-keeping."
          )}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 24,
            marginTop: 48,
          }}
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
              bodyEs: 'Operamos bajo la Ley General de Minería, su Reglamento y el Reglamento Especial para la Minería Artesanal y la Pequeña Minería (Acuerdo 042-2013). Cada expediente sigue las cuatro fases de INHGEOMIN y la licencia ambiental SLAS-2 de SERNA / MiAmbiente+.',
              bodyEn: 'We operate under the General Mining Law, its Regulations and the Special Regulation for Artisanal and Small-Scale Mining (Agreement 042-2013). Each file follows the four INHGEOMIN phases and the SLAS-2 environmental license issued by SERNA / MiAmbiente+.',
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
              bodyEs: 'Las comunidades en las que operamos completan la consulta libre, previa e informada antes del inicio del proceso de formalización. La documentación de consulta forma parte del expediente legal de cada unidad minera.',
              bodyEn: 'The communities where we operate complete free, prior and informed consultation before the formalization process begins. Consultation documentation is part of the legal file of every mining unit.',
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
              bodyEs: 'La emisión de certificados de origen sigue la lógica de la Guía de Debida Diligencia de la OCDE para Cadenas de Suministro Responsables de Minerales en Áreas de Conflicto y de Alto Riesgo. La trazabilidad es por unidad minera, no por lote agregado.',
              bodyEn: 'The issuance of certificates of origin follows the OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas. Traceability is per mining unit, not per aggregate batch.',
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
              bodyEs: 'Toda transacción y emisión de certificado queda registrada en expediente legal, con copia firmada para el productor, copia para CHT y verificación pública del número de certificado. El registro es inmutable y auditable.',
              bodyEn: 'Every transaction and certificate issuance is recorded in the legal file, with a signed copy for the producer, a copy for CHT and public verification of the certificate number. The record is immutable and auditable.',
            },
          ].map((card) => (
            <div
              key={card.titleEs}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
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
        style={{
          background: 'var(--bg-soft)',
          padding: '80px max(24px, calc((100% - 1100px)/2))',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Verificación', 'Verification')}</div>
        <h2 className="section-title">
          {t('Certificado de Origen verificable.', 'Verifiable Certificate of Origin.')}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
            gap: 64,
            marginTop: 40,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              {t(
                'Cualquier persona puede verificar la validez de un certificado de origen emitido por CHT introduciendo el número de certificado en el portal público. La verificación devuelve la unidad minera de origen, la fecha de emisión, el peso del oro certificado y el estado vigente del certificado. No se publican datos personales del productor ni montos de transacción.',
                'Anyone can verify the validity of a certificate of origin issued by CHT by entering the certificate number in the public portal. Verification returns the source mining unit, the issue date, the certified gold weight and the current status of the certificate. No personal data of the producer or transaction amounts are published.'
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
                CHT
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
                    Iriona — Colón
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
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          padding: '80px max(24px, calc((100% - 1100px)/2))',
        }}
      >
        <TerrainMapSection lang={lang} t={t} />
      </section>

      {/* CONTACTO */}
      <section
        id="contacto"
        style={{
          background: 'var(--bg)',
          padding: '80px max(24px, calc((100% - 1100px)/2))',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="section-label">{t('Contacto', 'Contact')}</div>
        <h2 className="section-title">
          {t('Canales formales de contacto institucional.', 'Formal institutional contact channels.')}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 24,
            marginTop: 40,
          }}
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
                padding: 24,
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
          © 2026 Corporación Hondureña Tenka, S.A. — {t('Todos los derechos reservados.', 'All rights reserved.')} {t('Tegucigalpa, Honduras.', 'Tegucigalpa, Honduras.')}
          <span style={{ display: 'block', marginTop: 4, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {t('Última actualización del sitio:', 'Site last updated:')} {SITE_LAST_UPDATED_ISO}
          </span>
        </div>
        <div className="links">
          <Link href="/verificar">{t('Verificar certificado', 'Verify certificate')}</Link>
          <a href="#cumplimiento">{t('Cumplimiento', 'Compliance')}</a>
          <a href="#contacto">{t('Contacto', 'Contact')}</a>
        </div>
      </footer>
    </>
  )
}
