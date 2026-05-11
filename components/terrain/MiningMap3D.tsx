'use client';

import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MINING_SITES,
  TYPE_COLORS,
  STATUS_COLORS,
  STATUS_LABELS_ES,
  STATUS_LABELS_EN,
  TYPE_LABELS_ES,
  TYPE_LABELS_EN,
} from './mining-data';
import type { MiningSite, MineType } from './mining-data';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface MiningMap3DProps {
  lang: 'es' | 'en';
  selectedSiteId: string | null;
  visibleTypes: Set<MineType>;
  onSiteSelect: (siteId: string | null) => void;
}

interface MarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLDivElement;
  site: MiningSite;
}

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const HAS_KEY = Boolean(MAPTILER_KEY);
const INITIAL_CENTER: [number, number] = [-86.5, 14.8];
const INITIAL_ZOOM = 6.5;

// `StyleSpecification` / `TerrainSpecification` are not always re-exported by
// every version of maplibre-gl's typings, so we use `any` to avoid coupling to
// a specific minor release. Runtime shape is documented inline.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMapStyle(hasKey: boolean): string | any {
  if (hasKey && MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

function getTerrainConfig(hasKey: boolean): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  terrainSpec: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hillshadeSource: any | null;
} {
  if (hasKey && MAPTILER_KEY) {
    return {
      terrainSpec: { source: 'terrain', exaggeration: 1.5 },
      hillshadeSource: null,
    };
  }
  return {
    terrainSpec: { source: 'terrain', exaggeration: 1.5 },
    hillshadeSource: {
      type: 'raster-dem',
      url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
      tileSize: 256,
    },
  };
}

function markerCss(fillColor: string, isSelected: boolean): string {
  const size = isSelected ? 28 : 22;
  const baseShadow =
    '0 2px 8px color-mix(in oklch, var(--ink) 24%, transparent)';
  const selectedShadow =
    '0 0 0 3px var(--ink), 0 4px 14px color-mix(in oklch, var(--ink) 30%, transparent)';
  return `
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${fillColor};
    border: 3px solid var(--bg);
    box-shadow: ${isSelected ? selectedShadow : baseShadow};
    cursor: pointer;
    transition: width 0.18s ease, height 0.18s ease, box-shadow 0.18s ease;
    position: relative;
  `;
}

