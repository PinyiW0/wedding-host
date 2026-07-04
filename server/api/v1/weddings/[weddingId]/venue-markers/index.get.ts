import type { H3Event } from 'h3'
import type { VenueMarkerListItem } from '../../../../../../app/types/api/seating'

import { mockVenueMarkers } from '../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event): VenueMarkerListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockVenueMarkers
    .filter(m => m.weddingId === weddingId)
    .map(m => ({ ...m }))
})
