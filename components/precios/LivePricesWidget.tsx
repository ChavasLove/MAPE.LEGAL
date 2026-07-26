'use client';

// Live prices widget — public tool aimed at gold miners.
//
// Fetches /api/precios/live on mount, then polls every 60 s (skipping the tick
// while the tab is hidden) and refetches when the tab regains focus. Shows the
// international gold/silver reference prices, the MAPE LEGAL gold purchase price
// in Lempiras/gram, the USD/LPS rate, and the SEN-set Honduras diesel price.
//
// Prices are numbers; chrome (labels, notes) respects the ES/EN toggle via the
// `lang` prop. No continuous animations per DESIGN.md — the "live" dot is static.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { COMBUSTIBLE_LABELS, type TipoCombustible } from '@/lib/types/combustible';

interface FuelLine {
  combustible: TipoCombustible;
  precio_hnl: number;
  unidad: string;
  zona: string;
  vigente_desde: string;
  fuente: string;
}

interface LivePrices {
  fecha: string;
  fetched_at: string | null;
  fuente: string | null;
  consultado_hn: string;
  mape_factor: number;
  oro_usd_oz: number | null;
  plata_usd_oz: number | null;
  usd_hnl: number | null;
  oro_lps_oz: number | null;
  oro_compra_lps_gramo: number | null;
  diesel: Omit<FuelLine, 'combustible'> | null;
  combustibles: FuelLine[];
}

const POLL_MS = 60_000;
const FETCH_TIMEOUT_MS = 12_000;
const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

