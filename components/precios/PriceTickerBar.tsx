'use client';

// Minimalist price ticker — a thin sticky bar at the very top of the home page,
// the first thing a visitor sees. Single line: MAPE gold buy price (L/gram),
// international gold & silver, USD/LPS, and Honduras diesel. Horizontally
// scrollable on small screens. The buy factor (80%) is never shown — only the
// computed Lempiras amount. Data from /api/precios/live (polled, hidden-guarded).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Keep in sync with the inline `top` offsets applied to .nav and
// .nav-mobile-panel in app/page.tsx so the sticky stack lines up.
export const TICKER_HEIGHT = 36;

interface LivePrices {
  oro_usd_oz: number | null;
  plata_usd_oz: number | null;
  usd_hnl: number | null;
  oro_compra_lps_gramo: number | null;
  diesel: { precio_hnl: number; unidad: string } | null;
}

const POLL_MS = 60_000;
const FETCH_TIMEOUT_MS = 12_000;

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-HN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  lang: 'es' | 'en';
}

export default function PriceTickerBar({ lang }: Props) {
  const t = useCallback((es: string, en: string) => (lang === 'es' ? es : en), [lang]);

  const [data, setData] = useState<LivePrices | null>(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  const ctrlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/precios/live', { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as LivePrices;
      if (!mountedRef.current) return;
      setData(json);
      setError(false);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      mountedRef.current = false;
      ctrlRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const items: Array<{ label: string; value: string; accent?: boolean }> = [
    {
      label: t('Compra oro', 'Gold buy'),
      value: data?.oro_compra_lps_gramo != null ? `L ${fmt(data.oro_compra_lps_gramo, 0)}/g` : '—',
      accent: true,
    },
    { label: t('Oro LBMA', 'LBMA gold'), value: data?.oro_usd_oz != null ? `$${fmt(data.oro_usd_oz, 0)}/oz` : '—' },
    { label: t('Plata LBMA', 'LBMA silver'), value: data?.plata_usd_oz != null ? `$${fmt(data.plata_usd_oz, 2)}/oz` : '—' },
    { label: 'USD', value: data?.usd_hnl != null ? `L ${fmt(data.usd_hnl, 2)}` : '—' },
    {
      label: t('Diésel', 'Diesel'),
      value: data?.diesel != null ? `L ${fmt(data.diesel.precio_hnl, 2)}/gal` : '—',
    },
  ];

  return (
    <div
      role="region"
      aria-label={t('Precios del día', 'Today’s prices')}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 101,
        height: TICKER_HEIGHT,
        background: 'var(--ink)',
        borderBottom: '1px solid color-mix(in oklch, var(--ink) 70%, black)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          width: '100%',
          height: '100%',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          padding: '0 max(16px, calc((100% - 1100px)/2))',
        }}
      >
        {/* Live dot (static — no continuous animation per DESIGN.md §4) */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: error ? 'var(--red)' : 'var(--moss-2)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--slate-lt)',
            }}
          >
            {error ? t('Precios', 'Prices') : t('En vivo', 'Live')}
          </span>
        </span>

        {items.map((it) => (
          <span
            key={it.label}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--slate-lt)' }}>{it.label}</span>
            <span style={{ color: it.accent ? 'var(--sand)' : '#fff', fontWeight: 600 }}>
              {it.value}
            </span>
          </span>
        ))}

        <Link
          href="/precios"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--sand)',
            textDecoration: 'none',
            paddingLeft: 12,
          }}
        >
          {t('Ver precios', 'See prices')} →
        </Link>
      </div>
    </div>
  );
}
