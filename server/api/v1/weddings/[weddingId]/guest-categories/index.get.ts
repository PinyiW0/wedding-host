import type { H3Event } from 'h3'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 回傳「儲存清單（維持順序）∪ 未刪除賓客在用分類（補尾）」
export default defineEventHandler(async (event: H3Event): Promise<string[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()

  const storedRows = await db.select().from(guestCategories).where(eq(guestCategories.weddingId, weddingId)).orderBy(asc(guestCategories.seq))
  const stored = storedRows.map(c => c.name)

  const seen = new Set(stored)
  const inUse: string[] = []
  const guestRows = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), isNull(guests.deletedAt))).orderBy(asc(guests.seq))
  for (const g of guestRows) {
    const name = g.category.trim()
    if (!name || seen.has(name))
      continue
    seen.add(name)
    inUse.push(name)
  }

  return [...stored, ...inUse]
})
