'use client';

// Price history chart for /precios — the daily 8 AM snapshots from
// precios_diarios plotted over time so a miner or buyer can verify how the
// purchase price has moved across days, months and (as the record grows) years.
//
// Design notes (DESIGN.md + dataviz method):
// - Single series per view, one axis — the metric selector swaps which series
//   is plotted instead of ever stacking two scales on one chart.
// - Line 2px round join, area wash at 10% opacity, ≥8px end dot with a 2px
//   surface ring. Hairline solid gridlines. Text wears text tokens, never the
//   series color.
// - Crosshair + tooltip on hover/touch; the same readout is reachable by
//   keyboard (arrow keys) and everything is also available in the table view.
// - No continuous animations; static skeleton. Zero hex — tokens only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Lang = 'es' | 'en';

interface HistoryPoint {
  fecha: string; // YYYY-MM-DD
  oro_usd_oz: number | null;
  usd_hnl: number | null;
  oro_lps_oz: number | null;
  oro_compra_lps_gramo: number | null;
}

interface HistoryResponse {
  puntos: HistoryPoint[];
}

type MetricKey = 'compra' | 'oro_usd' | 'oro_lps' | 'tc';
type RangeKey = '7d' | '1m' | '3m' | '1y' | 'all';

interface MetricDef {
  key: MetricKey;
  label: (t: T) => string;
  unit: (t: T) => string;
  prefix: string;
  decimals: number;
  value: (p: HistoryPoint) => number | null;
}

type T = (es: string, en: string) => string;

const METRICS: MetricDef[] = [
  {
    key: 'compra',
    label: (t) => t('Referencia MAPE.LEGAL', 'MAPE.LEGAL reference'),
    unit: (t) => t('L por gramo de oro fino', 'L per gram of fine gold'),
    prefix: 'L ',
    decimals: 2,
    value: (p) => p.oro_compra_lps_gramo,
  },
  {
    key: 'oro_usd',
    label: (t) => t('Oro internacional', 'International gold'),
    unit: (t) => t('USD por onza troy', 'USD per troy oz'),
    prefix: '$',
    decimals: 2,
    value: (p) => p.oro_usd_oz,
  },
  {
    key: 'oro_lps',
    label: (t) => t('Oro en Lempiras', 'Gold in Lempiras'),
    unit: (t) => t('L por onza troy', 'L per troy oz'),
    prefix: 'L ',
    decimals: 0,
    value: (p) => p.oro_lps_oz,
  },
  {
    key: 'tc',
    label: (t) => t('Tipo de cambio', 'Exchange rate'),
    unit: (t) => t('L por USD', 'L per USD'),
    prefix: 'L ',
    decimals: 4,
    value: (p) => p.usd_hnl,
  },
];

const RANGES: Array<{ key: RangeKey; days: number; label: (t: T) => string }> = [
  { key: '7d', days: 7, label: () => '7D' },
  { key: '1m', days: 30, label: () => '1M' },
  { key: '3m', days: 90, label: () => '3M' },
  { key: '1y', days: 365, label: (t) => t('1A', '1Y') },
  { key: 'all', days: Infinity, label: (t) => t('Todo', 'All') },
];

const FETCH_DAYS = 1825; // one row per day — the full record is tiny
const FETCH_TIMEOUT_MS = 12_000;
const CHART_HEIGHT = 260;
const PAD = { top: 14, right: 18, bottom: 26, left: 56 };
const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtTick(n: number, step: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return n.toLocaleString('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00`);
}

// Axis tick dates are built by hand, not via toLocaleDateString: engines
// disagree on the short form (iOS Safari renders es-HN as "29 de jul de 26",
// ~2× wider than "29 jul 26"), and tick layout needs a predictable width.
const TICK_MONTHS: Record<Lang, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function fmtTickDate(fecha: string, lang: Lang, withYear: boolean): string {
  const d = parseFecha(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  const base = `${String(d.getDate()).padStart(2, '0')} ${TICK_MONTHS[lang][d.getMonth()]}`;
  return withYear ? `${base} ${String(d.getFullYear() % 100).padStart(2, '0')}` : base;
}

function fmtDateShort(fecha: string, lang: Lang, withYear: boolean): string {
  const d = parseFecha(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: '2-digit' } : {}),
  });
}

