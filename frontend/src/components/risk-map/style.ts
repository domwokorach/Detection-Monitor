/**
 * Premium dark cartographic style over real OpenStreetMap data (OpenFreeMap vector tiles, OpenMapTiles schema).
 * No API key is needed. Attribution is part of the source and always rendered by the map's attribution control.
 */
import type { StyleSpecification, LayerSpecification, ExpressionSpecification } from 'maplibre-gl'

export const C = {
  bg: '#030B14', surface: '#071426', panel: '#0B1E33', border: '#1B344D', accent: '#65B9EE', ice: '#BFE8FF', text: '#F2F7FC', muted: '#8CA2BA',
  water: '#040E1B', park: '#0A1C2E', built: '#0A1A2D',
}
/** Alert risk bands. Elevated 60–69, High 70–84, Critical 85–100. Always labelled in text as well as colour. */
export const BAND_COLOR = { elevated: '#4F9BD9', high: '#8DD4FA', critical: '#E85D68' } as const

export const UK_BOUNDS: [[number, number], [number, number]] = [[-8.7, 49.8], [1.9, 60.95]]
export const UK_MAX_BOUNDS: [number, number, number, number] = [-13, 48.2, 5.5, 62.5]
export const MIN_ZOOM = 4.4
export const MAX_ZOOM = 17.5

const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'
export const BOUNDARY_ATTRIBUTION = 'Boundaries: ONS, Open Government Licence v3.0 · Contains OS data © Crown copyright'

const name: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']]
const SRC = 'openmaptiles'
const road = (id: string, classes: string[], color: string, widths: [number, number, number], minzoom = 5): LayerSpecification => ({
  id, type: 'line', source: SRC, 'source-layer': 'transportation', minzoom,
  filter: ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'brunnel'], 'tunnel']],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': color, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, widths[0], 12, widths[1], 17, widths[2]] },
})
const label = (id: string, cls: string[], minzoom: number, size: [number, number], color: string, bold = false): LayerSpecification => ({
  id, type: 'symbol', source: SRC, 'source-layer': 'place', minzoom,
  filter: ['in', ['get', 'class'], ['literal', cls]],
  layout: {
    'text-field': name, 'text-font': [bold ? 'Noto Sans Bold' : 'Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], minzoom, size[0], minzoom + 5, size[1]],
    'text-max-width': 8, 'symbol-sort-key': ['get', 'rank'],
  },
  paint: { 'text-color': color, 'text-halo-color': C.bg, 'text-halo-width': 1.4, 'text-halo-blur': 0.4 },
})

export const basemapStyle: StyleSpecification = {
  version: 8,
  name: 'Detection Monitor Dark',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { [SRC]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: ATTRIBUTION } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': C.surface } },
    { id: 'landcover', type: 'fill', source: SRC, 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass']]], paint: { 'fill-color': C.park, 'fill-opacity': 0.7 } },
    { id: 'park', type: 'fill', source: SRC, 'source-layer': 'park', paint: { 'fill-color': C.park, 'fill-opacity': 0.8 } },
    { id: 'landuse', type: 'fill', source: SRC, 'source-layer': 'landuse', minzoom: 8, filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]], paint: { 'fill-color': C.built, 'fill-opacity': 0.9 } },
    { id: 'water', type: 'fill', source: SRC, 'source-layer': 'water', paint: { 'fill-color': C.water } },
    { id: 'waterway', type: 'line', source: SRC, 'source-layer': 'waterway', minzoom: 9, paint: { 'line-color': C.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 15, 2] } },
    { id: 'building', type: 'fill', source: SRC, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': C.panel, 'fill-opacity': 0.9, 'fill-outline-color': '#12273D' } },
    road('road-minor', ['minor', 'service'], '#0E2238', [0.1, 0.5, 4], 11),
    road('road-tertiary', ['tertiary'], '#122A42', [0.2, 0.9, 6], 9),
    road('road-secondary', ['secondary'], '#173249', [0.3, 1.2, 8], 8),
    road('road-primary', ['primary'], '#1B3A55', [0.4, 1.5, 10], 6),
    road('road-trunk', ['trunk', 'motorway'], '#244B6C', [0.5, 1.8, 12], 5),
    { id: 'rail', type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: 11, filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#12273D', 'line-width': 0.6, 'line-dasharray': [3, 3] } },
    { id: 'road-label', type: 'symbol', source: SRC, 'source-layer': 'transportation_name', minzoom: 13, layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': 10.5 }, paint: { 'text-color': C.muted, 'text-halo-color': C.bg, 'text-halo-width': 1.2 } },
    { id: 'water-label', type: 'symbol', source: SRC, 'source-layer': 'water_name', minzoom: 6, layout: { 'text-field': name, 'text-font': ['Noto Sans Italic'], 'text-size': 11 }, paint: { 'text-color': '#4C6E91', 'text-halo-color': C.bg, 'text-halo-width': 1 } },
    label('place-hamlet', ['hamlet', 'neighbourhood'], 14, [10, 11.5], C.muted),
    label('place-suburb', ['suburb', 'quarter'], 12, [10, 12], C.muted),
    label('place-village', ['village', 'isolated_dwelling'], 11, [10, 12], C.muted),
    label('place-town', ['town'], 8, [11, 14], C.ice),
    label('place-city', ['city'], 4, [12, 18], C.text, true),
  ],
}
/** Insert our overlay layers beneath the first label so place names stay readable over risk fills. */
export const BEFORE_LABELS = 'road-label'
