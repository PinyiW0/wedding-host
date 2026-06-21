import type { H3Event } from 'h3'
import type { VenueLayoutBody, VenueLayoutConfiguredEvent } from '../../../../../app/types/api/seating'

import { mockVenueLayouts } from '../../../../mock/data/seating'
import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<VenueLayoutConfiguredEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<VenueLayoutBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const existing = mockVenueLayouts.find(l => l.weddingId === weddingId)
  if (existing) {
    Object.assign(existing, body)
  }
  else {
    mockVenueLayouts.push({ weddingId, ...body })
  }

  return { weddingId, ...body }
})
