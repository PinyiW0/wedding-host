import type { H3Event } from 'h3'
import type { GuestDisplayName } from '../../../../../../app/types/api/guests'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests } from '../../../../../db/schema'

// 公開投影牆用：僅回「賓客 id → 顯示名」對照，不含任何 PII（電話/地址/備註/LINE 等）。
// 完整賓客資料由 guests GET（管理端 auth）提供，不對公開分享簽名開放。
export default defineEventHandler(async (event: H3Event): Promise<GuestDisplayName[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select({ guestId: guests.guestId, name: guests.name })
    .from(guests)
    .where(and(eq(guests.weddingId, weddingId), isNull(guests.deletedAt)))
    .orderBy(asc(guests.seq))
  return rows
})
