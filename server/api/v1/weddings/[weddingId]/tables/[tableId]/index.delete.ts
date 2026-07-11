import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { seatingTables, seats } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const tableId = getRouterParam(event, 'tableId')!
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [table] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  const [occupied] = await db.select().from(seats).where(eq(seats.tableId, tableId))
  if (occupied) {
    throw createError({ statusCode: 409, statusMessage: '桌次上還有賓客，無法移除' })
  }
  await db.delete(seatingTables).where(eq(seatingTables.tableId, tableId))

  setResponseStatus(event, 204)
})
