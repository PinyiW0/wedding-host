import type { H3Event } from 'h3'
import type { GuestCategoriesSavedEvent, SaveGuestCategoriesBody } from '../../../../../../app/types/api/guests'

import { and, eq, notInArray } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories } from '../../../../../db/schema'

// 整份取代該婚禮的儲存清單。改用「upsert 先行 + 刪除不在新集合者」取代 delete-all+insert：
// 任一步失敗都不會讓清單瞬間清空（複合 PK (weddingId,name) 天然去重）（issue #71）
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoriesSavedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<SaveGuestCategoriesBody>(event)

  const cleaned = [...new Set((body?.categories ?? []).map(c => c.trim()).filter(Boolean))]

  const db = useDb()
  if (cleaned.length) {
    await db.insert(guestCategories).values(cleaned.map(name => ({ weddingId, name }))).onConflictDoNothing()
    await db.delete(guestCategories).where(and(eq(guestCategories.weddingId, weddingId), notInArray(guestCategories.name, cleaned)))
  }
  else {
    await db.delete(guestCategories).where(eq(guestCategories.weddingId, weddingId))
  }

  return { weddingId, categories: cleaned }
})
