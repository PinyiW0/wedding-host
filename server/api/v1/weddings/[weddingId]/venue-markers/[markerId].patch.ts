import type { H3Event } from 'h3'
import type { UpdateVenueMarkerBody, VenueMarkerUpdatedEvent } from '../../../../../../app/types/api/seating'

import { mockVenueMarkers } from '../../../../../mock/data/seating'

export default defineEventHandler(async (event: H3Event): Promise<VenueMarkerUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')
  const markerId = getRouterParam(event, 'markerId')
  const body = await readBody<UpdateVenueMarkerBody>(event)

  const marker = mockVenueMarkers.find(m => m.weddingId === weddingId && m.markerId === markerId)
  if (!marker)
    throw createError({ statusCode: 404, statusMessage: '標記不存在' })

  if (body.label !== undefined) {
    const label = body.label.trim()
    if (!label)
      throw createError({ statusCode: 400, statusMessage: '請輸入標記文字' })
    marker.label = label
  }
  if (body.positionX !== undefined)
    marker.positionX = Math.max(0, Math.round(body.positionX))
  if (body.positionY !== undefined)
    marker.positionY = Math.max(0, Math.round(body.positionY))
  if (body.width !== undefined)
    marker.width = Math.max(40, Math.round(body.width))
  if (body.height !== undefined)
    marker.height = Math.max(24, Math.round(body.height))

  return { ...marker }
})
