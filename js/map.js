// The globe: a night-flight basemap (OpenFreeMap vectors + terrain relief), the year's routes, and the
// visited-country tint. Everything else (camera, playback) drives it through the helpers exported here.
const C = {
  space: '#070d22',
  land: '#1a2747',
  landHi: '#2d4276',
  ocean: '#08122b',
  border: '#8796c4',
  label: '#9fabcb',
  labelHi: '#e9e3d4',
  amber: '#ffb547',
  sea: '#55d6c2',
  rail: '#ff8a76',
  ground: '#aeb8d6',
};
export const COLORS = C;
export const MODE_COLOR = ['match', ['get', 't'], 'f', C.amber, 'c', C.sea, 'r', C.rail, 'b', C.rail, C.ground];

const FONT = ['Noto Sans Regular'];
const FONT_B = ['Noto Sans Bold'];

function style() {
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sky: {
      'sky-color': 'rgba(7,13,34,0)',
      'horizon-color': '#24407e',
      'fog-color': C.space,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.4,
      'fog-ground-blend': 0.9,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 0.85, 7, 0],
    },
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
      dem: {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 11,
        tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Mapzen, AWS Open Data</a>',
      },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': C.land } },
      {
        id: 'landcover-ice', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'ice'],
        paint: { 'fill-color': '#2b3b63', 'fill-opacity': 0.6 },
      },
      {
        id: 'relief', type: 'hillshade', source: 'dem',
        paint: {
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 6, 0.5, 10, 0.35],
          'hillshade-shadow-color': '#050a1c',
          'hillshade-highlight-color': '#3e5590',
          'hillshade-accent-color': '#0e1834',
          'hillshade-illumination-direction': 315,
        },
      },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.ocean } },
      {
        id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 8,
        paint: { 'line-color': C.ocean, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 13, 2] },
      },
      {
        id: 'roads', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'rail']]],
        paint: {
          'line-color': '#3a5088',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.35, 12, 0.8],
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 7, ['match', ['get', 'class'], ['motorway', 'trunk'], 0.8, 0.3], 15, ['match', ['get', 'class'], ['motorway', 'trunk'], 5, 2]],
        },
      },
      {
        id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13.5,
        paint: {
          'fill-extrusion-color': '#2a3d70',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      },
      {
        id: 'borders', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': C.border,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 6, 0.55],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.1, 10, 1.6],
        },
      },
      {
        id: 'states', type: 'line', source: 'omt', 'source-layer': 'boundary', minzoom: 4,
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': C.border, 'line-opacity': 0.18, 'line-width': 0.6, 'line-dasharray': [3, 2] },
      },
      {
        id: 'country-labels', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 7,
        filter: ['==', ['get', 'class'], 'country'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 5, 13],
          'text-letter-spacing': 0.12,
          'text-transform': 'uppercase',
          'text-max-width': 7,
        },
        paint: { 'text-color': C.label, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 2.1, 0, 2.9, 0.7], 'text-halo-color': C.space, 'text-halo-width': 1.2 },
      },
      {
        id: 'city-labels', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 5,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 14],
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: { 'text-color': C.label, 'text-opacity': 0.8, 'text-halo-color': C.space, 'text-halo-width': 1.2 },
      },
    ],
  };
}

/** Is WebGL available at all? (off in settings, or blocked by the browser after a graphics reset) */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

/** Stand-in when there is no globe, so the story (text, numbers, calendar) still works. */
export function nullMap() {
  const noop = () => nullMap.self;
  const m = nullMap.self = {
    jumpTo: noop, flyTo: noop, setFeatureState: noop, triggerRepaint: noop, setPadding: noop, stop: noop, redraw: noop,
    on: noop, once: noop, isMoving: () => false, getCenter: () => ({ lng: 0, lat: 0 }),
    getContainer: () => document.getElementById('map'), getCanvasContainer: () => document.createElement('div'),
    scrollZoom: { enable() {}, disable() {} }, dragPan: { enable() {}, disable() {} },
    touchZoomRotate: { enable() {}, disable() {} }, doubleClickZoom: { enable() {}, disable() {} },
  };
  return m;
}

