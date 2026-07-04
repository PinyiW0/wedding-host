import type { H3Event } from 'h3'
import type { GiftMoneyUpdatedEvent, UpdateGiftMoneyBody } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftMoneyUpdatedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const body = await readBody<UpdateGiftMoneyBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.giftAmount === null) {
    throw createError({ statusCode: 409, statusMessage: '尚未登記禮金' })
  }
  if (typeof body?.amount !== 'number') {
    throw createError({ statusCode: 400, statusMessage: '請輸入禮金金額' })
  }
  await db.update(guests).set({ giftAmount: body.amount }).where(eq(guests.guestId, guest.guestId))

  return { guestId: guest.guestId, amount: body.amount }
})
