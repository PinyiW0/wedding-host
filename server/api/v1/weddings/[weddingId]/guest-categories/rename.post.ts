import type { H3Event } from 'h3'
import type { GuestCategoryRenamedEvent, RenameGuestCategoryBody } from '../../../../../../app/types/api/guests'

import { and, count, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 分類改名（issue #94）：改用 categoryId 引用後，純改名只需字典一筆 UPDATE（賓客一列都不動、
// categoryId 不變、天然原子）；目標名稱已存在時為「合併」，把賓客改指到目標分類再刪來源。
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoryRenamedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<RenameGuestCategoryBody>(event)

  const from = body?.from?.trim() ?? ''
  const to = body?.to?.trim() ?? ''
  if (!to)
    throw createError({ statusCode: 400, statusMessage: '請輸入分類名稱' })

  const db = useDb()
  // in-use ⇒ stored（寫入端一律 find-or-create）⇒ 不必再查 guests 就能判定「分類不存在」
  const [fromEntry] = await db.select().from(guestCategories).where(and(eq(guestCategories.weddingId, weddingId), eq(guestCategories.name, from)))
  if (!fromEntry)
    throw createError({ statusCode: 404, statusMessage: '分類不存在' })

  // 受影響賓客數（含軟刪，與改造前 updatedGuests 語意一致；純改名雖不動 guests 列，顯示上仍變了 N 位）
  const [affected] = await db.select({ value: count() }).from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.categoryId, fromEntry.categoryId)))
  const updatedGuests = affected?.value ?? 0

  // from === to 早退（必須）：否則走合併分支 → 把 guests 改指到自己、再刪掉該分類 → 全成孤兒
  if (from === to)
    return { weddingId, from, to, updatedGuests }

  const [toEntry] = await db.select().from(guestCategories).where(and(eq(guestCategories.weddingId, weddingId), eq(guestCategories.name, to)))
  if (!toEntry) {
    // 就地改名：字典一筆 UPDATE，categoryId 不變 ⇒ 賓客不用動（tier/isMainTable 不動，人工語意優先於名稱推斷）
    await db.update(guestCategories).set({ name: to }).where(eq(guestCategories.categoryId, fromEntry.categoryId))
  }
  else {
    // 合併：先把賓客從來源改指到目標，再刪來源（順序不可顛倒，否則改指前來源已無）
    await db.update(guests).set({ categoryId: toEntry.categoryId }).where(and(eq(guests.weddingId, weddingId), eq(guests.categoryId, fromEntry.categoryId)))
    await db.delete(guestCategories).where(eq(guestCategories.categoryId, fromEntry.categoryId))
  }

  return { weddingId, from, to, updatedGuests }
})
