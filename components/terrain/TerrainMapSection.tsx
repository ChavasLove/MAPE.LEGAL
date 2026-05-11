'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import MiningMap3D from './MiningMap3D';
import SiteInfoPanel from './SiteInfoPanel';
import MapLegend from './MapLegend';
import TopoBand from '@/components/decor/TopoBand';
import { MINING_SITES, MINE_TYPE_ORDER } from './mining-data';
import type { MineType } from './mining-data';

interface Props {
  lang: 'es' | 'en';
  t: (es: string, en: string) => string;
}

export default function TerrainMapSection({ lang, t }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<MineType>>(
    () => new Set(MINE_TYPE_ORDER)
  );

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

  // Only enable Next/Prev when there's more than one visible site to cycle through.
  const navEnabled = visibleSites.length > 1;

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

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative', height: 48, overflow: 'hidden', marginBottom: -1 }}>
        <TopoBand variant="light" position="band" />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="section-label">{t('Archivo', 'Archive')}</div>
        <h2 className="section-title">
          {t(
            'Distritos mineros de Honduras — contexto y oportunidad.',
            'Mining districts of Honduras — context and opportunity.'
          )}
        </h2>
        <p className="section-sub" style={{ maxWidth: 720 }}>
          {t(
            'Mapa de referencia de los distritos mineros del país: operaciones activas, yacimientos en pausa, sitios en disputa y zonas con presencia histórica. Cada uno de estos territorios concentra mineros artesanales y de pequeña escala que son los clientes naturales del proceso de formalización con CHT.',
            "A reference map of Honduras' mining districts: active operations, paused deposits, contested sites, and areas with historical presence. Each of these territories concentrates artisanal and small-scale miners — the natural clients for CHT's formalization process."
          )}
        </p>
      </div>

      <div
        className="terrain-map-layout"
        style={{
          display: 'flex',
          gap: 0,
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 6px color-mix(in oklch, var(--ink) 5%, transparent)',
          overflow: 'hidden',
          background: 'var(--bg)',
          minHeight: 550,
        }}
      >
        <div style={{ flex: 1, minHeight: 400, position: 'relative' }}>
          <MiningMap3D
            lang={lang}
            selectedSiteId={selectedSiteId}
            visibleTypes={visibleTypes}
            onSiteSelect={handleSiteSelect}
          />
          <MapLegend lang={lang} value={visibleTypes} onChange={setVisibleTypes} />
          {filterActive && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
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
        </div>

        <div
          className="terrain-info-panel"
          style={{
            width: 360,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg)',
          }}
        >
          <SiteInfoPanel
            site={selectedSite}
            lang={lang}
            onClose={handleClose}
            onPrev={selectedSite && navEnabled ? handlePrev : undefined}
            onNext={selectedSite && navEnabled ? handleNext : undefined}
            position={
              selectedSite && selectedIndex >= 0
                ? { index: selectedIndex + 1, total: visibleSites.length }
                : undefined
            }
          />
        </div>
      </div>

      <div
        className="terrain-stats-bar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          marginTop: 1,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.labelEs}
            style={{
              padding: '16px 20px',
              background: 'var(--bg)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
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
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--slate)',
                marginTop: 4,
              }}
            >
              {t(stat.labelEs, stat.labelEn)}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .terrain-map-layout { flex-direction: column !important; }
          .terrain-info-panel {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
            max-height: 460px;
          }
          .terrain-stats-bar { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
