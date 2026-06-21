import type { H3Event } from 'h3'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler((event: H3Event) => {
  const guestId = getRouterParam(event, 'guestId')
  const guest = mockGuests.find(g => g.guestId === guestId)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.deletedAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客已移除' })
  }
  guest.deletedAt = new Date().toISOString()

  setResponseStatus(event, 204)
})
