import type { H3Event } from 'h3'
import type { OverrideRsvpBody, RsvpOverriddenEvent } from '../../../../../../../app/types/api/rsvp'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<RsvpOverriddenEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<OverrideRsvpBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  guest.rsvpAttending = body.attending

  return { guestId: guest.guestId, attending: body.attending, reason: body.reason }
})
