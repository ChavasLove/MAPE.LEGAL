'use client';

import { useState, useCallback } from 'react';
import MiningMap3D from './MiningMap3D';
import SiteInfoPanel from './SiteInfoPanel';
import MapLegend from './MapLegend';
import TopoBand from '@/components/decor/TopoBand';
import { MINING_SITES } from './mining-data';

interface Props {
  lang: 'es' | 'en';
  t: (es: string, en: string) => string;
}

export default function TerrainMapSection({ lang, t }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const selectedSite = MINING_SITES.find((s) => s.id === selectedSiteId) ?? null;

  const handleSiteSelect = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSiteId(null);
  }, []);

  /* ---- derived stats ---- */
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
      labelEs: 'Proyectos controvertidos',
      labelEn: 'Contested projects',
    },
    {
      count: MINING_SITES.filter((s) => s.status === 'historical').length.toString(),
      labelEs: 'Yacimientos históricos',
      labelEn: 'Historical sites',
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      {/* ---- TopoBand decoration ---- */}
      <div style={{ position: 'relative', height: 48, overflow: 'hidden', marginBottom: -1 }}>
        <TopoBand variant="light" position="band" />
      </div>

      {/* ---- section header ---- */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label">{t('Archivo', 'Archive')}</div>
        <h2 className="section-title">
          {t(
            'Biblioteca de archivos mineros de Honduras.',
            'Library of Honduras mining archives.'
          )}
        </h2>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          {t(
            'Mapa interactivo de la historia minera de Honduras: operaciones artesanales en curso, yacimientos cerrados y proyectos en disputa. Cada sitio forma parte del universo de formalización donde opera CHT — desde el mapeo de unidades hasta la emisión de certificados de origen verificables.',
            "Interactive map of Honduras' mining history: active artisanal operations, closed deposits, and contested projects. Each site is part of the formalization universe in which CHT operates — from initial unit mapping through verifiable certificate-of-origin issuance."
          )}
        </p>
      </div>

      {/* ---- map + info panel ---- */}
      <div
        className="terrain-map-layout"
        style={{
          display: 'flex',
          gap: 0,
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
          overflow: 'hidden',
          background: 'var(--bg)',
          minHeight: 550,
        }}
      >
        {/* map */}
        <div style={{ flex: 1, minHeight: 400, position: 'relative' }}>
          <MiningMap3D
            lang={lang}
            selectedSiteId={selectedSiteId}
            onSiteSelect={handleSiteSelect}
          />
          <MapLegend lang={lang} />
        </div>

        {/* info panel */}
        <div
          className="terrain-info-panel"
          style={{
            width: 360,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg)',
          }}
        >
          <SiteInfoPanel site={selectedSite} lang={lang} onClose={handleClose} />
        </div>
      </div>

      {/* ---- stats bar ---- */}
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
                letterSpacing: '0.12em',
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

      {/* ---- responsive overrides ---- */}
      <style>{`
        @media (max-width: 900px) {
          .terrain-map-layout { flex-direction: column !important; }
          .terrain-info-panel {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
            max-height: 420px;
          }
          .terrain-stats-bar { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
