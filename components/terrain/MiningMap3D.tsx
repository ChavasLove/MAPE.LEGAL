'use client';

import { useRef, useEffect, useCallback } from 'react';
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
import type { MiningSite } from './mining-data';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface MiningMap3DProps {
  lang: 'es' | 'en';
  selectedSiteId: string | null;
  onSiteSelect: (siteId: string | null) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const HAS_KEY = Boolean(MAPTILER_KEY);

// `StyleSpecification` / `TerrainSpecification` are not always re-exported by
// every version of maplibre-gl's typings, so we use `any` to avoid coupling to
// a specific minor release. Runtime shape is documented inline.
/** Return the map style. Without a MapTiler key we fall back to free
 * CartoDB Voyager raster tiles so the map works out of the box. */
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

/** Return terrain source info. Without a MapTiler key we use MapLibre's
 * free demo DEM tiles (SRTM-based, global coverage). */
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

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function MiningMap3D({
  lang,
  selectedSiteId,
  onSiteSelect,
}: MiningMap3DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupsRef = useRef<maplibregl.Popup[]>([]);
  const onSiteSelectRef = useRef(onSiteSelect);
  onSiteSelectRef.current = onSiteSelect;

  /* ---- build a DOM element for a site marker -------------------- */
  const createMarkerElement = useCallback(
    (site: MiningSite, isSelected: boolean) => {
      const el = document.createElement('div');
      const fillColor = TYPE_COLORS[site.type] ?? 'var(--earth)';
      el.style.cssText = `
        width: ${isSelected ? '28px' : '22px'};
        height: ${isSelected ? '28px' : '22px'};
        border-radius: 50%;
        background: ${fillColor};
        border: 3px solid var(--bg);
        box-shadow: ${
          isSelected
            ? `0 0 0 3px ${fillColor}, 0 4px 12px rgba(0,0,0,0.3)`
            : '0 2px 8px rgba(0,0,0,0.25)'
        };
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      `;

      // No continuous animations per DESIGN.md §4 — the green color of
      // STATUS_COLORS.active already conveys "active".

      return el;
    },
    []
  );

  /* ---- (re)create all markers ----------------------------------- */
  const updateMarkers = useCallback(() => {
    // clear previous
    markersRef.current.forEach((m) => m.remove());
    popupsRef.current.forEach((p) => p.remove());
    markersRef.current = [];
    popupsRef.current = [];

    if (!map.current) return;

    const statusLabels = lang === 'es' ? STATUS_LABELS_ES : STATUS_LABELS_EN;
    const typeLabels = lang === 'es' ? TYPE_LABELS_ES : TYPE_LABELS_EN;

    MINING_SITES.forEach((site) => {
      const isSelected = site.id === selectedSiteId;
      const el = createMarkerElement(site, isSelected);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(site.coordinates)
        .addTo(map.current!);

      // popup HTML
      const typeLabel = typeLabels[site.type] ?? site.type;
      const statusLabel = statusLabels[site.status] ?? site.status;
      const typeColor = TYPE_COLORS[site.type] ?? 'var(--earth)';
      const statusColor = STATUS_COLORS[site.status] ?? 'var(--t3)';
      const popupHTML = `
        <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:180px;">
          <div style="font-family:Georgia,serif;font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px;">
            ${lang === 'es' ? site.nameEs : site.name}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:color-mix(in oklch, ${typeColor} 14%, white);color:${typeColor};">${typeLabel}</span>
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:color-mix(in oklch, ${statusColor} 14%, white);color:${statusColor};">${statusLabel}</span>
          </div>
          <div style="font-size:12px;color:var(--slate);line-height:1.5;">
            ${site.department} &mdash; ${site.municipality}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: true,
        offset: 16,
        className: 'mining-popup',
      }).setHTML(popupHTML);

      el.addEventListener('click', () => {
        onSiteSelectRef.current(site.id);
        popup.setLngLat(site.coordinates).addTo(map.current!);
      });

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [lang, selectedSiteId, createMarkerElement]);

  /* ---- initialise map (runs once) ------------------------------- */
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const style = getMapStyle(HAS_KEY);
    const { terrainSpec, hillshadeSource } = getTerrainConfig(HAS_KEY);

    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-86.5, 14.8],
      zoom: 6.5,
      minZoom: 5,
      maxZoom: 16,
      pitch: 45,
      bearing: -15,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    });

    map.current = instance;

    // controls
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
      'bottom-left'
    );
    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
      'bottom-left'
    );

    instance.on('load', () => {
      // free-fallback: add hillshade DEM source + layer
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

      // enable 3D terrain
      if (terrainSpec) {
        try {
          instance.setTerrain(terrainSpec);
        } catch {
          // terrain source unavailable — degrade gracefully
        }
      }

      // inject popup styling once. No keyframe animation per DESIGN.md §4.
      if (!document.getElementById('mining-map-style')) {
        const s = document.createElement('style');
        s.id = 'mining-map-style';
        s.textContent = `
          .mining-popup .maplibregl-popup-content {
            border-radius: 12px;
            border: 1px solid var(--border);
            box-shadow: 0 4px 16px rgba(31,42,56,0.12);
            padding: 12px;
          }
          .mining-popup .maplibregl-popup-tip {
            border-top-color: var(--border);
          }
        `;
        document.head.appendChild(s);
      }

      updateMarkers();
    });

    // cleanup
    return () => {
      markersRef.current.forEach((m) => m.remove());
      popupsRef.current.forEach((p) => p.remove());
      markersRef.current = [];
      popupsRef.current = [];
      instance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- update markers when language or selection changes -------- */
  useEffect(() => {
    if (!map.current) return;
    updateMarkers();
  }, [selectedSiteId, lang, updateMarkers]);

  /* ---- fly to selected site ------------------------------------- */
  useEffect(() => {
    if (!map.current || !selectedSiteId) return;
    const site = MINING_SITES.find((s) => s.id === selectedSiteId);
    if (!site) return;

    map.current.flyTo({
      center: site.coordinates,
      zoom: 10,
      pitch: 55,
      bearing: -20,
      duration: 1500,
      essential: true,
    });
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
