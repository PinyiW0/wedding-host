import type { H3Event } from 'h3'
import type { CreateGiftCategoryBody, GiftCategoryCreatedEvent } from '../../../../../../app/types/api/gifts'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { giftCategories } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftCategoryCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateGiftCategoryBody>(event)

  const name = body?.name?.trim() ?? ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入類別名稱' })
  }

  const db = useDb()
  // 同名先擋 409（(weddingId, name) 唯一索引為併發兜底）；既有列同時供 sortOrder 遞增
  const rows = await db.select().from(giftCategories).where(eq(giftCategories.weddingId, weddingId))
  if (rows.some(c => c.name === name)) {
    throw createError({ statusCode: 409, statusMessage: '類別名稱已存在' })
  }

  const categoryId = `giftcat-${crypto.randomUUID().slice(0, 8)}`
  const sortOrder = rows.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1
  await db.insert(giftCategories).values({ weddingId, categoryId, name, sortOrder })

  setResponseStatus(event, 201)
  return { categoryId, weddingId, name, sortOrder }
})
