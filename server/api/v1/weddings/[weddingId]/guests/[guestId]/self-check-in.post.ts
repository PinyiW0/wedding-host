import type { H3Event } from 'h3'
import type { GuestSelfCheckedInEvent, SelfCheckInBody } from '../../../../../../../app/types/api/reception'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<GuestSelfCheckedInEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<SelfCheckInBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.checkedInAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客已報到' })
  }
  guest.checkedInAt = new Date().toISOString()

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, name: body?.name ?? guest.name, checkedInAt: guest.checkedInAt }
})