function fmtDateLong(fecha: string, lang: Lang): string {
  const d = parseFecha(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Clean y-axis ticks: snap the step to 1/2/5×10^k and cover [min, max].
function niceTicks(min: number, max: number, target = 4): { ticks: number[]; step: number } {
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const rawStep = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  // Index-multiplied (never accumulated) so float drift can't drop the covering
  // top tick — an excluded top tick shrinks the y-domain below the data max and
  // the line clips out of the plot.
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const count = Math.max(Math.round((end - start) / step), 1);
  const ticks = Array.from({ length: count + 1 }, (_, i) =>
    Number((start + i * step).toFixed(6)),
  );
  if (ticks[ticks.length - 1] < max) ticks.push(Number((end + step).toFixed(6)));
  return { ticks, step };
}

interface Props {
  lang: Lang;
}

export default function PriceHistoryChart({ lang }: Props) {
  const t = useCallback<T>((es, en) => (lang === 'es' ? es : en), [lang]);

  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [metricKey, setMetricKey] = useState<MetricKey>('compra');
  const [rangeKey, setRangeKey] = useState<RangeKey>('1m');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  // Element state (not a ref): the chart wrapper mounts only after loading
  // resolves, so a mount-time effect over a plain ref would observe null and
  // never re-attach. The callback-ref → state → effect chain attaches the
  // ResizeObserver whenever the element actually appears.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);

  // Fetch the full record once; range presets slice client-side (the payload is
  // one small row per day, so refetch-per-range would only add latency).
  useEffect(() => {
    mountedRef.current = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    (async () => {
      try {
        const res = await fetch(`/api/precios/historial?days=${FETCH_DAYS}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as HistoryResponse;
        if (!mountedRef.current) return;
        setPoints(Array.isArray(json.puntos) ? json.puntos : []);
        setError(false);
      } catch {
        if (!mountedRef.current) return;
        setError(true);
      } finally {
        window.clearTimeout(timer);
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  // Responsive width for pixel-accurate hover mapping.
  useEffect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setChartWidth(Math.round(w));
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];

  // Visible slice: last N days of the record with a value for this metric.
  const slice = useMemo(() => {
    if (!points) return [];
    const withValue = points.filter((p) => metric.value(p) != null);
    if (!Number.isFinite(range.days) || withValue.length === 0) return withValue;
    const last = parseFecha(withValue[withValue.length - 1].fecha).getTime();
    const cutoff = last - (range.days - 1) * 86_400_000;
    return withValue.filter((p) => parseFecha(p.fecha).getTime() >= cutoff);
  }, [points, metric, range]);

  const withYear = range.days > 180 || !Number.isFinite(range.days);

  const geom = useMemo(() => {
    if (slice.length < 2 || chartWidth < 120) return null;
    const values = slice.map((p) => metric.value(p) as number);
    const times = slice.map((p) => parseFecha(p.fecha).getTime());
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const { ticks, step } = niceTicks(vMin, vMax, 4);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const tMin = times[0];
    const tMax = times[times.length - 1];
    const innerW = chartWidth - PAD.left - PAD.right;
    const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const x = (ms: number) =>
      PAD.left + (tMax === tMin ? innerW / 2 : ((ms - tMin) / (tMax - tMin)) * innerW);
    const y = (v: number) =>
      PAD.top + (yMax === yMin ? innerH / 2 : ((yMax - v) / (yMax - yMin)) * innerH);
    const px = slice.map((p, i) => ({ cx: x(times[i]), cy: y(values[i]), i }));
    const linePath = px.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.cx.toFixed(1)},${pt.cy.toFixed(1)}`).join('');
    const baseline = PAD.top + innerH;
    const areaPath = `${linePath}L${px[px.length - 1].cx.toFixed(1)},${baseline}L${px[0].cx.toFixed(1)},${baseline}Z`;
    // X labels — chosen by PIXEL position, not index. The record is sparse and
    // unevenly spaced in time (a dense stretch, then gaps), so spreading label
    // *indices* evenly bunches several labels onto nearly the same x when their
    // points cluster in time — they render on top of each other. Instead: aim
    // at evenly spaced pixel targets, snap each to the nearest data point, and
    // drop any middle label that would collide with an already-kept one. The
    // count also adapts to the plot width so narrow phones get 2 labels, not 4.
    const labelW = withYear ? 66 : 44; // "29 jul 26" / "29 jul" at 10px mono
    const labelCount = Math.max(2, Math.min(5, Math.floor(innerW / (labelW * 1.5 + 8)) + 1));
    const firstPt = px[0];
    const lastPt = px[px.length - 1];
    let xLabels: Array<{ idx: number; cx: number }> = [{ idx: 0, cx: firstPt.cx }];
    for (let k = 1; k < labelCount - 1; k++) {
      const targetX = firstPt.cx + (k * (lastPt.cx - firstPt.cx)) / (labelCount - 1);
      let bestI = 0;
      let bestD = Infinity;
      for (const pt of px) {
        const d = Math.abs(pt.cx - targetX);
        if (d < bestD) {
          bestD = d;
          bestI = pt.i;
        }
      }
      if (bestI === 0 || bestI === px.length - 1) continue;
      const cand = px[bestI];
      const prev = xLabels[xLabels.length - 1];
      // The first label is start-anchored (extends right ~labelW); middles are
      // centered (±labelW/2); the last is end-anchored (extends left ~labelW).
      const prevRightEdge = prev.idx === 0 ? prev.cx + labelW : prev.cx + labelW / 2;
      const fitsPrev = cand.cx - labelW / 2 >= prevRightEdge + 8;
      const fitsLast = cand.cx + labelW / 2 <= lastPt.cx - labelW - 8;
      if (fitsPrev && fitsLast) xLabels.push({ idx: bestI, cx: cand.cx });
    }
    xLabels.push({ idx: slice.length - 1, cx: lastPt.cx });
    // Ultra-narrow guard: if even the two endpoint labels collide, keep the end.
    if (xLabels.length === 2 && xLabels[1].cx - xLabels[0].cx < labelW * 2 + 8) {
      xLabels = [xLabels[1]];
    }
    return { ticks, step, px, linePath, areaPath, baseline, xLabels };
  }, [slice, metric, chartWidth, withYear]);

  const stats = useMemo(() => {
    if (slice.length < 2) return null;
    const first = metric.value(slice[0]) as number;
    const last = metric.value(slice[slice.length - 1]) as number;
    const values = slice.map((p) => metric.value(p) as number);
    const delta = last - first;
    const pct = first !== 0 ? (delta / first) * 100 : 0;
    return { delta, pct, min: Math.min(...values), max: Math.max(...values) };
  }, [slice, metric]);

  // Crosshair: snap the pointer to the nearest data x.
  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!geom) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      let best = 0;
      let bestDist = Infinity;
      for (const pt of geom.px) {
        const d = Math.abs(pt.cx - px);
        if (d < bestDist) {
          bestDist = d;
          best = pt.i;
        }
      }
      setActiveIdx(best);
    },
    [geom],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!geom || slice.length === 0) return;
      const lastIdx = slice.length - 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIdx((cur) => {
          const base = cur ?? lastIdx;
          const next = e.key === 'ArrowLeft' ? base - 1 : base + 1;
          return Math.min(Math.max(next, 0), lastIdx);
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIdx(lastIdx);
      } else if (e.key === 'Escape') {
        setActiveIdx(null);
      }
    },
    [geom, slice.length],
  );

  const active = activeIdx != null && slice[activeIdx] ? slice[activeIdx] : null;
  const activeGeom = activeIdx != null && geom ? geom.px[activeIdx] : null;

  // Tooltip position, clamped inside the plot.
  const tooltipStyle: React.CSSProperties | null =
    active && activeGeom && chartWidth > 0
      ? {
          position: 'absolute',
          top: Math.max(activeGeom.cy - 64, 4),
          left: Math.max(Math.min(Math.max(activeGeom.cx + 12, 8), chartWidth - 168), 4),
          pointerEvents: 'none',
          zIndex: 2,
        }
      : null;

  const deltaDir = stats == null || Math.abs(stats.pct) < 0.005 ? 'flat' : stats.delta > 0 ? 'up' : 'down';
  const deltaToken = deltaDir === 'up' ? 'var(--green)' : deltaDir === 'down' ? 'var(--red)' : 'var(--slate)';

  const segBtn = (isActive: boolean): React.CSSProperties => ({
    padding: '7px 12px',
    borderRadius: 8,
    border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
    background: isActive ? 'var(--ink)' : 'transparent',
    color: isActive ? '#fff' : 'var(--t2)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: SHADOW_SM,
        padding: 'clamp(18px, 4vw, 28px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--slate)',
              marginBottom: 6,
            }}
          >
            {t('Historial de precios', 'Price history')}
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'clamp(20px, 3vw, 24px)',
              lineHeight: 1.2,
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            {metric.label(t)}{' '}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--t3)',
              }}
            >
              · {metric.unit(t)}
            </span>
          </h2>
        </div>

        {/* Range delta pill */}
        {stats && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              background: `color-mix(in oklch, ${deltaToken} 14%, white)`,
              border: `1px solid color-mix(in oklch, ${deltaToken} 30%, white)`,
              color: deltaToken,
            }}
          >
            <span aria-hidden>{deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '■'}</span>
            {`${stats.delta >= 0 ? '+' : '−'}${fmtNum(Math.abs(stats.delta), metric.decimals)} (${stats.pct >= 0 ? '+' : '−'}${fmtNum(Math.abs(stats.pct), 1)}%)`}
            <span style={{ fontWeight: 500, color: 'var(--slate)' }}>
              {t('en el período', 'over period')}
            </span>
          </span>
        )}
      </div>

      {/* Controls — one row above the chart */}
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
        <div role="group" aria-label={t('Rango de fechas', 'Date range')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRangeKey(r.key);
                setActiveIdx(null); // the hovered index no longer maps to the new slice
              }}
              aria-pressed={rangeKey === r.key}
              style={segBtn(rangeKey === r.key)}
            >
              {r.label(t)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('Métrica', 'Metric')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMetricKey(m.key);
                setActiveIdx(null);
              }}
              aria-pressed={metricKey === m.key}
              style={segBtn(metricKey === m.key)}
            >
              {m.label(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      {error && points == null ? (
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
            'No pudimos cargar el historial. Intenta de nuevo en un momento.',
            'We could not load the history. Please try again shortly.',
          )}
        </div>
      ) : loading ? (
        <div
          style={{
            height: CHART_HEIGHT,
            borderRadius: 12,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
          }}
        />
      ) : slice.length < 2 ? (
        <div
          style={{
            height: CHART_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
            padding: 24,
            textAlign: 'center',
            color: 'var(--t2)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {t(
            'Aún no hay suficientes datos registrados en este rango. El historial crece un punto por día con la captura de las 8:00 a.m.',
            'Not enough recorded data in this range yet. The record grows by one point per day with the 8:00 a.m. capture.',
          )}
        </div>
      ) : (
        <div
          ref={setContainerEl}
          tabIndex={0}
          role="img"
          aria-label={t(
            `Gráfica de ${metric.label(t)} (${metric.unit(t)}), ${slice.length} días. Usa las flechas para recorrer los valores; los datos también están en la tabla.`,
            `Chart of ${metric.label(t)} (${metric.unit(t)}), ${slice.length} days. Use arrow keys to step through values; the data is also in the table.`,
          )}
          onKeyDown={handleKey}
          onBlur={() => setActiveIdx(null)}
          style={{ position: 'relative', outline: 'none', touchAction: 'pan-y' }}
        >
          <svg
            width="100%"
            height={CHART_HEIGHT}
            viewBox={`0 0 ${Math.max(chartWidth, 120)} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActiveIdx(null)}
            style={{ display: 'block' }}
          >
            {geom && (
              <>
                {/* Gridlines + y ticks */}
                {geom.ticks.map((v) => {
                  const cy = PAD.top + ((geom.ticks[geom.ticks.length - 1] - v) / (geom.ticks[geom.ticks.length - 1] - geom.ticks[0])) * (CHART_HEIGHT - PAD.top - PAD.bottom);
                  return (
                    <g key={v}>
                      <line x1={PAD.left} x2={chartWidth - PAD.right} y1={cy} y2={cy} stroke="var(--border)" strokeWidth={1} />
                      <text
                        x={PAD.left - 8}
                        y={cy + 3.5}
                        textAnchor="end"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fill: 'var(--t3)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmtTick(v, geom.step)}
                      </text>
                    </g>
                  );
                })}

                {/* X labels */}
                {geom.xLabels.map(({ idx, cx }) => (
                  <text
                    key={idx}
                    x={cx}
                    y={CHART_HEIGHT - 8}
                    textAnchor={idx === 0 ? 'start' : idx === slice.length - 1 ? 'end' : 'middle'}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--t3)' }}
                  >
                    {fmtTickDate(slice[idx].fecha, lang, withYear)}
                  </text>
                ))}

                {/* Area wash + line */}
                <path d={geom.areaPath} fill="var(--moss)" fillOpacity={0.1} />
                <path
                  d={geom.linePath}
                  fill="none"
                  stroke="var(--moss)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* End dot with surface ring */}
                <circle
                  cx={geom.px[geom.px.length - 1].cx}
                  cy={geom.px[geom.px.length - 1].cy}
                  r={4.5}
                  fill="var(--moss)"
                  stroke="var(--bg)"
                  strokeWidth={2}
                />

                {/* Crosshair + active dot */}
                {activeGeom && (
                  <>
                    <line
                      x1={activeGeom.cx}
                      x2={activeGeom.cx}
                      y1={PAD.top}
                      y2={geom.baseline}
                      stroke="var(--slate-lt)"
                      strokeWidth={1}
                    />
                    <circle
                      cx={activeGeom.cx}
                      cy={activeGeom.cy}
                      r={4.5}
                      fill="var(--moss)"
                      stroke="var(--bg)"
                      strokeWidth={2}
                    />
                  </>
                )}
              </>
            )}
          </svg>

          {/* Tooltip */}
          {active && tooltipStyle && (
            <div
              style={{
                ...tooltipStyle,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(31,42,56,0.10)',
                padding: '8px 12px',
                minWidth: 150,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {`${metric.prefix}${fmtNum(metric.value(active) as number, metric.decimals)}`}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--slate)',
                }}
              >
                <span aria-hidden style={{ width: 10, height: 2, background: 'var(--moss)', display: 'inline-block' }} />
                {fmtDateLong(active.fecha, lang)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meta + table toggle */}
      {slice.length >= 2 && stats && (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1.6,
              color: 'var(--t3)',
            }}
          >
            <span>
              {t('Mín', 'Min')}: {metric.prefix}
              {fmtNum(stats.min, metric.decimals)} · {t('Máx', 'Max')}: {metric.prefix}
              {fmtNum(stats.max, metric.decimals)} · {slice.length} {t('días registrados', 'days recorded')}
            </span>
            <br />
            <span>
              {t(
                'Un punto por día — captura de las 8:00 a.m. (Honduras). Los mercados cierran los fines de semana.',
                'One point per day — the 8:00 a.m. (Honduras) capture. Markets close on weekends.',
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-expanded={showTable}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--t2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {showTable ? t('Ocultar tabla', 'Hide table') : t('Ver tabla', 'View table')}
          </button>
        </div>
      )}

      {/* Table view — every plotted value reachable without hovering */}
      {showTable && slice.length >= 2 && (
        <div
          style={{
            marginTop: 14,
            maxHeight: 320,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  t('Fecha', 'Date'),
                  t('Compra (L/g)', 'Buy (L/g)'),
                  t('Oro (USD/oz)', 'Gold (USD/oz)'),
                  t('Oro (L/oz)', 'Gold (L/oz)'),
                  t('TC (L/USD)', 'FX (L/USD)'),
                ].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: 'var(--ink)',
                      color: '#fff',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      textAlign: i === 0 ? 'left' : 'right',
                      padding: '10px 12px',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...slice].reverse().map((p) => (
                <tr key={p.fecha} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--t1)', fontFamily: 'var(--font-body)' }}>
                    {fmtDateShort(p.fecha, lang, true)}
                  </td>
                  {[
                    p.oro_compra_lps_gramo != null ? `L ${fmtNum(p.oro_compra_lps_gramo, 2)}` : '—',
                    p.oro_usd_oz != null ? `$${fmtNum(p.oro_usd_oz, 2)}` : '—',
                    p.oro_lps_oz != null ? `L ${fmtNum(p.oro_lps_oz, 0)}` : '—',
                    p.usd_hnl != null ? `L ${fmtNum(p.usd_hnl, 4)}` : '—',
                  ].map((cell, i) => (
                    <td
                      key={i}
                      style={{
                        padding: '8px 12px',
                        color: 'var(--t1)',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