export function createMap(el) {
  const map = new maplibregl.Map({
    container: el,
    style: style(),
    center: [-40, 28],
    zoom: 1.1,
    minZoom: 0.4,
    maxZoom: 15,
    attributionControl: { compact: true },
    renderWorldCopies: true,
    fadeDuration: 150,
    maxPitch: 60,
    // a full-screen globe on a big high-DPI monitor is a lot of pixels; capping the ratio keeps the GPU
    // well inside its budget (browsers block WebGL for a site after a GPU reset)
    pixelRatio: Math.min(window.devicePixelRatio || 1, window.innerWidth > 1500 ? 1.5 : 2),
  });
  // keep the attribution to its (i) button; the full credits are in the last chapter
  const fold = () => map.getContainer().querySelectorAll('.maplibregl-compact-show').forEach(e => e.classList.remove('maplibregl-compact-show'));
  map.once('load', fold);
  map.on('resize', fold);
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.keyboard.disable();
  return map;
}

/** Our own sources and layers, added once the base style is in. */
export function addLayers(map, A) {
  const legsFC = {
    type: 'FeatureCollection',
    features: A.legs.map(L => ({ type: 'Feature', id: L.i, properties: { i: L.i, t: L.t }, geometry: { type: 'LineString', coordinates: L.coords } })),
  };
  map.addSource('visited', { type: 'geojson', data: A.shapes });
  map.addSource('legs', { type: 'geojson', data: legsFC, tolerance: 0.2 });
  map.addSource('active', { type: 'geojson', data: empty() });
  map.addSource('places', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: A.places.map((p, i) => ({ type: 'Feature', id: i, properties: { name: p.name, days: p.days }, geometry: { type: 'Point', coordinates: [p.p[1], p.p[0]] } })),
    },
  });
  // the basemap leaves his cities to our own brighter labels
  const mine = [...new Set(A.places.map(p => p.name))];
  map.setFilter('city-labels', ['all',
    ['in', ['get', 'class'], ['literal', ['city', 'town']]],
    ['!', ['in', ['coalesce', ['get', 'name:en'], ['get', 'name']], ['literal', mine]]],
    ['!', ['in', ['get', 'name'], ['literal', mine]]]]);
  map.addSource('marks', { type: 'geojson', data: empty() });
  map.addSource('future', { type: 'geojson', data: empty() });

  // Visited countries sit UNDER the water layer, so the detailed coastline in the tiles, not this coarse
  // polygon, decides where land ends.
  map.addLayer({
    id: 'visited-fill', type: 'fill', source: 'visited',
    paint: {
      'fill-color': ['case',
        ['any', ['boolean', ['feature-state', 'hot'], false], ['all', ['boolean', ['feature-state', 'lit'], false], ['boolean', ['feature-state', 'visited'], false]]], '#403c4a',
        C.landHi],
      'fill-opacity': ['case',
        ['boolean', ['feature-state', 'hot'], false], 1,
        ['boolean', ['feature-state', 'visited'], false], 1,
        0],
      'fill-opacity-transition': { duration: 900 },
      'fill-color-transition': { duration: 900 },
    },
  }, 'relief');
  map.addLayer({
    id: 'hot-glow', type: 'fill', source: 'visited',
    paint: {
      'fill-color': C.amber,
      'fill-opacity': ['case', ['any', ['boolean', ['feature-state', 'hot'], false], ['all', ['boolean', ['feature-state', 'lit'], false], ['boolean', ['feature-state', 'visited'], false]]], 0.17, 0],
      'fill-opacity-transition': { duration: 900 },
    },
  }, 'water');

  const width = (a, b) => ['interpolate', ['exponential', 1.4], ['zoom'], 0.5, a, 6, b, 12, b * 1.6];
  const legLayer = (id, dashed) => map.addLayer({
    id, type: 'line', source: 'legs',
    filter: dashed ? ['==', ['get', 't'], 'g'] : ['!=', ['get', 't'], 'g'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': MODE_COLOR,
      'line-width': width(dashed ? 0.9 : 1.3, dashed ? 1.6 : 2.4),
      'line-opacity': ['case', ['boolean', ['feature-state', 'on'], true], ['*', dashed ? 0.8 : 1, ['coalesce', ['feature-state', 'op'], 0.6]], 0],
      ...(dashed ? { 'line-dasharray': [1.5, 2] } : {}),
    },
  });
  legLayer('legs', false);
  legLayer('legs-g', true);
  map.addLayer({
    id: 'active-glow', type: 'line', source: 'active',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    filter: ['!=', ['get', 't'], 'g'],
    paint: { 'line-color': MODE_COLOR, 'line-width': width(6, 12), 'line-blur': width(4, 8), 'line-opacity': 0.45 },
  });
  map.addLayer({
    id: 'active', type: 'line', source: 'active', filter: ['!=', ['get', 't'], 'g'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 't'], 'f', '#ffe2b0', 'c', '#c9fff5', '#ffd2c8'], 'line-width': width(1.8, 3.4) },
  });
  map.addLayer({
    id: 'active-g', type: 'line', source: 'active', filter: ['==', ['get', 't'], 'g'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': C.ground, 'line-width': width(1.4, 2.6), 'line-dasharray': [1.5, 2] },
  });
  map.addLayer({
    id: 'future', type: 'line', source: 'future',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': C.labelHi, 'line-width': width(1.2, 2.4), 'line-opacity': 0.8, 'line-dasharray': [0.6, 1.8] },
  });
  map.addLayer({
    id: 'places', type: 'circle', source: 'places',
    paint: {
      'circle-color': C.labelHi,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['min', 3, ['+', 1, ['/', ['get', 'days'], 30]]], 6, ['min', 5, ['+', 2.2, ['/', ['get', 'days'], 15]]]],
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0.5, 0.5, 4, 0.9],
      'circle-stroke-color': C.space,
      'circle-stroke-width': 1,
    },
  });
  map.addLayer({
    id: 'place-labels', type: 'symbol', source: 'places', minzoom: 3.2,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT_B,
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 8, 14],
      'text-offset': [0, 1.05],
      'text-anchor': 'top',
      'symbol-sort-key': ['-', 0, ['get', 'days']],
      'text-optional': true,
    },
    paint: { 'text-color': C.labelHi, 'text-halo-color': C.space, 'text-halo-width': 1.6, 'text-opacity': 0.92 },
  });
  map.addLayer({
    id: 'marks', type: 'circle', source: 'marks',
    paint: { 'circle-color': C.amber, 'circle-radius': 6, 'circle-stroke-color': '#fff3dc', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'mark-labels', type: 'symbol', source: 'marks',
    layout: { 'text-field': ['get', 'label'], 'text-font': FONT_B, 'text-size': 13, 'text-offset': [0, -1.4], 'text-anchor': 'bottom' },
    paint: { 'text-color': '#fff3dc', 'text-halo-color': C.space, 'text-halo-width': 1.8 },
  });
}

