import type { H3Event } from 'h3'
import type { GuestCheckedInEvent } from '../../../../../../../app/types/api/reception'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler((event: H3Event): GuestCheckedInEvent => {
  const guestId = getRouterParam(event, 'guestId')
  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.checkedInAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客已報到' })
  }
  guest.checkedInAt = new Date().toISOString()

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, checkedInAt: guest.checkedInAt }
})
