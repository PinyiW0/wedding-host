import type { H3Event } from 'h3'
import type { WeddingListItem } from '../../../../app/types/api/weddings'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../db'
import { weddings } from '../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<WeddingListItem[]> => {
  // 新人僅能看到自己擁有的婚禮；管理者／接待員／無 token 看全部（含已軟刪除，UI 以 deletedAt 分區）
  const user = getRequestUser(event)
  const db = useDb()
  const rows = user.role === '新人'
    ? await db.select().from(weddings).where(eq(weddings.ownerId, user.userId)).orderBy(asc(weddings.seq))
    : await db.select().from(weddings).orderBy(asc(weddings.seq))
  return rows.map(w => ({
    weddingId: w.weddingId,
    title: w.title,
    venue: w.venue,
    address: w.address,
    date: w.date,
    ownerId: w.ownerId ?? null,
    deletedAt: w.deletedAt,
  }))
})
