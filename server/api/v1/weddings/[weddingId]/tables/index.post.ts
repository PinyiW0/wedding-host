import type { H3Event } from 'h3'
import type { CreateTableBody, TableCreatedEvent } from '../../../../../../app/types/api/seating'

import { mockTables } from '../../../../../mock/data/seating'

export default defineEventHandler(async (event: H3Event): Promise<TableCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateTableBody>(event)

  if (!body?.tableName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入桌次名稱' })
  }

  const tableId = `table-${crypto.randomUUID().slice(0, 8)}`
  const table = {
    tableId,
    weddingId,
    tableName: body.tableName,
    capacity: body.capacity,
    positionX: body.positionX,
    positionY: body.positionY,
  }
  mockTables.push(table)

  setResponseStatus(event, 201)
  return table
})
