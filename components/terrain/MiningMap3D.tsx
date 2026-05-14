'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MINING_SITES,
  TYPE_COLORS,
  MINE_TYPE_ORDER,
} from './mining-data';
import type { MineType } from './mining-data';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface MiningMap3DProps {
  lang: 'es' | 'en';
  selectedSiteId: string | null;
  visibleTypes: Set<MineType>;
  onSiteSelect: (siteId: string | null) => void;
  /**
   * Bearing reported to the parent on every map rotation, so a floating
   * compass button can mirror the angle without owning the map ref.
   */
  onBearingChange?: (bearing: number, pitch: number) => void;
  /**
   * Imperatively reset the map's bearing/pitch from the parent (e.g. the
   * compass button). Provided via callback ref pattern.
   */
  onMapReady?: (api: MiningMapApi) => void;
}

export interface MiningMapApi {
  resetView: () => void;
  flyToHome: () => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const HAS_KEY = Boolean(MAPTILER_KEY);

// Honduras center, framed to take in the dramatic Cordillera Nombre de Dios,
// Sierra de Agalta, and the Atlantic-facing ranges in one shot.
const INITIAL_CENTER: [number, number] = [-86.8, 14.7];
const INITIAL_ZOOM = 6.8;
const INITIAL_PITCH = 55;
const INITIAL_BEARING = -18;

// DEM source for terrain + hillshade. demotiles is free, SRTM-based, no auth.
const DEM_URL = 'https://demotiles.maplibre.org/terrain-tiles/tiles.json';
const TERRAIN_EXAGGERATION = 1.8;

const SOURCE_ID = 'mining-sites';
const CIRCLE_LAYER = 'mining-circles';
const TOUCH_LAYER = 'mining-touch-halo';

/* ------------------------------------------------------------------ */
/* Resolve CSS variables → hex strings (MapLibre paint can't read var())*/
/* ------------------------------------------------------------------ */

interface ResolvedTokens {
  type: Record<MineType, string>;
  ink: string;
  bg: string;
  sand: string;
  moss: string;
  ink2: string;
}

/**
 * Resolve a CSS custom property to its computed value at runtime.
 * MapLibre's paint expressions can't evaluate `var(--token)` directly,
 * so we read the document's own resolved values once and pass them through.
 * This function is only called from inside `useEffect` (post-mount) so the
 * DOM is guaranteed to exist; the empty-string check covers the (vanishing)
 * edge case where a custom property is undeclared in `:root`.
 */
function readVar(name: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  // If a token is missing, return a non-painting transparent so the issue is
  // visually obvious instead of silently picking a hardcoded hex.
  return raw || 'transparent';
}

function resolveTokens(): ResolvedTokens {
  const type: Record<MineType, string> = {
    gold: readVar('--amber'),
    zinc: readVar('--blue'),
    lead: readVar('--plum'),
    silver: readVar('--t3'),
    iron: readVar('--red'),
    antimony: readVar('--slate'),
    historical: readVar('--earth'),
  };
  return {
    type,
    ink: readVar('--ink'),
    ink2: readVar('--ink-2'),
    bg: readVar('--bg'),
    sand: readVar('--sand'),
    moss: readVar('--moss'),
  };
}

/* ------------------------------------------------------------------ */
/* Style                                                              */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMapStyle(): string | any {
  if (HAS_KEY && MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
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

/* ------------------------------------------------------------------ */
/* Build GeoJSON FeatureCollection                                    */
/* ------------------------------------------------------------------ */

interface SiteFeature {
  type: 'Feature';
  id: string; // for setFeatureState lookups (string ids work with promoteId)
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    type: MineType;
    name: string;
    nameEs: string;
  };
}

function buildFeatureCollection() {
  const features: SiteFeature[] = MINING_SITES.map((s) => ({
    type: 'Feature',
    id: s.id,
    geometry: { type: 'Point', coordinates: s.coordinates },
    properties: {
      id: s.id,
      type: s.type,
      name: s.name,
      nameEs: s.nameEs,
    },
  }));
  return {
    type: 'FeatureCollection' as const,
    features,
  };
}

/* ------------------------------------------------------------------ */
/* Build a MapLibre `match` expression for circle-color                */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTypeColorExpression(tokens: ResolvedTokens): any {
  // Shape: ['match', ['get', 'type'], <mineType>, <resolvedColor>, …, <fallback>]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expr: any[] = ['match', ['get', 'type']];
  for (const t of MINE_TYPE_ORDER) {
    expr.push(t, tokens.type[t]);
  }
  expr.push(tokens.type.historical); // fallback
  return expr;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function MiningMap3D({
  lang,
  selectedSiteId,
  visibleTypes,
  onSiteSelect,
  onBearingChange,
  onMapReady,
}: MiningMap3DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const lastSelectedIdRef = useRef<string | null>(null);

  // Refs so the once-bound listeners always see the latest props.
  const onSiteSelectRef = useRef(onSiteSelect);
  const onBearingChangeRef = useRef(onBearingChange);
  onSiteSelectRef.current = onSiteSelect;
  onBearingChangeRef.current = onBearingChange;

  const featureCollection = useMemo(() => buildFeatureCollection(), []);

  /* ---- token resolution (memoized once mounted, recomputed nothing) - */
  const tokensRef = useRef<ResolvedTokens | null>(null);
  const getTokens = useCallback((): ResolvedTokens => {
    if (!tokensRef.current) tokensRef.current = resolveTokens();
    return tokensRef.current;
  }, []);

  /* ---- imperative API published to parent ---------------------- */
  const apiRef = useRef<MiningMapApi | null>(null);
  if (!apiRef.current) {
    apiRef.current = {
      resetView: () => {
        const m = map.current;
        if (!m) return;
        m.easeTo({
          bearing: INITIAL_BEARING,
          pitch: INITIAL_PITCH,
          duration: 600,
          essential: true,
        });
      },
      flyToHome: () => {
        const m = map.current;
        if (!m) return;
        m.flyTo({
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
          bearing: INITIAL_BEARING,
          pitch: INITIAL_PITCH,
          duration: 900,
          essential: true,
        });
      },
    };
  }

  /* ---- init map (once) ----------------------------------------- */
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const style = getMapStyle();
    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 5,
      maxZoom: 14,
      pitch: INITIAL_PITCH,
      bearing: INITIAL_BEARING,
      maxPitch: 75,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
      // Mobile-friendly gesture defaults — pinch zoom, two-finger rotate,
      // and two-finger pitch all enabled out of the box.
      dragRotate: true,
      pitchWithRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
    });
    map.current = instance;
    if (apiRef.current && onMapReady) onMapReady(apiRef.current);

    // Compact attribution to keep mobile surface clean.
    instance.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );
    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left'
    );

    /* ---- once-styled: terrain + hillshade + sky + data layers ---- */
    instance.on('load', () => {
      styleReadyRef.current = true;
      const tokens = getTokens();

      /* ---- DEM source + 3D terrain + hillshade ---- */
      if (!instance.getSource('terrain-dem')) {
        try {
          instance.addSource('terrain-dem', {
            type: 'raster-dem',
            url: DEM_URL,
            tileSize: 256,
          });
        } catch {
          /* DEM unreachable — degrade gracefully (terrain off) */
        }
      }

      // Hillshade reads from the same DEM. Inserted before the markers so
      // points sit on top.
      try {
        if (!instance.getLayer('hillshade')) {
          instance.addLayer({
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: {
              'hillshade-exaggeration': 0.45,
              'hillshade-shadow-color': tokens.ink,
              'hillshade-highlight-color': tokens.sand,
              'hillshade-accent-color': tokens.ink2,
            },
          });
        }
      } catch {
        /* hillshade requires the DEM source; if missing, skip */
      }

      try {
        instance.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION });
      } catch {
        /* setTerrain may fail on style without DEM — fine, fall back flat */
      }

      // Sky reads from atmospheric tokens. Subtle, warm horizon → calm sky.
      try {
        instance.setSky({
          'sky-color': tokens.bg,
          'sky-horizon-blend': 0.6,
          'horizon-color': tokens.sand,
          'horizon-fog-blend': 0.55,
          'fog-color': tokens.ink,
          'fog-ground-blend': 0.85,
          'atmosphere-blend': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0.6,
            12, 0.1,
          ],
        });
      } catch {
        /* setSky available in MapLibre v3+; ignore if missing */
      }

      /* ---- source + circle layers ---- */
      if (!instance.getSource(SOURCE_ID)) {
        instance.addSource(SOURCE_ID, {
          type: 'geojson',
          data: featureCollection,
          promoteId: 'id',
        });
      }

      const typeColorExpr = buildTypeColorExpression(tokens);

      // Invisible larger halo — pure touch target, ~44 logical px so taps
      // forgive imprecise pointers without enlarging the visible mark.
      if (!instance.getLayer(TOUCH_LAYER)) {
        instance.addLayer({
          id: TOUCH_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': 20,
            'circle-color': tokens.ink,
            'circle-opacity': 0,
          },
        });
      }

      if (!instance.getLayer(CIRCLE_LAYER)) {
        // MapLibre's strict `LayerSpecification` union doesn't unify with the
        // wide expression array shape we're building above; cast to silence
        // the union narrowing. Runtime shape is valid `CircleLayerSpecification`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instance.addLayer({
          id: CIRCLE_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-color': typeColorExpr,
            'circle-stroke-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], tokens.ink,
              tokens.bg,
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 3,
              2,
            ],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              5, [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 8,
                5.5,
              ],
              9, [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 13,
                8.5,
              ],
              13, [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 18,
                12,
              ],
            ],
            'circle-pitch-alignment': 'map',
            'circle-pitch-scale': 'map',
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }

      /* ---- interactions ---- */
      const triggerSelect = (id: string | null) => {
        onSiteSelectRef.current(id);
      };

      instance.on('click', TOUCH_LAYER, (e) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const id = (f.properties?.id as string | undefined) ?? null;
        if (id) triggerSelect(id);
      });

      // Click on bare map outside the touch halo → deselect.
      instance.on('click', (e) => {
        const hits = instance.queryRenderedFeatures(e.point, {
          layers: [TOUCH_LAYER],
        });
        if (hits.length === 0) triggerSelect(null);
      });

      instance.on('mouseenter', TOUCH_LAYER, () => {
        instance.getCanvas().style.cursor = 'pointer';
      });
      instance.on('mouseleave', TOUCH_LAYER, () => {
        instance.getCanvas().style.cursor = '';
      });

      // Apply initial filter + selection (in case props were already set).
      applyFilter();
      applySelection();
    });

    instance.on('rotate', () => {
      onBearingChangeRef.current?.(instance.getBearing(), instance.getPitch());
    });
    instance.on('pitch', () => {
      onBearingChangeRef.current?.(instance.getBearing(), instance.getPitch());
    });

    return () => {
      styleReadyRef.current = false;
      instance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- filter ---- */
  const applyFilter = useCallback(() => {
    const m = map.current;
    if (!m || !styleReadyRef.current) return;
    const arr = Array.from(visibleTypes);
    // ['in', ['get', 'type'], ['literal', [...]]]
    const filter: maplibregl.FilterSpecification = [
      'in',
      ['get', 'type'],
      ['literal', arr],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;
    try {
      m.setFilter(CIRCLE_LAYER, filter);
      m.setFilter(TOUCH_LAYER, filter);
    } catch {
      /* layers not yet built */
    }
  }, [visibleTypes]);

  useEffect(() => {
    applyFilter();
  }, [applyFilter]);

  /* ---- selection (feature-state) + flyTo ---- */
  const applySelection = useCallback(() => {
    const m = map.current;
    if (!m || !styleReadyRef.current) return;

    const prev = lastSelectedIdRef.current;
    if (prev && prev !== selectedSiteId) {
      try {
        m.setFeatureState(
          { source: SOURCE_ID, id: prev },
          { selected: false }
        );
      } catch {
        /* feature may have been filtered out — ok */
      }
    }
    if (selectedSiteId) {
      try {
        m.setFeatureState(
          { source: SOURCE_ID, id: selectedSiteId },
          { selected: true }
        );
      } catch {
        /* ignore */
      }
    }
    lastSelectedIdRef.current = selectedSiteId;
  }, [selectedSiteId]);

  useEffect(() => {
    applySelection();
  }, [applySelection]);

  /* ---- camera ---- */
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (selectedSiteId) {
      const site = MINING_SITES.find((s) => s.id === selectedSiteId);
      if (!site) return;
      m.flyTo({
        center: site.coordinates,
        zoom: Math.max(m.getZoom(), 9.5),
        pitch: 62,
        bearing: m.getBearing(),
        duration: 1500,
        essential: true,
      });
    } else {
      m.flyTo({
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        pitch: INITIAL_PITCH,
        bearing: INITIAL_BEARING,
        duration: 1100,
        essential: true,
      });
    }
  }, [selectedSiteId]);

  /* ---- render --------------------------------------------------- */
  return (
    <div
      ref={mapContainer}
      role="region"
      aria-label={
        lang === 'es'
          ? 'Mapa topográfico 3D de distritos mineros de Honduras'
          : '3D topographic map of Honduras mining districts'
      }
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        borderRadius: 'inherit',
        // Honduran sky-at-dusk gradient — visible until tiles paint.
        background:
          'linear-gradient(180deg, color-mix(in oklch, var(--sand) 22%, white) 0%, color-mix(in oklch, var(--bg) 100%, transparent) 60%)',
      }}
    />
  );
}
