import type { H3Event } from 'h3'
import type { GiftCategoryItem } from '../../../../../../app/types/api/gifts'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { giftCategories } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftCategoryItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(giftCategories).where(eq(giftCategories.weddingId, weddingId)).orderBy(asc(giftCategories.sortOrder), asc(giftCategories.seq))
  return rows.map(c => ({
    categoryId: c.categoryId,
    weddingId: c.weddingId,
    name: c.name,
    sortOrder: c.sortOrder,
  }))
})
