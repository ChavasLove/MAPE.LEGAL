'use client';

import { useRef, useEffect } from 'react';
import {
  MINING_SITES,
  STATUS_COLORS,
  TYPE_COLORS,
  STATUS_LABELS_ES,
  STATUS_LABELS_EN,
  TYPE_LABELS_ES,
  TYPE_LABELS_EN,
} from './mining-data';
import type { MiningSite } from './mining-data';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface SiteInfoPanelProps {
  site: MiningSite | null;
  lang: 'es' | 'en';
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function SiteInfoPanel({ site, lang, onClose }: SiteInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (site && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [site?.id]);

  // ---- empty state ----
  if (!site) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          textAlign: 'center',
          gap: 16,
          color: 'var(--t3)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ opacity: 0.4 }}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l2 2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
        <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 220 }}>
          {lang === 'es'
            ? 'Seleccione un sitio minero en el mapa para ver sus detalles.'
            : 'Select a mining site on the map to view its details.'}
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            color: 'var(--slate-lt)',
            marginTop: 8,
          }}
        >
          {MINING_SITES.length}{' '}
          {lang === 'es' ? 'sitios registrados' : 'sites registered'}
        </div>
      </div>
    );
  }

  // ---- labels ----
  const typeLabels = lang === 'es' ? TYPE_LABELS_ES : TYPE_LABELS_EN;
  const statusLabels = lang === 'es' ? STATUS_LABELS_ES : STATUS_LABELS_EN;
  const typeLabel = typeLabels[site.type] ?? site.type;
  const statusLabel = statusLabels[site.status] ?? site.status;
  const typeColor = TYPE_COLORS[site.type] ?? 'var(--earth)';
  const statusColor = STATUS_COLORS[site.status] ?? 'var(--t3)';

  return (
    <div
      ref={panelRef}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ---- header ---- */}
      <div
        style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
        }}
      >
        {/* close button */}
        <button
          onClick={onClose}
          aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--t3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            lineHeight: 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ink)';
            e.currentTarget.style.color = 'var(--ink)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--t3)';
          }}
        >
          &times;
        </button>

        {/* badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <Badge label={typeLabel} color={typeColor} />
          <Badge label={statusLabel} color={statusColor} />
        </div>

        {/* name */}
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            paddingRight: 36,
          }}
        >
          {lang === 'es' ? site.nameEs : site.name}
        </h3>

        {/* location */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--slate)',
            marginTop: 6,
            fontWeight: 500,
          }}
        >
          {site.department} &mdash; {site.municipality}
        </div>
      </div>

      {/* ---- body ---- */}
      <div
        style={{
          padding: '16px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* description */}
        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, margin: 0 }}>
          {lang === 'es' ? site.descriptionEs : site.descriptionEn}
        </p>

        {/* detail grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 4,
          }}
        >
          {site.owner && (
            <DetailField
              label={lang === 'es' ? 'Operador' : 'Operator'}
              value={site.owner}
            />
          )}
          {site.since && (
            <DetailField
              label={lang === 'es' ? 'Desde' : 'Since'}
              value={site.since}
            />
          )}
          {site.production && (
            <DetailField
              label={lang === 'es' ? 'Producción' : 'Production'}
              value={site.production}
              colSpan={2}
            />
          )}
        </div>

        {/* commodities */}
        {site.commodities && site.commodities.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--t3)',
                marginBottom: 8,
              }}
            >
              {lang === 'es' ? 'Minerales' : 'Minerals'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {site.commodities.map((c) => (
                <span
                  key={c}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* coordinates */}
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--t3)',
              marginBottom: 4,
            }}
          >
            {lang === 'es' ? 'Coordenadas' : 'Coordinates'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink)',
              letterSpacing: '0.02em',
            }}
          >
            {site.coordinates[1].toFixed(4)}
            &deg;N, {Math.abs(site.coordinates[0]).toFixed(4)}
            &deg;W
          </div>
        </div>

        {(site.status === 'active' || site.status === 'inactive') && (
          <a
            href={`https://wa.me/50497373139?text=${encodeURIComponent(
              lang === 'es'
                ? `Hola María, me interesa explorar formalización para ${site.nameEs} (${site.department} — ${site.municipality}).`
                : `Hi María, I'd like to explore formalization for ${site.name} (${site.department} — ${site.municipality}).`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 4,
              padding: '11px 14px',
              borderRadius: 8,
              background: 'var(--moss)',
              color: 'white',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in oklch, var(--moss) 88%, black)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--moss)';
            }}
          >
            {lang === 'es' ? 'Iniciar trámite con CHT' : 'Begin formalization with CHT'}
          </a>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: `color-mix(in oklch, ${color} 12%, white)`,
        color,
        border: `1px solid color-mix(in oklch, ${color} 25%, white)`,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}

function DetailField({
  label,
  value,
  colSpan = 1,
}: {
  label: string;
  value: string;
  colSpan?: number;
}) {
  return (
    <div
      style={{
        gridColumn: colSpan === 2 ? '1 / -1' : undefined,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--t3)',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}
