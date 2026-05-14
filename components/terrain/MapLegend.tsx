'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  TYPE_COLORS,
  TYPE_LABELS_ES,
  TYPE_LABELS_EN,
  MINE_TYPE_ORDER,
} from './mining-data';
import type { MineType } from './mining-data';

interface MapLegendProps {
  lang: 'es' | 'en';
  value: Set<MineType>;
  onChange: (next: Set<MineType>) => void;
  isMobile: boolean;
}

const TYPE_LABELS: Record<'es' | 'en', Record<MineType, string>> = {
  es: TYPE_LABELS_ES,
  en: TYPE_LABELS_EN,
};

export default function MapLegend({ lang, value, onChange, isMobile }: MapLegendProps) {
  const allOn = value.size === MINE_TYPE_ORDER.length;

  const toggle = (type: MineType) => {
    const next = new Set(value);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (next.size === 0) {
      // Disallow empty selection — re-enable everything instead of an empty map.
      onChange(new Set(MINE_TYPE_ORDER));
      return;
    }
    onChange(next);
  };

  const showAll = () => onChange(new Set(MINE_TYPE_ORDER));

  if (isMobile) {
    return (
      <MobileChipRow
        lang={lang}
        value={value}
        toggle={toggle}
        showAll={showAll}
        allOn={allOn}
      />
    );
  }

  return (
    <DesktopList
      lang={lang}
      value={value}
      toggle={toggle}
      showAll={showAll}
      allOn={allOn}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: horizontal-scroll chip row                                  */
/* ------------------------------------------------------------------ */

function MobileChipRow({
  lang,
  value,
  toggle,
  showAll,
  allOn,
}: {
  lang: 'es' | 'en';
  value: Set<MineType>;
  toggle: (t: MineType) => void;
  showAll: () => void;
  allOn: boolean;
}) {
  const activeCount = value.size;
  const total = MINE_TYPE_ORDER.length;

  return (
    <div
      role="group"
      aria-label={lang === 'es' ? 'Filtrar por mineral' : 'Filter by mineral'}
      className="mining-chip-row"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'color-mix(in oklch, var(--bg) 96%, transparent)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        boxShadow: '0 2px 12px color-mix(in oklch, var(--ink) 10%, transparent)',
        maxWidth: 'calc(100% - 24px)',
      }}
    >
      {/* horizontal scroll list */}
      <div
        className="mining-chip-scroller"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          flex: 1,
          minWidth: 0,
        }}
      >
        {MINE_TYPE_ORDER.map((type) => {
          const color = TYPE_COLORS[type];
          const label = TYPE_LABELS[lang][type];
          const active = value.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              aria-pressed={active}
              style={{
                flexShrink: 0,
                scrollSnapAlign: 'start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: active
                  ? `color-mix(in oklch, ${color} 14%, white)`
                  : 'transparent',
                border: `1px solid ${
                  active ? `color-mix(in oklch, ${color} 32%, white)` : 'var(--border)'
                }`,
                borderRadius: 999,
                cursor: 'pointer',
                color: active ? 'var(--ink)' : 'var(--t3)',
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                minHeight: 28,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: active ? color : `color-mix(in oklch, ${color} 30%, white)`,
                }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* counter / reset */}
      {!allOn ? (
        <button
          type="button"
          onClick={showAll}
          aria-label={lang === 'es' ? 'Mostrar todos' : 'Show all'}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            background: 'var(--ink)',
            color: 'white',
            border: 'none',
            borderRadius: 999,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 26,
          }}
        >
          <span>{activeCount} / {total}</span>
          <X size={12} strokeWidth={2} />
        </button>
      ) : (
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--slate)',
            padding: '4px 8px',
          }}
        >
          {activeCount} / {total}
        </span>
      )}

      {/* hide WebKit scrollbar */}
      <style>{`
        .mining-chip-scroller::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop: collapsible vertical list                                  */
/* ------------------------------------------------------------------ */

function DesktopList({
  lang,
  value,
  toggle,
  showAll,
  allOn,
}: {
  lang: 'es' | 'en';
  value: Set<MineType>;
  toggle: (t: MineType) => void;
  showAll: () => void;
  allOn: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        background: 'color-mix(in oklch, var(--bg) 96%, transparent)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px color-mix(in oklch, var(--ink) 10%, transparent)',
        padding: collapsed ? '8px 12px' : '12px 14px',
        minWidth: collapsed ? 'auto' : 200,
        maxWidth: 240,
        transition: 'padding 0.2s ease',
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={lang === 'es' ? 'Alternar filtro de mineral' : 'Toggle mineral filter'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          gap: 12,
          color: 'var(--ink)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--earth)',
          }}
        >
          {lang === 'es' ? 'Mineral' : 'Mineral'}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          aria-hidden
          style={{
            color: 'var(--t3)',
            transition: 'transform 0.2s ease',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {!collapsed && (
        <>
          <p
            style={{
              margin: '6px 0 10px',
              fontSize: 11,
              lineHeight: 1.45,
              color: 'var(--slate)',
            }}
          >
            {lang === 'es'
              ? 'El color del pin indica el mineral. Toque para filtrar.'
              : 'Pin color indicates the mineral. Tap to filter.'}
          </p>

          <div
            role="group"
            aria-label={lang === 'es' ? 'Filtrar por mineral' : 'Filter by mineral'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {MINE_TYPE_ORDER.map((type) => {
              const color = TYPE_COLORS[type];
              const label = TYPE_LABELS[lang][type];
              const active = value.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggle(type)}
                  aria-pressed={active}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '5px 8px',
                    background: active
                      ? `color-mix(in oklch, ${color} 12%, white)`
                      : 'transparent',
                    border: `1px solid ${
                      active
                        ? `color-mix(in oklch, ${color} 30%, white)`
                        : 'transparent'
                    }`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background =
                        'color-mix(in oklch, var(--ink) 4%, transparent)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: active
                        ? color
                        : `color-mix(in oklch, ${color} 28%, white)`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: active ? 'var(--ink)' : 'var(--t3)',
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {!allOn && (
            <button
              type="button"
              onClick={showAll}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--ink)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--ink)';
                e.currentTarget.style.background =
                  'color-mix(in oklch, var(--ink) 4%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {lang === 'es' ? 'Mostrar todos' : 'Show all'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
