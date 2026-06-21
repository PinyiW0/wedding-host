import type { H3Event } from 'h3'
import type { CakeBoxDistributedEvent, DistributeCakeBoxBody } from '../../../../../../../app/types/api/reception'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxDistributedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<DistributeCakeBoxBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.cakeBoxDistributedTypeId) {
    throw createError({ statusCode: 409, statusMessage: '喜餅已發放' })
  }
  guest.cakeBoxDistributedTypeId = body?.cakeBoxTypeId ?? 'cakeboxtype-001'

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, cakeBoxTypeId: guest.cakeBoxDistributedTypeId }
})
