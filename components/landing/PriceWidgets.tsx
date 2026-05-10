'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetalData {
  price: number | null;
  change: number;
  changePercent: number;
}

interface PriceData {
  gold: MetalData;
  silver: MetalData;
  hnlPerUsd: number | null;
  lastUpdated: string;
}

const EMPTY_METAL: MetalData = { price: null, change: 0, changePercent: 0 };

const PCT_THRESHOLD = 0.01;

function getDisplay(changePercent: number, change: number) {
  const cleanPct   = Math.abs(changePercent) < 0.005 ? 0 : changePercent;
  const cleanDelta = Math.abs(change)        < 0.005 ? 0 : change;
  const absPct     = Math.abs(cleanPct);

  if (absPct < PCT_THRESHOLD) {
    if (cleanDelta === 0) {
      return { text: '0.00%', color: 'text-white/45', direction: 'neutral' as const };
    }
    const sign = cleanDelta > 0 ? '+' : '-';
    return {
      text: `${sign}<0.01%`,
      color: cleanDelta > 0 ? 'text-action-green' : 'text-action-red',
      direction: cleanDelta > 0 ? 'up' as const : 'down' as const,
    };
  }
  const sign = cleanPct > 0 ? '+' : '';
  return {
    text: `${sign}${cleanPct.toFixed(2)}%`,
    color: cleanPct > 0 ? 'text-action-green' : 'text-action-red',
    direction: cleanPct > 0 ? 'up' as const : 'down' as const,
  };
}

export function PriceWidgets() {
  const [prices, setPrices] = useState<PriceData>({
    gold: EMPTY_METAL,
    silver: EMPTY_METAL,
    hnlPerUsd: null,
    lastUpdated: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    const res = await fetch('/api/prices').catch(() => null);
    if (!res?.ok) {
      setError('No se pudo actualizar precios');
      setLoading(false);
      return;
    }
    const raw = (await res.json().catch(() => null)) as {
      gold?: MetalData; silver?: MetalData; hnlPerUsd?: number | null;
    } | null;
    if (!raw) {
      setError('No se pudo actualizar precios');
      setLoading(false);
      return;
    }
    setPrices({
      gold: raw.gold ?? EMPTY_METAL,
      silver: raw.silver ?? EMPTY_METAL,
      hnlPerUsd: raw.hnlPerUsd ?? null,
      lastUpdated: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
    });
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    // All setState calls inside fetchPrices happen after awaits — no synchronous cascading renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPrices();
    const interval = setInterval(() => void fetchPrices(), 60_000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (n: number | null, decimals = 2) =>
    n !== null
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : '—';

  const goldDisplay   = getDisplay(prices.gold.changePercent,   prices.gold.change);
  const silverDisplay = getDisplay(prices.silver.changePercent, prices.silver.change);

  const cardClass = 'flex-1 max-w-xs bg-white/15 border border-white/25 backdrop-blur-sm rounded-xl p-5';

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch justify-center">

        {/* Gold */}
        <div className={cardClass}>
          <div className="text-earth-200 text-xs font-bold tracking-widest uppercase mb-2 font-sans">ORO LBMA</div>
          <div className="text-2xl font-bold text-white font-sans">
            {loading ? '—' : `$${fmt(prices.gold.price)}`}
          </div>
          {!loading && prices.gold.price !== null && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium font-sans ${goldDisplay.color}`}>
              {goldDisplay.direction === 'up'   && <TrendingUp   className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {goldDisplay.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
              <span>{goldDisplay.text}</span>
            </div>
          )}
          <div className="text-white/60 text-xs mt-1 font-sans">USD por onza troy</div>
        </div>

        {/* Silver */}
        <div className={cardClass}>
          <div className="text-earth-200 text-xs font-bold tracking-widest uppercase mb-2 font-sans">PLATA LBMA</div>
          <div className="text-2xl font-bold text-white font-sans">
            {loading ? '—' : `$${fmt(prices.silver.price)}`}
          </div>
          {!loading && prices.silver.price !== null && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium font-sans ${silverDisplay.color}`}>
              {silverDisplay.direction === 'up'   && <TrendingUp   className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {silverDisplay.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
              <span>{silverDisplay.text}</span>
            </div>
          )}
          <div className="text-white/60 text-xs mt-1 font-sans">USD por onza troy</div>
        </div>

        {/* HNL exchange rate */}
        <div className={cardClass}>
          <div className="text-earth-200 text-xs font-bold tracking-widest uppercase mb-2 font-sans">LEMPIRA (HNL)</div>
          <div className="text-2xl font-bold text-white font-sans">
            {loading ? '—' : prices.hnlPerUsd ? `L ${fmt(prices.hnlPerUsd)}` : '—'}
          </div>
          <div className="text-white/60 text-xs mt-1.5 font-sans">por 1 USD · BCH</div>
        </div>

      </div>

      <div className="text-center mt-3 text-xs text-white/40 font-sans">
        {error ? (
          <span className="text-action-red/70">{error}</span>
        ) : (
          <>Precios de referencia · Actualizado {prices.lastUpdated || '—'}</>
        )}
      </div>
    </div>
  );
}
