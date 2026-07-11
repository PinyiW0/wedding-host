import type { H3Event } from 'h3'
import type { TableUpdatedEvent, UpdateTableBody } from '../../../../../../../app/types/api/seating'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { seatingTables } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<TableUpdatedEvent> => {
  const tableId = getRouterParam(event, 'tableId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateTableBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }

  const patch: Partial<typeof seatingTables.$inferInsert> = {}
  if (body.tableName !== undefined)
    patch.tableName = body.tableName
  if (body.capacity !== undefined)
    patch.capacity = body.capacity
  if (body.positionX !== undefined)
    patch.positionX = body.positionX
  if (body.positionY !== undefined)
    patch.positionY = body.positionY

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [table] = Object.keys(patch).length
    ? await db.update(seatingTables).set(patch).where(eq(seatingTables.tableId, tableId)).returning()
    : [existing]

  return {
    tableId: table!.tableId,
    tableName: table!.tableName,
    capacity: table!.capacity,
    positionX: table!.positionX,
    positionY: table!.positionY,
  }
})
