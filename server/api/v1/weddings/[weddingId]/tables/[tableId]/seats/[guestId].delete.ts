import type { H3Event } from 'h3'

import { mockSeats, mockTables } from '../../../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event) => {
  const tableId = getRouterParam(event, 'tableId')
  const guestId = getRouterParam(event, 'guestId')

  const table = mockTables.find(t => t.tableId === tableId)
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  const index = mockSeats.findIndex(s => s.tableId === tableId && s.guestId === guestId)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: '賓客不在此桌' })
  }
  mockSeats.splice(index, 1)

  setResponseStatus(event, 204)
})
