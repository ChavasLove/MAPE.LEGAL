'use client';

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import MiningMap3D, { type MiningMapApi } from './MiningMap3D';
import SiteInfoSheet from './SiteInfoSheet';
import MapLegend from './MapLegend';
import CompassButton from './CompassButton';
import TopoBand from '@/components/decor/TopoBand';
import { MINING_SITES, MINE_TYPE_ORDER } from './mining-data';
import type { MineType } from './mining-data';

interface Props {
  lang: 'es' | 'en';
  t: (es: string, en: string) => string;
}

const MOBILE_QUERY = '(max-width: 767px)';

/** Tiny in-file media query hook — avoids adding a dep. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(mql.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function TerrainMapSection({ lang, t }: Props) {
  const isMobile = useIsMobile();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<MineType>>(
    () => new Set(MINE_TYPE_ORDER)
  );
  const [bearing, setBearing] = useState(-18);
  const [pitch, setPitch] = useState(55);
  const [announce, setAnnounce] = useState<string>('');

  const apiRef = useRef<MiningMapApi | null>(null);

  const visibleSites = useMemo(
    () => MINING_SITES.filter((s) => visibleTypes.has(s.type)),
    [visibleTypes]
  );

  // Auto-deselect if the currently-selected site is filtered out.
  useEffect(() => {
    if (selectedSiteId && !visibleSites.some((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(null);
    }
  }, [visibleSites, selectedSiteId]);

  const selectedSite = useMemo(
    () => MINING_SITES.find((s) => s.id === selectedSiteId) ?? null,
    [selectedSiteId]
  );

  // a11y polite announcement on selection change
  useEffect(() => {
    if (!selectedSite) {
      setAnnounce('');
      return;
    }
    const name = lang === 'es' ? selectedSite.nameEs : selectedSite.name;
    setAnnounce(
      lang === 'es' ? `Sitio seleccionado: ${name}` : `Selected site: ${name}`
    );
  }, [selectedSite, lang]);

  const selectedIndex = selectedSite
    ? visibleSites.findIndex((s) => s.id === selectedSite.id)
    : -1;

  const handleSiteSelect = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSiteId(null);
  }, []);

  const handleNext = useCallback(() => {
    if (visibleSites.length === 0) return;
    if (selectedIndex === -1) {
      setSelectedSiteId(visibleSites[0].id);
      return;
    }
    const next = visibleSites[(selectedIndex + 1) % visibleSites.length];
    setSelectedSiteId(next.id);
  }, [visibleSites, selectedIndex]);

  const handlePrev = useCallback(() => {
    if (visibleSites.length === 0) return;
    if (selectedIndex === -1) {
      setSelectedSiteId(visibleSites[visibleSites.length - 1].id);
      return;
    }
    const prev =
      visibleSites[
        (selectedIndex - 1 + visibleSites.length) % visibleSites.length
      ];
    setSelectedSiteId(prev.id);
  }, [visibleSites, selectedIndex]);

  const navEnabled = visibleSites.length > 1;

  const handleBearingChange = useCallback((b: number, p: number) => {
    setBearing(b);
    setPitch(p);
  }, []);

  const handleMapReady = useCallback((api: MiningMapApi) => {
    apiRef.current = api;
  }, []);

  const handleCompassClick = useCallback(() => {
    apiRef.current?.resetView();
  }, []);

  /* ---- derived stats (full universe; not filtered) ------------- */
  const stats = [
    {
      count: MINING_SITES.length.toString(),
      labelEs: 'Sitios mapeados',
      labelEn: 'Mapped sites',
    },
    {
      count: MINING_SITES.filter((s) => s.status === 'active').length.toString(),
      labelEs: 'Operaciones activas',
      labelEn: 'Active operations',
    },
    {
      count: MINING_SITES.filter((s) => s.status === 'contested').length.toString(),
      labelEs: 'Sitios en disputa',
      labelEn: 'Contested sites',
    },
    {
      count: MINING_SITES.filter((s) => s.status === 'historical').length.toString(),
      labelEs: 'Sitios históricos',
      labelEn: 'Historical sites',
    },
  ];

  const filterActive = visibleTypes.size !== MINE_TYPE_ORDER.length;

  // Map area height — taller on mobile (the map is the experience) yet
  // capped so portrait phones still expose stats below.
  const mapHeight: React.CSSProperties['height'] = isMobile ? '72vh' : 560;

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'relative',
          height: 48,
          overflow: 'hidden',
          marginBottom: -1,
        }}
      >
        <TopoBand variant="light" position="band" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="section-label">{t('Archivo', 'Archive')}</div>
        <h2 className="section-title">
          {t(
            'Distritos mineros de Honduras — contexto y oportunidad.',
            'Mining districts of Honduras — context and opportunity.'
          )}
        </h2>
        <p className="section-sub" style={{ maxWidth: 720 }}>
          {t(
            'Mapa topográfico 3D de los distritos mineros del país: operaciones activas, yacimientos en pausa, sitios en disputa y zonas con presencia histórica. Cada uno de estos territorios concentra mineros artesanales y de pequeña escala que son los clientes naturales del proceso de formalización con CHT.',
            "A 3D topographic map of Honduras' mining districts: active operations, paused deposits, contested sites, and areas with historical presence. Each of these territories concentrates artisanal and small-scale miners — the natural clients for CHT's formalization process."
          )}
        </p>
      </div>

      {/* Map container — relative for floating overlays + the sheet */}
      <div
        className="terrain-map-frame"
        style={{
          position: 'relative',
          width: '100%',
          height: mapHeight,
          minHeight: 440,
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 6px color-mix(in oklch, var(--ink) 5%, transparent)',
          overflow: 'hidden',
          background: 'var(--bg)',
        }}
      >
        <MiningMap3D
          lang={lang}
          selectedSiteId={selectedSiteId}
          visibleTypes={visibleTypes}
          onSiteSelect={handleSiteSelect}
          onBearingChange={handleBearingChange}
          onMapReady={handleMapReady}
        />

        {/* Filter — chip row on mobile, vertical list on desktop */}
        <MapLegend
          lang={lang}
          value={visibleTypes}
          onChange={setVisibleTypes}
          isMobile={isMobile}
        />

        {/* Compass / reset view */}
        <CompassButton
          bearing={bearing}
          pitch={pitch}
          lang={lang}
          onClick={handleCompassClick}
        />

        {/* Filter active counter (desktop only — mobile chip row already shows it) */}
        {filterActive && !isMobile && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 68,
              zIndex: 10,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'color-mix(in oklch, var(--bg) 96%, transparent)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px color-mix(in oklch, var(--ink) 10%, transparent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--slate)',
              letterSpacing: '0.04em',
            }}
            aria-live="polite"
          >
            {t(
              `Mostrando ${visibleSites.length} de ${MINING_SITES.length} sitios`,
              `Showing ${visibleSites.length} of ${MINING_SITES.length} sites`
            )}
          </div>
        )}

        {/* Info panel — bottom sheet on mobile, right-side card on desktop */}
        <SiteInfoSheet
          site={selectedSite}
          lang={lang}
          isMobile={isMobile}
          onClose={handleClose}
          onPrev={selectedSite && navEnabled ? handlePrev : undefined}
          onNext={selectedSite && navEnabled ? handleNext : undefined}
          position={
            selectedSite && selectedIndex >= 0
              ? { index: selectedIndex + 1, total: visibleSites.length }
              : undefined
          }
        />

        {/* a11y live region — visually hidden */}
        <span
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {announce}
        </span>
      </div>

      {/* Hint strip — helps first-time mobile users discover gestures */}
      {isMobile && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            color: 'var(--t3)',
            textAlign: 'center',
          }}
        >
          {t(
            'Pellizque para acercar · arrastre con dos dedos para inclinar · toque un pin',
            'Pinch to zoom · two-finger drag to tilt · tap a pin'
          )}
        </p>
      )}

      {/* Stats — smaller on mobile to keep map dominant */}
      <div
        className="terrain-stats-bar"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'repeat(4, 1fr)'
            : 'repeat(4, 1fr)',
          gap: 1,
          marginTop: isMobile ? 18 : 1,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.labelEs}
            style={{
              padding: isMobile ? '12px 8px' : '16px 20px',
              background: 'var(--bg)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: isMobile ? 'clamp(20px, 5vw, 28px)' : 28,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {stat.count}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: isMobile ? 9 : 10,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--slate)',
                marginTop: 4,
                lineHeight: 1.3,
              }}
            >
              {t(stat.labelEs, stat.labelEn)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
