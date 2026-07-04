import type { H3Event } from 'h3'
import type { GuestCategoryRenamedEvent, RenameGuestCategoryBody } from '../../../../../../app/types/api/guests'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 分類改名：儲存清單 from→to，並連動該婚禮所有 category === from 的賓客（含軟刪）
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoryRenamedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<RenameGuestCategoryBody>(event)

  const from = body?.from?.trim() ?? ''
  const to = body?.to?.trim() ?? ''
  if (!to)
    throw createError({ statusCode: 400, statusMessage: '請輸入分類名稱' })

  const db = useDb()
  const [storedEntry] = await db.select().from(guestCategories).where(and(eq(guestCategories.weddingId, weddingId), eq(guestCategories.name, from)))
  const [usedGuest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.category, from)))
  if (!storedEntry && !usedGuest)
    throw createError({ statusCode: 404, statusMessage: '分類不存在' })

  // 目標名稱已在清單 → 合併（移除 from 條目）；否則就地改名（seq 不變、位置維持）
  if (storedEntry) {
    const [toEntry] = await db.select().from(guestCategories).where(and(eq(guestCategories.weddingId, weddingId), eq(guestCategories.name, to)))
    if (toEntry)
      await db.delete(guestCategories).where(and(eq(guestCategories.weddingId, weddingId), eq(guestCategories.name, from)))
    else
      await db.update(guestCategories).set({ name: to }).where(and(eq(guestCategories.weddingId, weddingId), eq(guestCategories.name, from)))
  }

  const updated = await db.update(guests).set({ category: to }).where(and(eq(guests.weddingId, weddingId), eq(guests.category, from))).returning()
  const updatedGuests = updated.length

  return { weddingId, from, to, updatedGuests }
})
