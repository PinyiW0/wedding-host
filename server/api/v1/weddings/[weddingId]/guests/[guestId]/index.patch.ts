import type { H3Event } from 'h3'
import type { GuestUpdatedEvent, UpdateGuestBody } from '../../../../../../../app/types/api/guests'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<GuestUpdatedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<UpdateGuestBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  if (body.name !== undefined)
    guest.name = body.name
  if (body.side !== undefined)
    guest.side = body.side
  if (body.diet !== undefined)
    guest.diet = body.diet
  if (body.category !== undefined)
    guest.category = body.category
  if (body.contact !== undefined)
    guest.contact = body.contact
  if (body.needChildSeat !== undefined)
    guest.needChildSeat = body.needChildSeat
  if (body.notes !== undefined)
    guest.notes = body.notes

  return {
    guestId: guest.guestId,
    weddingId: guest.weddingId,
    name: guest.name,
    side: guest.side,
    diet: guest.diet,
    category: guest.category,
    contact: guest.contact,
    needChildSeat: guest.needChildSeat,
    notes: guest.notes,
  }
})
