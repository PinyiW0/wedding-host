import type { H3Event } from 'h3'
import type { GuestSeatedEvent, SeatGuestBody } from '../../../../../../../../app/types/api/seating'

import { mockGuests } from '../../../../../../../mock/data/guests'
import { mockSeats, mockTables } from '../../../../../../../mock/data/seating'

export default defineEventHandler(async (event: H3Event): Promise<GuestSeatedEvent> => {
  const tableId = getRouterParam(event, 'tableId')!
  const body = await readBody<SeatGuestBody>(event)

  const table = mockTables.find(t => t.tableId === tableId)
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  if (mockSeats.some(s => s.guestId === body.guestId)) {
    throw createError({ statusCode: 409, statusMessage: '賓客已有座位' })
  }
  // 容量規則：大人至多坐滿 capacity；需兒童椅者可使用 +1 加位
  // （如 10 大人＋1 兒童，或 9 大人＋2 兒童；大人不可超過 capacity）
  const needChildSeat = !!mockGuests.find(g => g.guestId === body.guestId)?.needChildSeat
  const seatLimit = needChildSeat ? table.capacity + 1 : table.capacity
  if (mockSeats.filter(s => s.tableId === tableId).length >= seatLimit) {
    throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位' })
  }
  mockSeats.push({ tableId, guestId: body.guestId, seatNumber: body.seatNumber })

  setResponseStatus(event, 201)
  return { tableId, guestId: body.guestId, seatNumber: body.seatNumber }
})
