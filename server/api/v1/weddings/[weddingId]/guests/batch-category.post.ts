import type { H3Event } from 'h3'
import type { BatchCategorizeGuestsBody, GuestsBatchCategorizedEvent } from '../../../../../../app/types/api/guests'

import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 批次改分類：單一 UPDATE 語句處理全部（where 含 weddingId 即租戶守門）；
// 目標分類為自由字串（與單筆編輯一致，會進入在用分類 union），以 updatedCount 回報實際筆數
export default defineEventHandler(async (event: H3Event): Promise<GuestsBatchCategorizedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<BatchCategorizeGuestsBody>(event)

  const guestIds = Array.isArray(body?.guestIds) ? body.guestIds.filter(id => typeof id === 'string') : []
  if (guestIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '請選擇要改分類的賓客' })
  }
  const category = body?.category?.trim() ?? ''
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: '請輸入分類名稱' })
  }

  const db = useDb()
  // 目標分類 find-or-create 成 categoryId（自由字串，打字即建分類）；合約仍回名稱
  const resolvedCategory = await resolveCategory(db, weddingId, category)
  // 改分類前先記各賓客現況（side＋原分類 tier），供男方親屬預設轉換判定（issue #105）
  const before = await db
    .select({ guestId: guests.guestId, side: guests.side, tier: guestCategories.tier })
    .from(guests)
    .leftJoin(guestCategories, eq(guests.categoryId, guestCategories.categoryId))
    .where(and(
      eq(guests.weddingId, weddingId),
      inArray(guests.guestId, guestIds),
      isNull(guests.deletedAt),
      or(isNull(guests.status), ne(guests.status, 'pending_review')),
    ))
  const updated = await db.update(guests)
    .set({ categoryId: resolvedCategory?.categoryId ?? null })
    .where(and(
      eq(guests.weddingId, weddingId),
      inArray(guests.guestId, guestIds),
      isNull(guests.deletedAt),
      or(isNull(guests.status), ne(guests.status, 'pending_review')),
    ))
    .returning({ guestId: guests.guestId })

  // 進入／離開男方親屬 → 同步不發放排除列（只動實際被更新者）
  const updatedIds = new Set(updated.map(u => u.guestId))
  const newTier = resolvedCategory?.tier ?? null
  const entering: string[] = []
  const leaving: string[] = []
  for (const b of before) {
    if (!updatedIds.has(b.guestId))
      continue
    const was = isGroomRelative(b.side, b.tier)
    const now = isGroomRelative(b.side, newTier)
    if (!was && now)
      entering.push(b.guestId)
    else if (was && !now)
      leaving.push(b.guestId)
  }
  await syncGroomRelativeNoBoxBulk(db, weddingId, entering, leaving)

  return { weddingId, category, updatedCount: updated.length }
})
