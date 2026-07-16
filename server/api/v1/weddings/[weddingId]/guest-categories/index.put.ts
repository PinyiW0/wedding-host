import type { H3Event } from 'h3'
import type { GuestCategoriesSavedEvent, SaveGuestCategoriesBody } from '../../../../../../app/types/api/guests'

import { and, eq, inArray } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 整份取代該婚禮的儲存清單。改用「upsert 先行 + 刪除不在新集合者」取代 delete-all+insert：
// 任一步失敗都不會讓清單瞬間清空（issue #71）。刪除前加 in-use 守門（issue #94）：
// 仍有賓客（含軟刪）使用的分類不可刪，回 409——原本完全不碰 guests，只靠前端且漏算軟刪。
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoriesSavedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<SaveGuestCategoriesBody>(event)

  const cleaned = [...new Set((body?.categories ?? []).map(c => c.trim()).filter(Boolean))]

  const db = useDb()
  const existing = await db.select().from(guestCategories).where(eq(guestCategories.weddingId, weddingId))
  const toDelete = existing.filter(c => !cleaned.includes(c.name))

  // 守門必須在任何 mutation 之前（neon-http 無 transaction，先寫後檢查沒得回頭）
  if (toDelete.length) {
    // 刻意不加 isNull(deletedAt)：軟刪賓客仍持有 categoryId，刪了分類牠們就是孤兒（恢復後分類消失）
    const inUse = await db.selectDistinct({ categoryId: guests.categoryId }).from(guests).where(and(eq(guests.weddingId, weddingId), inArray(guests.categoryId, toDelete.map(c => c.categoryId))))
    if (inUse.length) {
      const used = new Set(inUse.map(r => r.categoryId))
      const names = toDelete.filter(c => used.has(c.categoryId)).map(c => c.name)
      throw createError({ statusCode: 409, statusMessage: `分類使用中，無法刪除：${names.join('、')}` })
    }
  }

  if (cleaned.length) {
    // (weddingId,name) unique ⇒ onConflictDoNothing 冪等；tier/isMainTable 以名稱推斷初值
    await db.insert(guestCategories)
      .values(cleaned.map(name => ({ categoryId: `gcat-${crypto.randomUUID().slice(0, 8)}`, weddingId, name, ...inferCategoryDefaults(name) })))
      .onConflictDoNothing()
  }
  if (toDelete.length) {
    await db.delete(guestCategories).where(inArray(guestCategories.categoryId, toDelete.map(c => c.categoryId)))
  }

  return { weddingId, categories: cleaned }
})
