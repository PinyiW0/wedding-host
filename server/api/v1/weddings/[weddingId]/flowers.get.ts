import type { H3Event } from 'h3'
import type { FlowerWallItem } from '../../../../../app/types/api/flowers'

import { and, asc, eq, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { guests } from '../../../../db/schema'

// 花田（公開）：回該婚禮所有非空手繪小花 + 賓客名（排除待確認 / 已移除）
export default defineEventHandler(async (event: H3Event): Promise<FlowerWallItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(guests).where(and(
    eq(guests.weddingId, weddingId),
    isNull(guests.deletedAt),
    // status 為 NULL 視同正式賓客（原 mock 為 undefined !== 'pending_review'）
    or(isNull(guests.status), ne(guests.status, 'pending_review')),
    // 非空手繪小花：ne 對 NULL 亦不成立，等同原本的 truthy 判斷
    ne(guests.flowerDrawing, ''),
  )).orderBy(asc(guests.seq))
  return rows.map(g => ({ guestId: g.guestId, name: g.name, flowerDrawing: g.flowerDrawing! }))
})
