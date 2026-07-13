import type { H3Event } from 'h3'
import type { CustomizeThankYouCardBody, ThankYouCardCustomizedEvent } from '../../../../../../app/types/api/thankyou'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests, thankYouCustomizations, weddings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouCardCustomizedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CustomizeThankYouCardBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // guestId 需屬於本婚禮（issue #70 / L3）：避免建立對應外來 guestId 的孤兒客製
  const [guest] = await db.select({ id: guests.guestId }).from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, body.guestId)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  // (weddingId, guestId) 複合鍵 upsert：先查有無客製，有則更新、無則新增
  const [existing] = await db.select().from(thankYouCustomizations).where(and(eq(thankYouCustomizations.weddingId, weddingId), eq(thankYouCustomizations.guestId, body.guestId)))
  if (existing) {
    await db.update(thankYouCustomizations)
      .set({ customContent: body.customContent })
      .where(and(eq(thankYouCustomizations.weddingId, weddingId), eq(thankYouCustomizations.guestId, body.guestId)))
  }
  else {
    await db.insert(thankYouCustomizations).values({ weddingId, guestId: body.guestId, customContent: body.customContent })
  }

  setResponseStatus(event, 201)
  return { weddingId, guestId: body.guestId, customContent: body.customContent }
})
