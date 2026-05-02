'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface PriceData {
  gold: number | null;
  silver: number | null;
  hnlPerUsd: number | null;
  lastUpdated: string;
}

export function PriceWidgets() {
  const [prices, setPrices] = useState<PriceData>({
    gold: null,
    silver: null,
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
      gold?: number; silver?: number; hnlPerUsd?: number;
    } | null;
    if (!raw) {
      setError('No se pudo actualizar precios');
      setLoading(false);
      return;
    }
    setPrices({
      gold: raw.gold ?? null,
      silver: raw.silver ?? null,
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
    n !== null ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

  const widgets = [
    {
      label: 'ORO LBMA',
      value: loading ? '—' : prices.gold ? `$${fmt(prices.gold)}` : '—',
      sub: 'USD por onza troy',
      icon: '🥇',
    },
    {
      label: 'PLATA LBMA',
      value: loading ? '—' : prices.silver ? `$${fmt(prices.silver)}` : '—',
      sub: 'USD por onza troy',
      icon: '🥈',
    },
    {
      label: 'LEMPIRA (HNL)',
      value: loading ? '—' : prices.hnlPerUsd ? `L ${fmt(prices.hnlPerUsd, 2)}` : '—',
      sub: 'por 1 USD · BCH',
      icon: '🇭🇳',
    },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch justify-center">
        {widgets.map(({ label, value, sub, icon }) => (
          <Card
            key={label}
            className="flex-1 max-w-xs bg-white/15 border-white/25 backdrop-blur-sm shadow-none rounded-xl"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-earth-200 text-xs font-bold tracking-widest uppercase mb-1 font-sans">{label}</div>
                  <div className="text-2xl font-bold text-white font-sans">{value}</div>
                  <div className="text-white/50 text-xs mt-0.5 font-sans">{sub}</div>
                </div>
                <div className="text-3xl shrink-0">{icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center mt-3 text-xs text-white/40 font-sans">
        {error ? (
          <span className="text-action-red/70">{error}</span>
        ) : (
          <>Precios en tiempo real · Actualizado {prices.lastUpdated || '—'}</>
        )}
      </div>
    </div>
  );
}
