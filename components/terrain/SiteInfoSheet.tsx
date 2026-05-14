'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  STATUS_COLORS,
  TYPE_COLORS,
  STATUS_LABELS_ES,
  STATUS_LABELS_EN,
  TYPE_LABELS_ES,
  TYPE_LABELS_EN,
  COMMODITY_LABELS_ES,
  MINING_SITES,
} from './mining-data';
import type { MiningSite } from './mining-data';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type SheetSnap = 'closed' | 'peek' | 'full';

interface SiteInfoSheetProps {
  site: MiningSite | null;
  lang: 'es' | 'en';
  isMobile: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

// Snap targets in viewport units, used only on mobile.
const HEIGHTS = {
  closed: 0,
  peek: 132, // header strip
  full: 0.78, // 78vh
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function SiteInfoSheet({
  site,
  lang,
  isMobile,
  onClose,
  onPrev,
  onNext,
  position,
}: SiteInfoSheetProps) {
  const open = Boolean(site);

  // Snap state — `peek` on first open, user can drag to `full`.
  const [snap, setSnap] = useState<SheetSnap>('closed');
  const [dragOffset, setDragOffset] = useState(0); // negative = dragging up
  const dragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startSnap: SheetSnap;
  } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /* ---- snap to peek when a new site is selected ---- */
  useEffect(() => {
    if (open) {
      setSnap('peek');
      setDragOffset(0);
      // Reset scroll so user sees the top each time
      if (contentRef.current) contentRef.current.scrollTop = 0;
    } else {
      setSnap('closed');
      setDragOffset(0);
    }
  }, [site?.id, open]);

  /* ---- swallow Esc on full to collapse first, then close ---- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobile && snap === 'full') {
          setSnap('peek');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, snap, isMobile, onClose]);

  /* ---- pointer drag for grab-handle ---- */
  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (dragStateRef.current) return;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* iOS Safari may throw if pointer was already captured */
    }
    dragStateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startSnap: snap,
    };
  };

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const deltaY = e.clientY - state.startY;
    setDragOffset(deltaY);
  };

  const settleAfterDrag = (deltaY: number, start: SheetSnap) => {
    // Translate vertical drag into a snap change.
    // Positive deltaY = dragged down. Negative = dragged up.
    if (start === 'peek') {
      if (deltaY < -60) setSnap('full');
      else if (deltaY > 60) {
        // Drag from peek down → close & deselect
        onClose();
      }
    } else if (start === 'full') {
      if (deltaY > 100) {
        setSnap('peek');
      }
    }
    setDragOffset(0);
  };

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const deltaY = e.clientY - state.startY;
    const startSnap = state.startSnap;
    dragStateRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    settleAfterDrag(deltaY, startSnap);
  };

  const toggleSnap = () => {
    if (!isMobile) return;
    setSnap((s) => (s === 'full' ? 'peek' : 'full'));
  };

  /* ---- empty state on desktop (no mobile equivalent, sheet just hides) */
  if (!site) {
    if (isMobile) return null;
    return <DesktopEmpty lang={lang} />;
  }

  return (
    <Wrapper
      ref={sheetRef}
      isMobile={isMobile}
      snap={snap}
      dragOffset={dragOffset}
      onPointerCancel={(e: ReactPointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (state && state.pointerId === e.pointerId) {
          dragStateRef.current = null;
          setDragOffset(0);
        }
      }}
    >
      {/* ---- drag handle (mobile) / nav bar (desktop) ---- */}
      <Header
        site={site}
        lang={lang}
        isMobile={isMobile}
        snap={snap}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onHandleClick={toggleSnap}
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
        position={position}
      />

      {/* ---- scrollable body — hidden in peek state on mobile ---- */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: isMobile ? 0 : 8,
          // On mobile, peek hides the body via container clip — but keep
          // pointer-events on so the chips don't act dead during transition.
        }}
      >
        <Body site={site} lang={lang} isMobile={isMobile} snap={snap} />
      </div>
    </Wrapper>
  );
}

/* ------------------------------------------------------------------ */
/* Wrapper                                                            */
/* ------------------------------------------------------------------ */

