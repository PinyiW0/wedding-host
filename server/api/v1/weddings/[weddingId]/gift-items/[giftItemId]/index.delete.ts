import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { giftItems } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const giftItemId = getRouterParam(event, 'giftItemId')!

  const db = useDb()
  const [existing] = await db.select().from(giftItems).where(and(eq(giftItems.weddingId, weddingId), eq(giftItems.giftItemId, giftItemId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '禮物品項不存在' })
  }

  await db.delete(giftItems)
    .where(and(eq(giftItems.weddingId, weddingId), eq(giftItems.giftItemId, giftItemId)))
  setResponseStatus(event, 204)
})
