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
  guest.childChairCount = body.childChairCount
  // 同步總人數：本人 + 同行（plusOneCount）+ 兒童椅嬰兒
  guest.partySize = 1 + body.plusOneCount + body.childChairCount

  // 補充欄位：能對應既有欄位的就更新，其餘存入專屬欄位（皆選填）
  if (body.guestName)
    guest.name = body.guestName
  if (body.relationship)
    guest.side = body.relationship
  if (body.relationCategory)
    guest.category = body.relationCategory
  if (body.phone)
    guest.contact = body.phone
  if (body.invitation !== undefined)
    guest.invitationPreference = body.invitation
  if (body.mailingAddress !== undefined)
    guest.mailingAddress = body.mailingAddress
  if (body.blessing !== undefined)
    guest.blessing = body.blessing
  if (body.flowerDrawing !== undefined)
    guest.flowerDrawing = body.flowerDrawing
  if (body.needsShuttle !== undefined)
    guest.needsShuttle = body.needsShuttle
  if (body.shuttleCount !== undefined)
    guest.shuttleCount = body.shuttleCount

  setResponseStatus(event, 201)
  return {
    guestId: guest.guestId,
    attending: body.attending,
    diet: body.diet,
    plusOneCount: body.plusOneCount,
    childChairCount: body.childChairCount,
    guestName: body.guestName,
    relationship: body.relationship,
    relationCategory: body.relationCategory,
    phone: body.phone,
    invitation: body.invitation,
    mailingAddress: body.mailingAddress,
    blessing: body.blessing,
    flowerDrawing: body.flowerDrawing,
    needsShuttle: body.needsShuttle,
    shuttleCount: body.shuttleCount,
  }
})
