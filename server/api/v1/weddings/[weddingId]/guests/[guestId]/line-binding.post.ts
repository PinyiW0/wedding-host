import type { H3Event } from 'h3'
import type { BindGuestLineBody, GuestLineBoundEvent } from '../../../../../../../app/types/api/guests'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<GuestLineBoundEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<BindGuestLineBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.lineUserId) {
    throw createError({ statusCode: 409, statusMessage: '已綁定 LINE' })
  }
  if (!body?.lineUserId) {
    throw createError({ statusCode: 400, statusMessage: '缺少 LINE 使用者識別' })
  }
  guest.lineUserId = body.lineUserId

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, lineUserId: body.lineUserId }
})
