import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../../db'
import { seatingTables, seats } from '../../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const tableId = getRouterParam(event, 'tableId')!
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [table] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  // 一組賓客可能佔多筆座位（本人＋同行＋兒童椅），取消時一次清除該桌該賓客所有座位
  const removed = await db.delete(seats)
    .where(and(eq(seats.tableId, tableId), eq(seats.guestId, guestId)))
    .returning()
  if (!removed.length) {
    throw createError({ statusCode: 404, statusMessage: '賓客不在此桌' })
  }
  // 手動取消座位是新人自己的決定，不該再掛著「RSVP 變動被退回」的提示（issue #174）
  await clearSeatReleasedMark(db, guestId)

  setResponseStatus(event, 204)
})
