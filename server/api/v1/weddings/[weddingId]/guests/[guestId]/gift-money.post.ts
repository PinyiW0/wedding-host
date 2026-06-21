import type { H3Event } from 'h3'
import type { GiftMoneyRecordedEvent, RecordGiftMoneyBody } from '../../../../../../../app/types/api/reception'

import { mockGuests } from '../../../../../../mock/data/guests'

export default defineEventHandler(async (event: H3Event): Promise<GiftMoneyRecordedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<RecordGiftMoneyBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (typeof body?.amount !== 'number') {
    throw createError({ statusCode: 400, statusMessage: '請輸入禮金金額' })
  }
  guest.giftAmount = body.amount

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, amount: body.amount }
})
