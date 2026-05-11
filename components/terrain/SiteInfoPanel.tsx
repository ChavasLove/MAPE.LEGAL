'use client';

import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Compass } from 'lucide-react';
import {
  MINING_SITES,
  STATUS_COLORS,
  TYPE_COLORS,
  STATUS_LABELS_ES,
  STATUS_LABELS_EN,
  TYPE_LABELS_ES,
  TYPE_LABELS_EN,
  COMMODITY_LABELS_ES,
} from './mining-data';
import type { MiningSite } from './mining-data';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface SiteInfoPanelProps {
  site: MiningSite | null;
  lang: 'es' | 'en';
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function SiteInfoPanel({
  site,
  lang,
  onClose,
  onPrev,
  onNext,
  position,
}: SiteInfoPanelProps) {
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
        <Compass size={44} strokeWidth={1.5} aria-hidden style={{ opacity: 0.45 }} />
        <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 240, color: 'var(--t2)' }}>
          {lang === 'es'
            ? 'Toque un sitio en el mapa para conocer su contexto y los mineros que operan en la zona.'
            : 'Tap a site on the map to view its context and the miners operating in the area.'}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            color: 'var(--slate-lt)',
            marginTop: 4,
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
      {/* ---- nav row (Prev / position / Next  …  Close) ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 0',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconButton
            label={lang === 'es' ? 'Sitio anterior' : 'Previous site'}
            onClick={onPrev}
            disabled={!onPrev}
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={lang === 'es' ? 'Siguiente sitio' : 'Next site'}
            onClick={onNext}
            disabled={!onNext}
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </IconButton>
          {position && (
            <span
              style={{
                marginLeft: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--slate)',
                letterSpacing: '0.04em',
              }}
            >
              {lang === 'es'
                ? `Sitio ${position.index} de ${position.total}`
                : `Site ${position.index} of ${position.total}`}
            </span>
          )}
        </div>
        <IconButton
          label={lang === 'es' ? 'Cerrar' : 'Close'}
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      {/* ---- header (badges + name + location) ---- */}
      <div
        style={{
          padding: '12px 20px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <Badge label={typeLabel} color={typeColor} />
          <Badge label={statusLabel} color={statusColor} />
        </div>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {lang === 'es' ? site.nameEs : site.name}
        </h3>
        <div
          style={{
            fontSize: 12,
            color: 'var(--slate)',
            marginTop: 6,
            fontWeight: 500,
          }}
        >
          {site.department} &middot; {site.municipality}
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
        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, margin: 0 }}>
          {lang === 'es' ? site.descriptionEs : site.descriptionEn}
        </p>

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

        {site.commodities && site.commodities.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.18em',
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
                  {lang === 'es' ? COMMODITY_LABELS_ES[c] ?? c : c}
                </span>
              ))}
            </div>
          </div>
        )}

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
              letterSpacing: '0.18em',
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
            &deg;{lang === 'es' ? 'N' : 'N'}, {Math.abs(site.coordinates[0]).toFixed(4)}
            &deg;{lang === 'es' ? 'O' : 'W'}
          </div>
        </div>

        {/* CTA — every site frames itself as a district where artisanal /
            small-scale miners operate; they are the audience, not the
            corporate operator listed above. */}
        <a
          href={`https://wa.me/50497373139?text=${encodeURIComponent(
            lang === 'es'
              ? `Buenas, soy minero artesanal en la zona de ${site.nameEs} (${site.department}, ${site.municipality}). Quisiera información sobre formalización con CHT.`
              : `Hi, I'm an artisanal miner working near ${site.name} (${site.department}, ${site.municipality}). I'd like information about formalizing with CHT.`
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
            e.currentTarget.style.background =
              'color-mix(in oklch, var(--moss) 88%, white)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--moss)';
          }}
        >
          {lang === 'es'
            ? '¿Operas en esta zona? Inicia trámite con CHT'
            : 'Mining in this district? Begin a process with CHT'}
        </a>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.5,
            color: 'var(--t3)',
            textAlign: 'center',
          }}
        >
          {lang === 'es'
            ? 'Pensado para mineros artesanales y de pequeña escala que operan en el área.'
            : 'For artisanal and small-scale miners operating in this area.'}
        </p>
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
          letterSpacing: '0.18em',
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

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: disabled ? 'var(--slate-lt)' : 'var(--t3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--ink)';
        e.currentTarget.style.color = 'var(--ink)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--t3)';
      }}
    >
      {children}
    </button>
  );
}
