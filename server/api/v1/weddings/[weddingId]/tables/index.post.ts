import type { H3Event } from 'h3'
import type { CreateTableBody, TableCreatedEvent } from '../../../../../../app/types/api/seating'

import { useDb } from '../../../../../db'
import { seatingTables } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<TableCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateTableBody>(event)

  if (!body?.tableName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入桌次名稱' })
  }
  // 容量落 integer 欄（issue #70 / M4）：防浮點／溢位，並與座位展開的人頭上限對齊
  if (body.capacity !== undefined)
    assertPositiveInt(body.capacity, '桌次容量', 999)

  const tableId = `table-${crypto.randomUUID().slice(0, 8)}`
  const table = {
    tableId,
    weddingId,
    tableName: body.tableName,
    capacity: body.capacity,
    positionX: body.positionX,
    positionY: body.positionY,
  }
  const db = useDb()
  await db.insert(seatingTables).values(table)

  setResponseStatus(event, 201)
  return table
})
