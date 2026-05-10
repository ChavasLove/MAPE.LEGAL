'use client';

import { useState } from 'react';
import {
  TYPE_COLORS,
  TYPE_LABELS_ES,
  TYPE_LABELS_EN,
  STATUS_COLORS,
  STATUS_LABELS_ES,
  STATUS_LABELS_EN,
} from './mining-data';

interface MapLegendProps {
  lang: 'es' | 'en';
}

const TYPE_LABELS: Record<string, Record<string, string>> = {
  es: TYPE_LABELS_ES,
  en: TYPE_LABELS_EN,
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  es: STATUS_LABELS_ES,
  en: STATUS_LABELS_EN,
};

export default function MapLegend({ lang }: MapLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  const typeEntries = Object.entries(TYPE_COLORS);
  const statusEntries = Object.entries(STATUS_COLORS);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(31,42,56,0.1)',
        padding: collapsed ? '8px 12px' : '14px 16px',
        minWidth: collapsed ? 'auto' : 180,
        maxWidth: 220,
        transition: 'all 0.2s ease',
      }}
    >
      {/* toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
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
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--earth)',
          }}
        >
          {lang === 'es' ? 'Leyenda' : 'Legend'}
        </span>
        <span
          style={{
            fontSize: 14,
            color: 'var(--t3)',
            lineHeight: 1,
            transition: 'transform 0.2s ease',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          &#9662;
        </span>
      </button>

      {!collapsed && (
        <>
          {/* types */}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {typeEntries.map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 500 }}>
                  {TYPE_LABELS[lang]?.[type] ?? type}
                </span>
              </div>
            ))}
          </div>

          {/* divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />

          {/* statuses */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {statusEntries.map(([status, color]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    border: `2px solid ${color}`,
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 500 }}>
                  {STATUS_LABELS[lang]?.[status] ?? status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
