import type { H3Event } from 'h3'
import type { TableUpdatedEvent, UpdateTableBody } from '../../../../../../../app/types/api/seating'

import { mockTables } from '../../../../../../mock/data/seating'

export default defineEventHandler(async (event: H3Event): Promise<TableUpdatedEvent> => {
  const tableId = getRouterParam(event, 'tableId')
  const body = await readBody<UpdateTableBody>(event)

  const table = mockTables.find(t => t.tableId === tableId)
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }

  if (body.tableName !== undefined)
    table.tableName = body.tableName
  if (body.capacity !== undefined)
    table.capacity = body.capacity
  if (body.positionX !== undefined)
    table.positionX = body.positionX
  if (body.positionY !== undefined)
    table.positionY = body.positionY

  return {
    tableId: table.tableId,
    tableName: table.tableName,
    capacity: table.capacity,
    positionX: table.positionX,
    positionY: table.positionY,
  }
})
