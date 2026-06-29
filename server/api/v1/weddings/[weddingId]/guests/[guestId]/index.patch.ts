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
  if (body.partySize !== undefined)
    guest.partySize = body.partySize
  if (body.childChairCount !== undefined)
    guest.childChairCount = body.childChairCount
  if (body.notes !== undefined)
    guest.notes = body.notes
  // 管理員修正的 RSVP 回覆欄位（接駁／喜帖）
  if (body.needsShuttle !== undefined)
    guest.needsShuttle = body.needsShuttle
  if (body.shuttleCount !== undefined)
    guest.shuttleCount = body.shuttleCount
  if (body.invitationPreference !== undefined)
    guest.invitationPreference = body.invitationPreference
  if (body.mailingAddress !== undefined)
    guest.mailingAddress = body.mailingAddress

  return {
    guestId: guest.guestId,
    weddingId: guest.weddingId,
    name: guest.name,
    side: guest.side,
    diet: guest.diet,
    category: guest.category,
    contact: guest.contact,
    partySize: guest.partySize,
    childChairCount: guest.childChairCount,
    notes: guest.notes,
  }
})
