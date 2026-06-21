import type { H3Event } from 'h3'
import type { GiftMoneyUpdatedEvent, UpdateGiftMoneyBody } from '../../../../../../../app/types/api/reception'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<GiftMoneyUpdatedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<UpdateGiftMoneyBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.giftAmount === null) {
    throw createError({ statusCode: 409, statusMessage: '尚未登記禮金' })
  }
  if (typeof body?.amount !== 'number') {
    throw createError({ statusCode: 400, statusMessage: '請輸入禮金金額' })
  }
  guest.giftAmount = body.amount

  return { guestId: guest.guestId, amount: body.amount }
})
