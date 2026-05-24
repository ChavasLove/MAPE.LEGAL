'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mlcontour from 'maplibre-contour';
import {
  MINING_SITES,
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

// Honduras center, framed to take in the dramatic Cordillera Nombre de Dios,
// Sierra de Agalta, and the Atlantic-facing ranges in one shot.
const INITIAL_CENTER: [number, number] = [-86.8, 14.7];
const INITIAL_ZOOM = 6.8;
const INITIAL_PITCH = 55;
const INITIAL_BEARING = -18;

// DEM source for terrain + hillshade + contour generation.
// AWS Open Data / Tilezen Terrarium tiles — free, no auth, CORS-open,
// zoom 0–15 (much better contour resolution than demotiles' z11 ceiling).
// `encoding: 'terrarium'` is required for both setTerrain and maplibre-contour.
const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const DEM_ATTRIB =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Tile data &copy; Mapzen</a>';
const TERRAIN_EXAGGERATION = 1.8;

const SOURCE_ID = 'mining-sites';
const CIRCLE_LAYER = 'mining-circles';
const TOUCH_LAYER = 'mining-touch-halo';
const BORDER_SOURCE = 'hn-border';
const BORDER_LAYER = 'hn-border-line';
const CONTOUR_SOURCE = 'contours';
const CONTOUR_MINOR_LAYER = 'isolines-minor';
const CONTOUR_MAJOR_LAYER = 'isolines-major';
const CONTOUR_LABEL_LAYER = 'isolines-major-text';

/* ------------------------------------------------------------------ */
/* maplibre-contour init (module scope, SSR-guarded)                  */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let demSource: any = null;
function initDemSource() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = new (mlcontour as any).DemSource({
    url: DEM_URL,
    encoding: 'terrarium',
    // Match the camera's maxZoom (14) so the plugin fetches z14 DEM tiles
    // directly instead of overzooming from z13 — otherwise contour lines
    // visibly staircase when the user zooms close to a mining site while
    // the underlying hillshade/terrain reads native z14 detail.
    maxzoom: 14,
    worker: true,
    cacheSize: 100,
    timeoutMs: 10000,
  });
  ds.setupMaplibre(maplibregl);
  return ds;
}
if (typeof window !== 'undefined' && !demSource) {
  try {
    demSource = initDemSource();
  } catch (err) {
    // Plugin init failure degrades to no-contours map.
    console.warn('[mining-map] maplibre-contour DemSource init failed', err);
    demSource = null;
  }
}

/* ------------------------------------------------------------------ */
/* Resolve CSS variables → hex strings (MapLibre paint can't read var())*/
/* ------------------------------------------------------------------ */

interface ResolvedTokens {
  type: Record<MineType, string>;
  ink: string;
  bg: string;
  bgSoft: string;
  slate: string;
  slateLt: string;
  concrete: string;
  border2: string;
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
    bg: readVar('--bg'),
    bgSoft: readVar('--bg-soft'),
    slate: readVar('--slate'),
    slateLt: readVar('--slate-lt'),
    concrete: readVar('--concrete'),
    border2: readVar('--border-2'),
  };
}

