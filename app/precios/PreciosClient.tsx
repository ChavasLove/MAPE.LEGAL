'use client';

// Public /precios page — a focused, shareable live-prices tool for gold miners.
// Unlike the institutional landing (buyers/regulators/press), this surface is
// miner-facing, so a WhatsApp CTA is appropriate here. Reads the ES/EN toggle
// from the same localStorage key ('ml_lang') the landing uses.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TopoBand from '@/components/decor/TopoBand';
import MariaWidget from '@/components/landing/MariaWidget';
import LivePricesWidget from '@/components/precios/LivePricesWidget';

type Lang = 'es' | 'en';

const WHATSAPP_HREF =
  'https://wa.me/50497373139?text=' +
  encodeURIComponent('Hola MAPE LEGAL, quiero información sobre la compra de oro.');

export default function PreciosClient() {
  const [lang, setLang] = useState<Lang>('es');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml_lang');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'es' || saved === 'en') setLang(saved);
    } catch {}
  }, []);

  const changeLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem('ml_lang', l);
    } catch {}
  };

  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-text">MAPE LEGAL</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            {t('Inicio', 'Home')}
          </Link>
          <Link href="/equipos" className="nav-link">
            {t('Equipos', 'Equipment')}
          </Link>
          <Link href="/verificar" className="nav-link">
            {t('Verificar', 'Verify')}
          </Link>
        </div>
        <div className="lang-toggle" style={{ marginLeft: 'auto' }}>
          <button
            className={`lang-btn${lang === 'es' ? ' active' : ''}`}
            onClick={() => changeLang('es')}
          >
            ES
          </button>
          <button
            className={`lang-btn${lang === 'en' ? ' active' : ''}`}
            onClick={() => changeLang('en')}
          >
            EN
          </button>
        </div>
      </nav>

      {/* HEADER + WIDGET */}
      <section
        className="mape-section"
        style={{ background: 'var(--bg-soft)', position: 'relative' }}
      >
        <TopoBand variant="light" position="overlay" />
        <div style={{ position: 'relative', maxWidth: 960, margin: '0 auto' }}>
          <div className="section-label">{t('Precios del día', 'Daily prices')}</div>
          <h1
            className="section-title"
            style={{ maxWidth: 720 }}
          >
            {t(
              'Precio del oro y del diésel, ',
              'Gold and diesel prices, ',
            )}
            <em>{t('hoy en Honduras.', 'today in Honduras.')}</em>
          </h1>
          <p
            style={{
              marginTop: 16,
              maxWidth: 640,
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--t2)',
            }}
          >
            {t(
              'Consulta el precio internacional del oro, cuánto paga MAPE.LEGAL por gramo en Lempiras, el tipo de cambio del día y el precio oficial del diésel. Actualizado diariamente.',
              'Check the international gold price, what MAPE.LEGAL pays per gram in Lempiras, today’s exchange rate, and the official diesel price. Updated daily.',
            )}
          </p>

          <div style={{ marginTop: 32 }}>
            <LivePricesWidget lang={lang} />
          </div>

          {/* CTA — miner-facing WhatsApp */}
          <div
            style={{
              marginTop: 32,
              padding: 'clamp(20px, 4vw, 28px)',
              borderRadius: 12,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 20,
                  color: 'var(--ink)',
                  marginBottom: 4,
                }}
              >
                {t('¿Vendés oro?', 'Selling gold?')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.5 }}>
                {t(
                  'Escribinos por WhatsApp y coordinamos la compra con pago en Lempiras vía cooperativa financiera aliada.',
                  'Message us on WhatsApp and we’ll arrange the purchase, paid in Lempiras via an allied financial cooperative.',
                )}
              </div>
            </div>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 20px',
                borderRadius: 8,
                background: 'var(--moss)',
                color: '#fff',
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {t('Escribir por WhatsApp', 'Message on WhatsApp')}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ position: 'relative' }}>
        <TopoBand variant="dark" position="band" />
        <div className="logo">MAPE LEGAL</div>
        <div className="copy">
          © 2026 MAPE LEGAL —{' '}
          {t('Todos los derechos reservados.', 'All rights reserved.')}{' '}
          {t('Tegucigalpa, Honduras.', 'Tegucigalpa, Honduras.')}
        </div>
        <div className="links">
          <Link href="/">{t('Inicio', 'Home')}</Link>
          <Link href="/verificar">{t('Verificar certificado', 'Verify certificate')}</Link>
          <a href="mailto:gerencia@mape.legal">{t('Contacto', 'Contact')}</a>
        </div>
      </footer>

      {/* María — chat widget */}
      <MariaWidget lang={lang} />
    </>
  );
}
