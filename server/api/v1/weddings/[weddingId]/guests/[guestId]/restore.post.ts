import type { H3Event } from 'h3'
import type { GuestRestoredEvent } from '../../../../../../../app/types/api/guests'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler((event: H3Event): GuestRestoredEvent => {
  const guestId = getRouterParam(event, 'guestId')
  const guest = mockGuests.find(g => g.guestId === guestId)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (!guest.deletedAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客未被移除' })
  }
  guest.deletedAt = null

  return { guestId: guest.guestId }
})