/* ------------------------------------------------------------------ */
/* Style — minimal cartographic chart                                 */
/* ------------------------------------------------------------------ */
/* A single flat background layer in the paper tone (`--bg-soft`).    */
/* Contours, hillshade, terrain, border, and pins are all added       */
/* imperatively in `instance.on('load')` once tokens are resolved.    */
/* `glyphs` is required so the elevation labels symbol-layer can      */
/* render. demotiles.maplibre.org hosts Noto Sans for free, no auth.  */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMapStyle(tokens: ResolvedTokens): any {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {},
    layers: [
      {
        id: 'paper',
        type: 'background',
        paint: { 'background-color': tokens.bgSoft },
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

    // Resolve tokens up-front so the initial style background paints in the
    // correct paper tone instead of flashing white before load.
    const tokens = getTokens();
    const style = getMapStyle(tokens);
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

    // Mapzen Joerd attribution is mandatory for AWS Terrarium tiles (CC-BY).
    instance.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: DEM_ATTRIB,
      }),
      'bottom-right'
    );
    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left'
    );

    // Operational visibility — async errors (border 404, glyphs CDN failure,
    // DEM tile fetch issues) surface here, otherwise they'd be swallowed by
    // MapLibre's internal source-manager.
    instance.on('error', (e) => {
      // MapLibre's `ErrorEvent` carries `sourceId` at runtime (when the error
      // is scoped to a source) but the public type omits it; cast through any.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev = e as any;
      const target = ev?.sourceId ? ` (source "${ev.sourceId}")` : '';
      console.warn(`[mining-map] async error${target}`, ev?.error ?? ev);
    });

    /* ---- once-styled: terrain + hillshade + sky + data layers ---- */
    instance.on('load', () => {
      styleReadyRef.current = true;
      // tokens resolved at constructor; re-use the same memoized object so the
      // contour and hillshade layers paint with values consistent with the
      // initial background.

      /* ---- DEM source (raster-dem, Terrarium encoding) ---- */
      if (!instance.getSource('terrain-dem')) {
        try {
          instance.addSource('terrain-dem', {
            type: 'raster-dem',
            tiles: [DEM_URL],
            tileSize: 256,
            encoding: 'terrarium',
            maxzoom: 15,
            attribution: DEM_ATTRIB,
          });
        } catch (err) {
          console.warn('[mining-map] DEM source unreachable — terrain off', err);
        }
      }

      // Hillshade reads from the same DEM. Heavily attenuated so the contour
      // lines (added below) carry the relief signal; hillshade is just a
      // subtle wash to give topography a sense of light direction.
      try {
        if (!instance.getLayer('hillshade')) {
          instance.addLayer({
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: {
              'hillshade-exaggeration': 0.18,
              'hillshade-shadow-color': tokens.ink,
              'hillshade-highlight-color': tokens.bg,
              'hillshade-accent-color': tokens.border2,
            },
          });
        }
      } catch (err) {
        console.warn('[mining-map] hillshade layer failed', err);
      }

      try {
        instance.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION });
      } catch (err) {
        console.warn('[mining-map] setTerrain failed — falling back flat', err);
      }

      // Sky — neutral horizon so the chart reads cartographic, not satellite.
      try {
        instance.setSky({
          'sky-color': tokens.bg,
          'sky-horizon-blend': 0.7,
          'horizon-color': tokens.concrete,
          'horizon-fog-blend': 0.6,
          'fog-color': tokens.slateLt,
          'fog-ground-blend': 0.9,
          'atmosphere-blend': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0.4,
            12, 0.05,
          ],
        });
      } catch (err) {
        console.warn('[mining-map] setSky failed (MapLibre v3+ required)', err);
      }

      /* ---- Honduras border source (added early to start the async fetch
       *      ASAP; the line layer itself is added below, AFTER the contour
       *      layers, so the major 0 m isoline at the coast doesn't paint
       *      over the country outline). ---- */
      try {
        if (!instance.getSource(BORDER_SOURCE)) {
          instance.addSource(BORDER_SOURCE, {
            type: 'geojson',
            data: '/data/honduras-border.json',
          });
        }
      } catch (err) {
        console.warn('[mining-map] Honduras border source failed', err);
      }

      /* ---- Contour lines (vector tiles, generated client-side) ---- */
      // Thresholds: at each zoom, [minor interval, major interval] in metres.
      // Major lines (level=1) get labels; minor lines (level=0) carry density.
      if (demSource) {
        try {
          if (!instance.getSource(CONTOUR_SOURCE)) {
            instance.addSource(CONTOUR_SOURCE, {
              type: 'vector',
              tiles: [
                demSource.contourProtocolUrl({
                  // Thresholds per zoom: [minor interval, major interval] in metres.
                  // Plugin behavior: at any zoom request, picks the highest key
                  // <= zoom. If no key qualifies, `levels` is empty and the
                  // tile is returned blank — so coverage MUST start at or below
                  // `INITIAL_ZOOM` (6.8), otherwise no contours render until
                  // the user manually zooms past z10. Honduras peaks at ~2870 m
                  // (Cerro Las Minas), so coarse intervals at low zoom show
                  // 2–4 major lines across the country without saturating.
                  thresholds: {
                    5: [500, 2000],
                    6: [500, 2000],
                    7: [500, 2000],
                    8: [250, 1000],
                    9: [100, 500],
                    10: [100, 500],
                    11: [100, 500],
                    12: [50, 250],
                    13: [25, 100],
                  },
                  elevationKey: 'ele',
                  levelKey: 'level',
                  contourLayer: 'contours',
                }),
              ],
              maxzoom: 15,
            });
          }

          if (!instance.getLayer(CONTOUR_MINOR_LAYER)) {
            instance.addLayer({
              id: CONTOUR_MINOR_LAYER,
              type: 'line',
              source: CONTOUR_SOURCE,
              'source-layer': 'contours',
              filter: ['==', ['get', 'level'], 0],
              paint: {
                'line-color': tokens.ink,
                'line-opacity': 0.18,
                'line-width': 0.4,
              },
            });
          }

          if (!instance.getLayer(CONTOUR_MAJOR_LAYER)) {
            instance.addLayer({
              id: CONTOUR_MAJOR_LAYER,
              type: 'line',
              source: CONTOUR_SOURCE,
              'source-layer': 'contours',
              filter: ['==', ['get', 'level'], 1],
              paint: {
                'line-color': tokens.ink,
                'line-opacity': 0.55,
                'line-width': 0.8,
              },
            });
          }

          if (!instance.getLayer(CONTOUR_LABEL_LAYER)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            instance.addLayer({
              id: CONTOUR_LABEL_LAYER,
              type: 'symbol',
              source: CONTOUR_SOURCE,
              'source-layer': 'contours',
              filter: ['==', ['get', 'level'], 1],
              minzoom: 11,
              layout: {
                'symbol-placement': 'line',
                'text-field': [
                  'concat',
                  ['number-format', ['get', 'ele'], {}],
                  ' m',
                ],
                'text-font': ['Noto Sans Regular'],
                'text-size': 9,
                'symbol-spacing': 220,
              },
              paint: {
                'text-color': tokens.slate,
                'text-halo-color': tokens.bgSoft,
                'text-halo-width': 1.2,
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          }
        } catch (err) {
          console.warn('[mining-map] contour layers failed — paper + border + pins still render', err);
        }
      }

      /* ---- Honduras border line layer (added AFTER contours so the
       *      country outline paints on top of the 0 m isoline at the coast). ---- */
      try {
        if (!instance.getLayer(BORDER_LAYER) && instance.getSource(BORDER_SOURCE)) {
          instance.addLayer({
            id: BORDER_LAYER,
            type: 'line',
            source: BORDER_SOURCE,
            paint: {
              'line-color': tokens.ink,
              'line-opacity': 0.55,
              'line-width': 1.0,
            },
          });
        }
      } catch (err) {
        console.warn('[mining-map] Honduras border layer failed', err);
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
        // Paper tone — matches the `background` layer painted by MapLibre once
        // the style loads, so there is no flash between mount and first paint.
        background: 'var(--bg-soft)',
      }}
    />
  );
}
