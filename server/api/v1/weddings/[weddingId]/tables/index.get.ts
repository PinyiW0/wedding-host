import type { H3Event } from 'h3'
import type { TableListItem } from '../../../../../../app/types/api/seating'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { seatingTables } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<TableListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(seatingTables).where(eq(seatingTables.weddingId, weddingId)).orderBy(asc(seatingTables.seq))
  return rows.map(t => ({
    tableId: t.tableId,
    weddingId: t.weddingId,
    tableName: t.tableName,
    capacity: t.capacity,
    positionX: t.positionX,
    positionY: t.positionY,
  }))
})
