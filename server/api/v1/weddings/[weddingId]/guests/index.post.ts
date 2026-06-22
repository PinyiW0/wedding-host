import type { H3Event } from 'h3'
import type { CreateGuestBody, GuestCreatedEvent } from '../../../../../../app/types/api/guests'

import { mockGuests } from '../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<GuestCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateGuestBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入賓客姓名' })
  }

  const guestId = `guest-${crypto.randomUUID().slice(0, 8)}`
  const notes = body.notes ?? null
  mockGuests.unshift({
    guestId,
    weddingId,
    name: body.name,
    side: body.side,
    diet: body.diet,
    category: body.category,
    contact: body.contact,
    needChildSeat: body.needChildSeat,
    notes,
    lineUserId: null,
    rsvpAttending: null,
    checkedInAt: null,
    giftAmount: null,
    cakeBoxDistributedTypeId: null,
    partySize: 1,
    tableName: null,
    deletedAt: null,
  })

  setResponseStatus(event, 201)
  return {
    guestId,
    weddingId,
    name: body.name,
    side: body.side,
    diet: body.diet,
    category: body.category,
    contact: body.contact,
    needChildSeat: body.needChildSeat,
    notes,
  }
})
