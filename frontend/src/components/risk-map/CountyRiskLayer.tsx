import { Layer, Source } from 'react-map-gl/maplibre'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { BAND_COLOR, BEFORE_LABELS, C } from './style'

const bandColour: ExpressionSpecification = ['match', ['get', 'band'], 'critical', BAND_COLOR.critical, 'high', BAND_COLOR.high, 'medium-high', BAND_COLOR.elevated, 'rgba(0,0,0,0)']

/**
 * Real ONS boundaries: upper-tier/unitary authorities (counties) filled by live risk, local authorities
 * as a finer line layer from zoom 8, and the four nations as a crisp outline. Sits beneath place labels.
 */
export function CountyRiskLayer({ counties, localAuthorities, nations, mask, selected, hover }: {
  counties: FeatureCollection<Geometry>; localAuthorities: FeatureCollection<Geometry>; nations: FeatureCollection<Geometry>
  mask: Feature<Geometry>; selected: string | null; hover: string | null
}) {
  const none: ExpressionSpecification = ['==', ['get', 'band'], 'none']
  const is = (code: string | null): ExpressionSpecification => ['==', ['get', 'code'], code ?? '']
  return (
    <>
      <Source id="uk-mask" type="geojson" data={mask}>
        <Layer id="uk-mask" type="fill" beforeId={BEFORE_LABELS} paint={{ 'fill-color': C.bg, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 7.5, 0.62, 9.5, 0] }} />
      </Source>
      <Source id="ons-counties" type="geojson" data={counties}>
        <Layer id="county-fill" type="fill" beforeId={BEFORE_LABELS}
          paint={{ 'fill-color': bandColour, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, ['case', none, 0.001, 0.42], 11, ['case', none, 0.001, 0.2], 14, ['case', none, 0.001, 0.07]], 'fill-color-transition': { duration: 600, delay: 0 }, 'fill-opacity-transition': { duration: 600, delay: 0 } }} />
        <Layer id="county-hover" type="fill" beforeId={BEFORE_LABELS} filter={is(hover)} paint={{ 'fill-color': C.ice, 'fill-opacity': 0.1 }} />
        <Layer id="county-line" type="line" beforeId={BEFORE_LABELS} paint={{ 'line-color': '#3A6A92', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 9, 0.8, 14, 1.2] }} />
        <Layer id="county-selected-fill" type="fill" beforeId={BEFORE_LABELS} filter={is(selected)} paint={{ 'fill-color': C.accent, 'fill-opacity': 0.14 }} />
        <Layer id="county-selected-line" type="line" beforeId={BEFORE_LABELS} filter={is(selected)} paint={{ 'line-color': C.ice, 'line-width': 2 }} />
      </Source>
      <Source id="ons-ltla" type="geojson" data={localAuthorities}>
        <Layer id="ltla-line" type="line" minzoom={8} beforeId={BEFORE_LABELS} paint={{ 'line-color': '#2A5073', 'line-width': 0.6, 'line-dasharray': [2, 2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 9.5, 0.9] }} />
      </Source>
      <Source id="ons-nations" type="geojson" data={nations}>
        <Layer id="nation-line" type="line" beforeId={BEFORE_LABELS} paint={{ 'line-color': C.accent, 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.4] }} />
      </Source>
    </>
  )
}
