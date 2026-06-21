import type { H3Event } from 'h3'
import type { RsvpSubmittedEvent, SubmitRsvpBody } from '../../../../../../../app/types/api/rsvp'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<RsvpSubmittedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<SubmitRsvpBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.rsvpAttending) {
    throw createError({ statusCode: 409, statusMessage: '已提交過 RSVP' })
  }
  guest.rsvpAttending = body.attending
  guest.diet = body.diet
  guest.needChildSeat = body.needChildSeat

  setResponseStatus(event, 201)
  return {
    guestId: guest.guestId,
    attending: body.attending,
    diet: body.diet,
    plusOneCount: body.plusOneCount,
    needChildSeat: body.needChildSeat,
  }
})
