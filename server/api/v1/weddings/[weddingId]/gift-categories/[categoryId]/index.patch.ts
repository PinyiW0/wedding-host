import type { H3Event } from 'h3'
import type { GiftCategoryUpdatedEvent, UpdateGiftCategoryBody } from '../../../../../../../app/types/api/gifts'

import { and, eq, ne } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { giftCategories } from '../../../../../../db/schema'

// 類別改名：categoryId 不變，品項一列都不動（gift_items.category 存 id 引用）
export default defineEventHandler(async (event: H3Event): Promise<GiftCategoryUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const categoryId = getRouterParam(event, 'categoryId')!
  const body = await readBody<UpdateGiftCategoryBody>(event)

  const name = body?.name?.trim() ?? ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入類別名稱' })
  }

  const db = useDb()
  const [existing] = await db.select().from(giftCategories).where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.categoryId, categoryId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '禮物類別不存在' })
  }

  if (name !== existing.name) {
    const [dup] = await db.select({ categoryId: giftCategories.categoryId }).from(giftCategories).where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.name, name), ne(giftCategories.categoryId, categoryId)))
    if (dup) {
      throw createError({ statusCode: 409, statusMessage: '類別名稱已存在' })
    }
    await db.update(giftCategories).set({ name }).where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.categoryId, categoryId)))
  }

  return { categoryId, weddingId, name, sortOrder: existing.sortOrder }
})