export const empty = () => ({ type: 'FeatureCollection', features: [] });

/**
 * Route emphasis through feature state (applied on the next frame, no tile rebuild, so a leg handed over
 * from the overlay never blinks). upTo: only legs before it are drawn. recent: age-fade from that leg.
 * focus: modes to keep bright. ids: legs to keep bright.
 */
export function styleLegsState(map, A, { upTo = null, recent = null, focus = null, ids = null } = {}) {
  const idSet = ids ? new Set(ids) : null;
  for (const L of A.legs) {
    const on = upTo == null || L.i < upTo;
    let op = 0.62;
    if (recent != null) {
      const age = recent - L.i;
      op = age <= 0 ? 0.95 : age < 6 ? 0.95 - age * 0.05 : Math.max(0.36, 0.65 - (age - 6) * 0.012);
    } else if (idSet) op = idSet.has(L.i) ? 1 : 0.1;
    else if (focus) op = focus.includes(L.t) ? 0.95 : 0.1;
    map.setFeatureState({ source: 'legs', id: L.i }, { on, op });
  }
}

let hotNow = null;
export function setHot(map, A, cc) {
  if (cc === hotNow) return;
  if (hotNow && A.shapeId[hotNow] != null) map.setFeatureState({ source: 'visited', id: A.shapeId[hotNow] }, { hot: false });
  hotNow = cc;
  if (cc && A.shapeId[cc] != null) map.setFeatureState({ source: 'visited', id: A.shapeId[cc] }, { hot: true });
}

/** Light every visited country at once (the "26 countries" chapter). */
export function setLit(map, A, on) {
  for (const cc in A.shapeId) map.setFeatureState({ source: 'visited', id: A.shapeId[cc] }, { lit: on });
}

export function setVisited(map, A, set) {
  for (const cc in A.shapeId) {
    map.setFeatureState({ source: 'visited', id: A.shapeId[cc] }, { visited: set.has(cc) });
  }
}
