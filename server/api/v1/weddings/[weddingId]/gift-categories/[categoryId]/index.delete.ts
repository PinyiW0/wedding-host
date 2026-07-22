import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { giftCategories, giftItems } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const categoryId = getRouterParam(event, 'categoryId')!
  const db = useDb()
  const [existing] = await db.select().from(giftCategories).where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.categoryId, categoryId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '禮物類別不存在' })
  }

  // 有品項擋刪：gift_items.category 無 FK 約束，孤兒品項會從頁面消失且金額憑空蒸發，
  // 守門必須在 mutation 之前（neon-http 無 transaction）
  const [item] = await db.select({ giftItemId: giftItems.giftItemId }).from(giftItems).where(and(eq(giftItems.weddingId, weddingId), eq(giftItems.category, categoryId)))
  if (item) {
    throw createError({ statusCode: 409, statusMessage: '此類別仍有品項，請先移除或調整品項類別' })
  }

  await db.delete(giftCategories)
    .where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.categoryId, categoryId)))

  setResponseStatus(event, 204)
})
