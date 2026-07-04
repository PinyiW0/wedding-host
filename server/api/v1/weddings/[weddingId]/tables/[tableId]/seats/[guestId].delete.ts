import type { H3Event } from 'h3'

import { mockSeats, mockTables } from '../../../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event) => {
  const tableId = getRouterParam(event, 'tableId')
  const guestId = getRouterParam(event, 'guestId')

  const table = mockTables.find(t => t.tableId === tableId)
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  // 一組賓客可能佔多筆座位（本人＋同行＋兒童椅），取消時一次清除該桌該賓客所有座位
  const before = mockSeats.length
  for (let i = mockSeats.length - 1; i >= 0; i--) {
    const s = mockSeats[i]!
    if (s.tableId === tableId && s.guestId === guestId)
      mockSeats.splice(i, 1)
  }
  if (mockSeats.length === before) {
    throw createError({ statusCode: 404, statusMessage: '賓客不在此桌' })
  }

  setResponseStatus(event, 204)
})
