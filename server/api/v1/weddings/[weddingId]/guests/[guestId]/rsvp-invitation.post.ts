import type { H3Event } from 'h3'
import type { RsvpInvitationSentEvent, SendRsvpInvitationBody } from '../../../../../../../app/types/api/rsvp'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<RsvpInvitationSentEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<SendRsvpInvitationBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  return { guestId: guest.guestId, channel: body?.channel ?? 'line' }
})
