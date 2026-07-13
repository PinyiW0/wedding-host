import type { H3Event } from 'h3'
import type { GiftMoneyRecordedEvent, RecordGiftMoneyBody } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftMoneyRecordedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<RecordGiftMoneyBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (body?.amount === undefined || body.amount === null) {
    throw createError({ statusCode: 400, statusMessage: '請輸入禮金金額' })
  }
  // 金額落 integer 欄（issue #70 / M4）：防浮點／int4 溢位致 500、負數污染
  assertPositiveInt(body.amount, '禮金金額', 100_000_000)
  await db.update(guests).set({ giftAmount: body.amount }).where(eq(guests.guestId, guest.guestId))

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, amount: body.amount }
})
