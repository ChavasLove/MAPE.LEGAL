'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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
}

const TYPE_LABELS: Record<'es' | 'en', Record<MineType, string>> = {
  es: TYPE_LABELS_ES,
  en: TYPE_LABELS_EN,
};

const MOBILE_QUERY = '(max-width: 639px)';

export default function MapLegend({ lang, value, onChange }: MapLegendProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Detect mobile viewport; on mobile, default the legend to collapsed
  // and pin it to the bottom so it doesn't collide with MapLibre's
  // top-right navigation controls at narrow widths.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      if (matches) setCollapsed(true);
    };
    apply(mql.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const allOn = value.size === MINE_TYPE_ORDER.length;

  const toggle = (type: MineType) => {
    const next = new Set(value);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    // Disallow empty selection — re-enable everything instead of an empty map.
    if (next.size === 0) {
      onChange(new Set(MINE_TYPE_ORDER));
      return;
    }
    onChange(next);
  };

  const showAll = () => onChange(new Set(MINE_TYPE_ORDER));

  return (
    <div
      style={{
        position: 'absolute',
        ...(isMobile
          ? { bottom: 16, left: 16, right: 16, top: 'auto' }
          : { top: 16, left: 16 }),
        zIndex: 10,
        background: 'color-mix(in oklch, var(--bg) 96%, transparent)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px color-mix(in oklch, var(--ink) 10%, transparent)',
        padding: collapsed ? '8px 12px' : '12px 14px',
        minWidth: collapsed || isMobile ? 'auto' : 200,
        maxWidth: isMobile ? 'none' : 240,
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
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: active
                        ? color
                        : `color-mix(in oklch, ${color} 28%, white)`,
                      flexShrink: 0,
                      boxShadow: active
                        ? '0 1px 3px color-mix(in oklch, var(--ink) 18%, transparent)'
                        : 'none',
                      transition: 'background 0.15s',
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