const Wrapper = ({
  ref,
  isMobile,
  snap,
  dragOffset,
  children,
  onPointerCancel,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  snap: SheetSnap;
  dragOffset: number;
  children: React.ReactNode;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) => {
  const transform = useMemo(() => {
    if (!isMobile) return undefined;
    if (snap === 'closed') return 'translate3d(0, 100%, 0)';
    // Convert peek/full to viewport math at render-time. We size the sheet
    // to max-height 78vh on full; peek slides it down to expose only header.
    const peekTopOffsetVh = 78 - 16; // sheet bottom-aligned; show ~16vh
    if (snap === 'peek') {
      return `translate3d(0, calc(${peekTopOffsetVh}vh - ${Math.max(
        0,
        dragOffset
      )}px), 0)`;
    }
    // full
    const downCap = Math.max(0, dragOffset);
    return `translate3d(0, ${downCap}px, 0)`;
  }, [isMobile, snap, dragOffset]);

  if (isMobile) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal={snap === 'full' ? 'true' : 'false'}
        onPointerCancel={onPointerCancel}
        className="mining-sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -8px 24px rgba(31, 42, 56, 0.12)',
          maxHeight: '78vh',
          height: '78vh',
          display: 'flex',
          flexDirection: 'column',
          willChange: 'transform',
          transform,
          transition:
            dragOffset === 0
              ? 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)'
              : 'none',
          zIndex: 30,
          touchAction: 'none',
        }}
      >
        {children}
      </div>
    );
  }

  // Desktop — right-side floating card
  return (
    <div
      ref={ref}
      role="complementary"
      aria-label="Site details"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 16,
        width: 360,
        maxWidth: 'calc(100% - 32px)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow:
          '0 8px 24px color-mix(in oklch, var(--ink) 12%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 25,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Header (drag handle + nav + title)                                 */
/* ------------------------------------------------------------------ */

function Header({
  site,
  lang,
  isMobile,
  snap,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onHandleClick,
  onClose,
  onPrev,
  onNext,
  position,
}: {
  site: MiningSite;
  lang: 'es' | 'en';
  isMobile: boolean;
  snap: SheetSnap;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onHandleClick: () => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}) {
  const typeLabels = lang === 'es' ? TYPE_LABELS_ES : TYPE_LABELS_EN;
  const statusLabels = lang === 'es' ? STATUS_LABELS_ES : STATUS_LABELS_EN;
  const typeLabel = typeLabels[site.type] ?? site.type;
  const statusLabel = statusLabels[site.status] ?? site.status;
  const typeColor = TYPE_COLORS[site.type] ?? 'var(--earth)';
  const statusColor = STATUS_COLORS[site.status] ?? 'var(--t3)';

  return (
    <div style={{ flexShrink: 0 }}>
      {/* ---- mobile-only grab handle ---- */}
      {isMobile && (
        <div
          role="button"
          tabIndex={0}
          aria-label={
            lang === 'es'
              ? snap === 'full'
                ? 'Arrastrar para colapsar'
                : 'Arrastrar para expandir'
              : snap === 'full'
              ? 'Drag to collapse'
              : 'Drag to expand'
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onHandleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onHandleClick();
            }
          }}
          style={{
            cursor: 'grab',
            padding: '10px 0 6px',
            display: 'flex',
            justifyContent: 'center',
            // Generous touch target — 24px tall + 36×4 visual bar centered.
            touchAction: 'none',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--slate-lt)',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* ---- nav row (prev/position/next + close) ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '4px 16px 4px' : '12px 16px 0',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
          }}
        >
          {onPrev && (
            <IconButton
              label={lang === 'es' ? 'Sitio anterior' : 'Previous site'}
              onClick={onPrev}
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </IconButton>
          )}
          {onNext && (
            <IconButton
              label={lang === 'es' ? 'Siguiente sitio' : 'Next site'}
              onClick={onNext}
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </IconButton>
          )}
          {position && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--slate)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                marginLeft: 2,
              }}
            >
              {lang === 'es'
                ? `${position.index} / ${position.total}`
                : `${position.index} / ${position.total}`}
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

      {/* ---- compact name + badges (always visible in peek + full) ---- */}
      <div
        style={{
          padding: '8px 20px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <Badge label={typeLabel} color={typeColor} />
          <Badge label={statusLabel} color={statusColor} />
        </div>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: isMobile ? 17 : 18,
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
            marginTop: 4,
            fontWeight: 500,
          }}
        >
          {site.department} &middot; {site.municipality}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Body                                                                */
/* ------------------------------------------------------------------ */

function Body({
  site,
  lang,
  isMobile,
  snap,
}: {
  site: MiningSite;
  lang: 'es' | 'en';
  isMobile: boolean;
  snap: SheetSnap;
}) {
  // On mobile, only show body when sheet is expanded.
  const hidden = isMobile && snap === 'peek';
  return (
    <div
      aria-hidden={hidden}
      style={{
        opacity: hidden ? 0 : 1,
        transition: 'opacity 0.18s ease',
        padding: '16px 20px 20px',
        paddingBottom: `max(20px, env(safe-area-inset-bottom))`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <p
        style={{
          fontSize: 13,
          color: 'var(--t2)',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {lang === 'es' ? site.descriptionEs : site.descriptionEn}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
          <Eyebrow text={lang === 'es' ? 'Minerales' : 'Minerals'} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
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
        <Eyebrow text={lang === 'es' ? 'Coordenadas' : 'Coordinates'} />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink)',
            letterSpacing: '0.02em',
            marginTop: 4,
          }}
        >
          {site.coordinates[1].toFixed(4)}&deg;N,&nbsp;
          {Math.abs(site.coordinates[0]).toFixed(4)}&deg;
          {lang === 'es' ? 'O' : 'W'}
        </div>
      </div>

      {/* CTA — always shown, audience is the district's artisanal miners */}
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
          padding: '13px 14px',
          borderRadius: 8,
          background: 'var(--moss)',
          color: 'white',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center',
          textDecoration: 'none',
          display: 'block',
          minHeight: 44,
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
  );
}

/* ------------------------------------------------------------------ */
/* Empty state (desktop only)                                          */
/* ------------------------------------------------------------------ */

function DesktopEmpty({ lang }: { lang: 'es' | 'en' }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 240,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow:
          '0 4px 14px color-mix(in oklch, var(--ink) 10%, transparent)',
        padding: 16,
        zIndex: 20,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--earth)',
          marginBottom: 6,
        }}
      >
        {lang === 'es' ? 'Mapa interactivo' : 'Interactive map'}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--t2)' }}>
        {lang === 'es'
          ? 'Toque o haga click en un pin para ver el contexto del distrito.'
          : 'Tap or click a pin to see the district context.'}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
          color: 'var(--slate-lt)',
        }}
      >
        {MINING_SITES.length}{' '}
        {lang === 'es' ? 'sitios registrados' : 'sites registered'}
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
        background: `color-mix(in oklch, ${color} 14%, white)`,
        color,
        border: `1px solid color-mix(in oklch, ${color} 30%, white)`,
      }}
    >
      <span
        aria-hidden
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
      <Eyebrow text={label} />
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--ink)',
          lineHeight: 1.4,
          marginTop: 3,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Eyebrow({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--t3)',
      }}
    >
      {text}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 32,
        height: 32,
        minWidth: 32,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--t3)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
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
      {children}
    </button>
  );
}