interface Props {
  lang: 'es' | 'en';
  // When false, the primary card omits the "80% of the international price"
  // wording and shows only the computed Lempiras/gram amount. Used on the home
  // page embed where the buy factor is not disclosed publicly.
  showBuyFactor?: boolean;
}

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(iso: string, lang: 'es' | 'en'): string {
  // iso is YYYY-MM-DD; pin to local midnight so the day doesn't shift by TZ.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function LivePricesWidget({ lang, showBuyFactor = true }: Props) {
  const t = useCallback(
    (es: string, en: string) => (lang === 'es' ? es : en),
    [lang],
  );

  const [data, setData] = useState<LivePrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const ctrlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/precios/live', {
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as LivePrices;
      if (!mountedRef.current) return;
      setData(json);
      setError(false);
    } catch {
      if (!mountedRef.current) return;
      // Flag the error. The render keeps any previously loaded snapshot visible
      // (only the "live" dot turns red) and shows the full error box solely when
      // there's nothing loaded yet — see the `error && data == null` branch.
      setError(true);
    } finally {
      window.clearTimeout(timer);
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Fetch-on-mount. `load` only setStates after an await, so there's no
    // synchronous cascade — same benign pattern (and suppression) as
    // MariaWidget / app/page.tsx per CLAUDE.md.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      mountedRef.current = false;
      ctrlRef.current?.abort();
    };
  }, [load]);

  // Poll on an interval, skipping ticks while the tab is hidden (saves egress
  // and upstream cost). Refetch immediately when the tab regains focus.
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

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    load();
  };

  const otros = (data?.combustibles ?? []).filter((c) => c.combustible !== 'diesel');

  return (
    <div>
      {/* Live indicator + refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: error ? 'var(--red)' : 'var(--moss-2)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: error ? 'var(--red)' : 'var(--moss)',
            }}
          >
            {error
              ? t('Sin conexión', 'Offline')
              : loading
                ? t('Cargando…', 'Loading…')
                : t('En vivo', 'Live')}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={t('Actualizar precios', 'Refresh prices')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--t2)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <RefreshCw size={15} strokeWidth={1.5} />
          <span>{t('Actualizar', 'Refresh')}</span>
        </button>
      </div>

      {error && data == null ? (
        <div
          role="alert"
          style={{
            padding: 24,
            borderRadius: 12,
            background: 'color-mix(in oklch, var(--red) 8%, white)',
            border: '1px solid color-mix(in oklch, var(--red) 28%, white)',
            color: 'var(--red)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
          }}
        >
          {t(
            'No pudimos cargar los precios. Intenta de nuevo en un momento.',
            'We could not load prices. Please try again shortly.',
          )}
        </div>
      ) : loading && data == null ? (
        <PriceSkeleton />
      ) : (
        <>
          {/* Primary — MAPE LEGAL gold purchase price */}
          <div
            style={{
              background: 'color-mix(in oklch, var(--moss) 7%, white)',
              border: '1px solid color-mix(in oklch, var(--moss) 28%, white)',
              borderRadius: 12,
              padding: 'clamp(20px, 4vw, 28px)',
              boxShadow: SHADOW_SM,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--moss)',
                marginBottom: 10,
              }}
            >
              {t('MAPE LEGAL compra oro', 'MAPE LEGAL buys gold at')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 'clamp(34px, 7vw, 52px)',
                  lineHeight: 1,
                  color: 'var(--earth)',
                  letterSpacing: '-0.02em',
                }}
              >
                {data?.oro_compra_lps_gramo != null
                  ? `L ${fmtNum(data.oro_compra_lps_gramo)}`
                  : t('Por confirmar', 'To confirm')}
              </span>
              {data?.oro_compra_lps_gramo != null && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: 'var(--slate)',
                  }}
                >
                  {t('por gramo', 'per gram')}
                </span>
              )}
            </div>
            <p
              style={{
                marginTop: 12,
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--t2)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {showBuyFactor
                ? t(
                    `Equivale al ${Math.round((data?.mape_factor ?? 0.8) * 100)}% del precio internacional del oro. Pago en Lempiras en su cuenta de FINACOOP.`,
                    `${Math.round((data?.mape_factor ?? 0.8) * 100)}% of the international gold price. Paid in Lempiras to your FINACOOP account.`,
                  )
                : t(
                    'Precio de compra en Lempiras. Pago en su cuenta de FINACOOP.',
                    'Purchase price in Lempiras. Paid to your FINACOOP account.',
                  )}
            </p>
          </div>

          {/* Secondary metrics grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 14,
            }}
          >
            <MetricCard
              eyebrow={t('Oro internacional', 'International gold')}
              value={data?.oro_usd_oz != null ? `$${fmtNum(data.oro_usd_oz)}` : '—'}
              unit={t('USD / onza troy', 'USD / troy oz')}
              detail={
                data?.oro_lps_oz != null
                  ? t(`≈ L ${fmtNum(data.oro_lps_oz)} / onza`, `≈ L ${fmtNum(data.oro_lps_oz)} / oz`)
                  : undefined
              }
            />
            <MetricCard
              eyebrow={t('Plata internacional', 'International silver')}
              value={data?.plata_usd_oz != null ? `$${fmtNum(data.plata_usd_oz)}` : '—'}
              unit={t('USD / onza troy', 'USD / troy oz')}
            />
            <MetricCard
              eyebrow={t('Tipo de cambio', 'Exchange rate')}
              value={data?.usd_hnl != null ? `L ${fmtNum(data.usd_hnl, 4)}` : '—'}
              unit={t('por USD', 'per USD')}
            />
            <MetricCard
              eyebrow={t('Diésel Honduras', 'Honduras diesel')}
              value={data?.diesel != null ? `L ${fmtNum(data.diesel.precio_hnl)}` : '—'}
              unit={
                data?.diesel != null
                  ? t(`por ${data.diesel.unidad}`, `per ${data.diesel.unidad}`)
                  : t('por galón', 'per gallon')
              }
              detail={
                data?.diesel != null
                  ? t(
                      `Vigente ${fmtDate(data.diesel.vigente_desde, 'es')} · ${data.diesel.zona}`,
                      `From ${fmtDate(data.diesel.vigente_desde, 'en')} · ${data.diesel.zona}`,
                    )
                  : undefined
              }
            />
          </div>

          {/* Other fuels — compact reference row */}
          {otros.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 20px',
                padding: '12px 16px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              {otros.map((c) => (
                <span
                  key={c.combustible}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--slate)',
                  }}
                >
                  {COMBUSTIBLE_LABELS[c.combustible]}:{' '}
                  <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>
                    L {fmtNum(c.precio_hnl)}
                  </strong>
                  <span style={{ color: 'var(--t3)' }}> /{c.unidad}</span>
                </span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1.5,
              color: 'var(--t3)',
            }}
          >
            {data?.consultado_hn && (
              <span>
                {t('Actualizado:', 'Updated:')} {data.consultado_hn} {t('(Honduras)', '(Honduras)')}
                {data.fuente ? ` · ${t('Fuente', 'Source')}: ${data.fuente}` : ''}
              </span>
            )}
            <span>
              {t(
                'Oro y plata: precios internacionales de referencia (goldapi.io / Yahoo COMEX). Los mercados cierran los fines de semana; el valor se actualiza el lunes.',
                'Gold and silver: international reference prices (goldapi.io / Yahoo COMEX). Markets close on weekends; values update Monday.',
              )}
            </span>
            <span>
              {t(
                'Diésel y combustibles: precio oficial de la Secretaría de Energía (SEN), fijado semanalmente.',
                'Diesel and fuels: official Secretaría de Energía (SEN) price, set weekly.',
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  eyebrow,
  value,
  unit,
  detail,
}: {
  eyebrow: string;
  value: string;
  unit: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 'clamp(16px, 3vw, 20px)',
        boxShadow: SHADOW_SM,
        display: 'flex',
        flexDirection: 'column',
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
          color: 'var(--slate)',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(24px, 4vw, 30px)',
          lineHeight: 1.05,
          color: 'var(--earth)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t3)' }}>
        {unit}
      </div>
      {detail && (
        <div style={{ fontSize: 12, color: 'var(--slate)', fontFamily: 'var(--font-body)' }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// Static skeleton (no animate-pulse per DESIGN.md §4).
function PriceSkeleton() {
  const box = (h: number) => (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        height: h,
        boxShadow: SHADOW_SM,
      }}
    />
  );
  return (
    <div>
      <div style={{ marginBottom: 16 }}>{box(140)}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 14,
        }}
      >
        {box(120)}
        {box(120)}
        {box(120)}
        {box(120)}
      </div>
    </div>
  );
}
