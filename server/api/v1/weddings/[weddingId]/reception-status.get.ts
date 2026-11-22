import type { H3Event } from 'h3'
import type { ReceptionStatusItem } from '../../../../../app/types/api/reception'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { guests } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ReceptionStatusItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  // 只撈用得到的四欄：接待頁每 5 秒輪詢本端點，整列撈會連 flowerDrawing（base64 手繪，數十 KB/張）一起傳出資料庫
  const rows = await db.select({
    guestId: guests.guestId,
    checkedInAt: guests.checkedInAt,
    giftAmount: guests.giftAmount,
    cakeBoxDistributedTypeId: guests.cakeBoxDistributedTypeId,
  }).from(guests).where(and(eq(guests.weddingId, weddingId), isNull(guests.deletedAt))).orderBy(asc(guests.seq))
  return rows.map(g => ({
    guestId: g.guestId,
    checkedIn: g.checkedInAt !== null,
    giftAmount: g.giftAmount,
    cakeBoxTypeId: g.cakeBoxDistributedTypeId,
  }))
})
