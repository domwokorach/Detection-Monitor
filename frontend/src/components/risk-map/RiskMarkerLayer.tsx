import { Layer, Source } from 'react-map-gl/maplibre'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { FeatureCollection, Geometry } from 'geojson'
import { BAND_COLOR, C } from './style'

const bandColour: ExpressionSpecification = ['match', ['get', 'band'], 'critical', BAND_COLOR.critical, 'high', BAND_COLOR.high, BAND_COLOR.elevated]
export const CLUSTER_MAX_ZOOM = 10
export const MARKER_LAYERS = ['risk-clusters', 'risk-points']

/**
 * One marker per local authority that has alerts (an area-level location, not a street). Nearby authorities
 * group into compact light-blue clusters showing the alert count and expand as the analyst zooms in.
 */
export function RiskMarkerLayer({ areas, selectedArea }: { areas: FeatureCollection<Geometry>; selectedArea: string | null }) {
  const font = ['Noto Sans Bold']
  return (
    <Source id="risk-areas" type="geojson" data={areas} cluster clusterRadius={46} clusterMaxZoom={CLUSTER_MAX_ZOOM}
      clusterProperties={{ count: ['+', ['get', 'alerts']], maxScore: ['max', ['get', 'maxScore']] }}>
      <Layer id="risk-clusters" type="circle" filter={['has', 'point_count']}
        paint={{ 'circle-color': C.accent, 'circle-opacity': 0.88, 'circle-stroke-color': C.ice, 'circle-stroke-width': 1.5,
          'circle-radius': ['step', ['get', 'count'], 13, 10, 16, 50, 20, 200, 25], 'circle-radius-transition': { duration: 350, delay: 0 }, 'circle-opacity-transition': { duration: 350, delay: 0 } }} />
      <Layer id="risk-cluster-count" type="symbol" filter={['has', 'point_count']}
        layout={{ 'text-field': ['to-string', ['get', 'count']], 'text-font': font, 'text-size': 11, 'text-allow-overlap': true }} paint={{ 'text-color': C.bg }} />
      <Layer id="risk-points" type="circle" filter={['!', ['has', 'point_count']]}
        paint={{ 'circle-color': bandColour, 'circle-opacity': 0.95, 'circle-stroke-color': ['case', ['==', ['get', 'code'], selectedArea ?? ''], '#FFFFFF', C.bg], 'circle-stroke-width': ['case', ['==', ['get', 'code'], selectedArea ?? ''], 3, 1.5],
          'circle-radius': ['min', 18, ['+', 8, ['*', 2.4, ['sqrt', ['get', 'alerts']]]]], 'circle-radius-transition': { duration: 350, delay: 0 } }} />
      <Layer id="risk-point-count" type="symbol" filter={['all', ['!', ['has', 'point_count']], ['>', ['get', 'alerts'], 1]]}
        layout={{ 'text-field': ['to-string', ['get', 'alerts']], 'text-font': font, 'text-size': 11, 'text-allow-overlap': true }} paint={{ 'text-color': C.bg }} />
    </Source>
  )
}
