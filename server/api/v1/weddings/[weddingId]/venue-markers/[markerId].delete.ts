import type { H3Event } from 'h3'

import { mockVenueMarkers } from '../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event): void => {
  const weddingId = getRouterParam(event, 'weddingId')
  const markerId = getRouterParam(event, 'markerId')

  const index = mockVenueMarkers.findIndex(m => m.weddingId === weddingId && m.markerId === markerId)
  if (index === -1)
    throw createError({ statusCode: 404, statusMessage: '標記不存在' })

  mockVenueMarkers.splice(index, 1)
  setResponseStatus(event, 204)
})
