import type { H3Event } from 'h3'
import type { BatchCategorizeGuestsBody, GuestsBatchCategorizedEvent } from '../../../../../../app/types/api/guests'

import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests } from '../../../../../db/schema'

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
  const updated = await db.update(guests)
    .set({ category })
    .where(and(
      eq(guests.weddingId, weddingId),
      inArray(guests.guestId, guestIds),
      isNull(guests.deletedAt),
      or(isNull(guests.status), ne(guests.status, 'pending_review')),
    ))
    .returning({ guestId: guests.guestId })

  return { weddingId, category, updatedCount: updated.length }
})
