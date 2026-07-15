import type { H3Event } from 'h3'
import type { BatchDeleteGuestsBody, GuestsBatchDeletedEvent } from '../../../../../../app/types/api/guests'

import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests, seats } from '../../../../../db/schema'

// 批次軟刪除：neon-http 無 transaction，單一 UPDATE 語句處理全部（where 含 weddingId 即租戶守門）；
// 已移除／待確認／不存在的 id 不會命中，以 deletedCount 回報實際筆數
export default defineEventHandler(async (event: H3Event): Promise<GuestsBatchDeletedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<BatchDeleteGuestsBody>(event)

  const guestIds = Array.isArray(body?.guestIds) ? body.guestIds.filter(id => typeof id === 'string') : []
  if (guestIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '請選擇要移除的賓客' })
  }

  const db = useDb()
  const deleted = await db.update(guests)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(
      eq(guests.weddingId, weddingId),
      inArray(guests.guestId, guestIds),
      isNull(guests.deletedAt),
      or(isNull(guests.status), ne(guests.status, 'pending_review')),
    ))
    .returning({ guestId: guests.guestId })

  // 同單筆移除：同步清除席位（桌次圖同步消失；日後恢復賓客時回到待排）
  if (deleted.length) {
    await db.delete(seats).where(inArray(seats.guestId, deleted.map(g => g.guestId)))
  }

  return { weddingId, deletedCount: deleted.length }
})
