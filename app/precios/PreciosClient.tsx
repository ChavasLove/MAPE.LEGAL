'use client';

// Public /precios page — a focused, shareable live-prices tool for gold miners.
// Unlike the institutional landing (buyers/regulators/press), this surface is
// miner-facing, so a WhatsApp CTA is appropriate here. Reads the ES/EN toggle
// from the same localStorage key ('ml_lang') the landing uses.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TopoBand from '@/components/decor/TopoBand';
import MariaWidget from '@/components/landing/MariaWidget';
import SiteFooter from '@/components/landing/SiteFooter';
import LivePricesWidget, {
  PriceSourcesPanel,
  type LivePrices,
} from '@/components/precios/LivePricesWidget';
import KaratPricesTable from '@/components/precios/KaratPricesTable';
import PriceHistoryChart from '@/components/precios/PriceHistoryChart';
import {
  AVISO_PRECIO_REFERENCIAL,
  PRECIOS_REFERENCIA_COMERCIAL,
  RAZON_SOCIAL,
} from '@/lib/content/copy-legal';

type Lang = 'es' | 'en';

const WHATSAPP_HREF =
  'https://wa.me/50497373139?text=' +
  encodeURIComponent('Hola, tengo una consulta sobre el precio referencial del oro publicado en mape.legal.');

export default function PreciosClient() {
  const [lang, setLang] = useState<Lang>('es');
  // Snapshot bubbled up from LivePricesWidget so the "Fuentes y actualización"
  // panel (relocated to the bottom of the page) shares the same data without a
  // second fetch/poll.
  const [prices, setPrices] = useState<LivePrices | null>(null);

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
              'Precio del oro, ',
              'Gold price, ',
            )}
            <em>{t('hoy en Honduras.', 'today in Honduras.')}</em>
          </h1>
          {/* Precios primero: el widget va inmediatamente después del título
              para que las cifras y la gráfica sean lo primero visible. El
              párrafo descriptivo se movió debajo de la gráfica. */}
          <div style={{ marginTop: 24 }}>
            <LivePricesWidget lang={lang} onData={setPrices} />
          </div>

          {/* Conversión por kilates — misma data del snapshot diario (bubbled
              up vía onData), sin segundo fetch. Va junto a las demás cifras,
              antes de la gráfica ("los números arriba"). */}
          <div style={{ marginTop: 16 }}>
            <KaratPricesTable lang={lang} data={prices} />
          </div>

          {/* Historial — daily 8 AM snapshots plotted over time so the price
              of any past day is verifiable, not just today's. */}
          <div style={{ marginTop: 32 }}>
            <PriceHistoryChart lang={lang} />
          </div>

          <p
            style={{
              marginTop: 32,
              maxWidth: 640,
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--t2)',
            }}
          >
            {t(
              `Consulta el precio internacional del oro, el precio de referencia comercial de ${RAZON_SOCIAL} en lempiras por gramo de oro fino, y el tipo de cambio del día. Actualizado diariamente.`,
              `Check the international gold price, the ${RAZON_SOCIAL} commercial reference price in lempiras per gram of fine gold, and today’s exchange rate. Updated daily.`,
            )}
          </p>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
            <Link href="/precio" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
              {t(
                `${PRECIOS_REFERENCIA_COMERCIAL} →`,
                `${RAZON_SOCIAL} reference price, formula and selling requirements →`,
              )}
            </Link>
          </p>

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
                {t('¿Consultas sobre el precio referencial?', 'Questions about the reference price?')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.5 }}>
                {t(
                  'Escribinos por WhatsApp si tenés dudas sobre cómo se calcula el precio referencial, la fórmula publicada o la conversión por kilates. Es información general, sin oferta ni intermediación.',
                  'Message us on WhatsApp with questions about how the reference price is calculated, the published formula or the karat conversion. General information only — no offer or brokerage.',
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

          {/* Aviso literal del precio referencial (hotfix 11-nov-2026). ES-only:
              texto con consecuencia jurídica, importado de copy-legal. */}
          <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7, color: 'var(--t3)' }}>
            {AVISO_PRECIO_REFERENCIAL}
          </p>

          {/* Fuentes y actualización — al final de la página por pedido del
              operador: la procedencia sigue publicada (contrato de
              transparencia de la página) pero sin separar precios y gráfica. */}
          <div style={{ marginTop: 32 }}>
            <PriceSourcesPanel lang={lang} data={prices} />
          </div>
        </div>
      </section>

      {/* FOOTER — el compartido: la página que publica el precio referencial
          debe llevar las notas legales (registro de comercializador, nota
          del Certificado de Origen, aviso de plataforma). ES-only. */}
      <SiteFooter />

      {/* María — chat widget */}
      <MariaWidget lang={lang} />
    </>
  );
}