function popupHTML(site: MiningSite, lang: 'es' | 'en'): string {
  const typeLabels = lang === 'es' ? TYPE_LABELS_ES : TYPE_LABELS_EN;
  const statusLabels = lang === 'es' ? STATUS_LABELS_ES : STATUS_LABELS_EN;
  const typeLabel = typeLabels[site.type] ?? site.type;
  const statusLabel = statusLabels[site.status] ?? site.status;
  const typeColor = TYPE_COLORS[site.type] ?? 'var(--earth)';
  const statusColor = STATUS_COLORS[site.status] ?? 'var(--t3)';
  return `
    <div style="font-family:var(--font-body);min-width:180px;">
      <div style="font-family:var(--font-display);font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px;line-height:1.25;">
        ${lang === 'es' ? site.nameEs : site.name}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:color-mix(in oklch, ${typeColor} 14%, white);color:${typeColor};">${typeLabel}</span>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:color-mix(in oklch, ${statusColor} 14%, white);color:${statusColor};">${statusLabel}</span>
      </div>
      <div style="font-size:12px;color:var(--slate);line-height:1.5;">
        ${site.department} &middot; ${site.municipality}
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function MiningMap3D({
  lang,
  selectedSiteId,
  visibleTypes,
  onSiteSelect,
}: MiningMap3DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Refs so the one-time click/keydown listeners always see current props.
  const onSiteSelectRef = useRef(onSiteSelect);
  const selectedIdRef = useRef(selectedSiteId);
  const langRef = useRef(lang);
  const visibleTypesRef = useRef(visibleTypes);
  onSiteSelectRef.current = onSiteSelect;
  selectedIdRef.current = selectedSiteId;
  langRef.current = lang;
  visibleTypesRef.current = visibleTypes;

  /* ---- in-place style mutations (no teardown) ------------------- */

  const applySelectionStyle = () => {
    const selectedId = selectedIdRef.current;
    markersRef.current.forEach((entry) => {
      const fillColor = TYPE_COLORS[entry.site.type] ?? 'var(--earth)';
      const isSel = entry.site.id === selectedId;
      entry.el.style.cssText = markerCss(fillColor, isSel);
      entry.el.setAttribute('aria-pressed', isSel ? 'true' : 'false');
    });
  };

  const applyVisibilityStyle = () => {
    const visible = visibleTypesRef.current;
    markersRef.current.forEach((entry) => {
      entry.el.style.display = visible.has(entry.site.type) ? '' : 'none';
    });
  };

  const applyPopup = () => {
    if (!map.current || !popupRef.current) return;
    const selectedId = selectedIdRef.current;
    if (!selectedId) {
      popupRef.current.remove();
      return;
    }
    const entry = markersRef.current.get(selectedId);
    if (!entry) {
      popupRef.current.remove();
      return;
    }
    popupRef.current
      .setLngLat(entry.site.coordinates)
      .setHTML(popupHTML(entry.site, langRef.current))
      .addTo(map.current);
  };

  /* ---- initialise map (runs once) ------------------------------- */
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const style = getMapStyle(HAS_KEY);
    const { terrainSpec, hillshadeSource } = getTerrainConfig(HAS_KEY);

    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 5,
      maxZoom: 16,
      pitch: 0,
      bearing: 0,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    });
    map.current = instance;

    instance.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      }),
      'bottom-right'
    );
    instance.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );
    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
      'bottom-left'
    );

    // Shared popup — created once, reused as the user selects different sites.
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: 'mining-popup',
      anchor: 'bottom',
    });

    instance.on('load', () => {
      if (!HAS_KEY && hillshadeSource) {
        instance.addSource('terrain', hillshadeSource);
        instance.addLayer({
          id: 'hillshade',
          type: 'hillshade',
          source: 'terrain',
          paint: {
            'hillshade-exaggeration': 0.5,
            'hillshade-shadow-color': 'rgba(0,0,0,0.15)',
            'hillshade-highlight-color': 'rgba(255,255,255,0.2)',
          },
        });
      }

      if (terrainSpec) {
        try {
          instance.setTerrain(terrainSpec);
        } catch {
          /* terrain source unavailable — degrade gracefully */
        }
      }

      if (!document.getElementById('mining-map-style')) {
        const s = document.createElement('style');
        s.id = 'mining-map-style';
        s.textContent = `
          .mining-popup .maplibregl-popup-content {
            border-radius: 12px;
            border: 1px solid var(--border);
            box-shadow: 0 4px 16px color-mix(in oklch, var(--ink) 12%, transparent);
            padding: 12px;
            background: var(--bg);
          }
          .mining-popup .maplibregl-popup-tip {
            border-top-color: var(--border);
          }
        `;
        document.head.appendChild(s);
      }

      // Build all markers ONCE. Subsequent selection / visibility / language
      // changes mutate these in place — no remove/recreate churn.
      MINING_SITES.forEach((site) => {
        const fillColor = TYPE_COLORS[site.type] ?? 'var(--earth)';
        const el = document.createElement('div');
        el.style.cssText = markerCss(fillColor, false);
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-pressed', 'false');
        el.setAttribute(
          'aria-label',
          langRef.current === 'es' ? `Ver ${site.nameEs}` : `View ${site.name}`
        );

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(site.coordinates)
          .addTo(instance);

        const activate = () => onSiteSelectRef.current(site.id);

        el.addEventListener('click', (e) => {
          // Prevent the underlying map from getting the click (else closeOnClick
          // logic in some MapLibre versions could dismiss our own popup).
          e.stopPropagation();
          activate();
        });
        el.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        });

        markersRef.current.set(site.id, { marker, el, site });
      });

      // Apply initial state (markers were just created with defaults).
      applySelectionStyle();
      applyVisibilityStyle();
      applyPopup();
    });

    return () => {
      markersRef.current.forEach((entry) => entry.marker.remove());
      markersRef.current.clear();
      popupRef.current?.remove();
      popupRef.current = null;
      instance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- selection change → mutate style + (re)position popup ----- */
  useEffect(() => {
    applySelectionStyle();
    // applySelectionStyle re-writes cssText which wipes `display`, so re-apply.
    applyVisibilityStyle();
    applyPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId]);

  /* ---- filter change → toggle marker visibility ----------------- */
  useEffect(() => {
    applyVisibilityStyle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTypes]);

  /* ---- language change → update aria-labels + popup HTML -------- */
  useEffect(() => {
    markersRef.current.forEach((entry) => {
      entry.el.setAttribute(
        'aria-label',
        lang === 'es' ? `Ver ${entry.site.nameEs}` : `View ${entry.site.name}`
      );
    });
    applyPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* ---- fly to selected site (or back to overview) --------------- */
  useEffect(() => {
    if (!map.current) return;
    if (selectedSiteId) {
      const entry = markersRef.current.get(selectedSiteId);
      if (!entry) return;
      map.current.flyTo({
        center: entry.site.coordinates,
        zoom: Math.max(map.current.getZoom(), 9.5),
        duration: 1200,
        essential: true,
      });
    } else {
      map.current.flyTo({
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        duration: 900,
        essential: true,
      });
    }
  }, [selectedSiteId]);

  /* ---- render --------------------------------------------------- */
  return (
    <div
      ref={mapContainer}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        borderRadius: 'inherit',
      }}
    />
  );
}
