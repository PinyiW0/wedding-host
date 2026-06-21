import type { H3Event } from 'h3'

import { mockSeats, mockTables } from '../../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event) => {
  const tableId = getRouterParam(event, 'tableId')
  const index = mockTables.findIndex(t => t.tableId === tableId)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  if (mockSeats.some(s => s.tableId === tableId)) {
    throw createError({ statusCode: 409, statusMessage: '桌次上還有賓客，無法移除' })
  }
  mockTables.splice(index, 1)

  setResponseStatus(event, 204)
})
