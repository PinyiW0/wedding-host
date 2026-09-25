import type { H3Event } from 'h3'
import type { TableUpdatedEvent, UpdateTableBody } from '../../../../../../../app/types/api/seating'

import { and, eq } from 'drizzle-orm'

import { seatingHeads } from '../../../../../../../app/utils/seatingRules'
import { useDb } from '../../../../../../db'
import { seatingTables, seats } from '../../../../../../db/schema'
import { seatingDietLookup } from '../../../../../../utils/seating-capacity'

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
  if (body.capacity !== undefined) {
    // 比照新增桌次驗證（浮點／負值／溢位會污染座位環與容量計算）
    assertPositiveInt(body.capacity, '桌次容量', 999)
    const tableSeats = await db.select().from(seats).where(eq(seats.tableId, tableId))
    const dietOf = await seatingDietLookup(db, weddingId)
    const heads = seatingHeads(tableSeats, dietOf)
    if (heads > body.capacity) {
      throw createError({ statusCode: 409, statusMessage: `座位數不可小於此桌已排席人數（${heads} 人），請先移除座位` })
    }
    patch.capacity = body.capacity
  }
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
